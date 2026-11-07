'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { unstable_rethrow } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { demoRefusal } from '@/app/lib/actions/shared'
import { authorizeAction } from '@/app/lib/authz'
import { db } from '@/app/lib/db'
import type { Member } from '@/app/lib/definitions'
import { logger } from '@/app/lib/logger'
import { buildingMembers, user } from '@/app/lib/schema'
import { typed, type Translate } from '@/app/lib/utils/form'
import { formatPhone, normalizePhone } from '@/app/lib/utils/phone'
import { redirect } from '@/i18n/navigation'
import { resolveLocale } from '@/i18n/locale'
import { localeCookie, routing } from '@/i18n/routing'

// Each action writes only the caller's own rows: the user is always the session's, and the
// membership is theirs in their own building. No cached read holds a name, phone or contact
// choice (the directory and committee pages read them on every request, and nothing reads
// the name from the session), so these update no tag; they refresh the profile page.

const route = '/profile'

/** Empty means none; anything else must be an Israeli number, saved in E.164. */
function optionalPhone(message: string) {
  return z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === '') return null
      const e164 = normalizePhone(value)
      if (e164) return e164
      ctx.addIssue({ code: 'custom', message })
      return z.NEVER
    })
}

function profileSchema(t: Translate<'ProfileErrors'>) {
  return z.object({
    name: z.string().trim().min(2, t('name')).max(60, t('name')),
    phone: optionalPhone(t('phone')),
  })
}

function committeeContactSchema(t: Translate<'ProfileErrors'>) {
  return z.object({
    committeePhone: optionalPhone(t('committeePhone')),
    committeeEmail: z
      .string()
      .trim()
      .max(254, t('committeeEmail'))
      .refine((value) => value === '' || z.email().safeParse(value).success, t('committeeEmail'))
      .transform((value) => value || null),
  })
}

function refreshProfile() {
  revalidatePath('/[locale]/(app)/profile', 'page')
}

/** The member's own membership row, in their own building. */
function ownMembership(member: Member) {
  return and(
    eq(buildingMembers.userId, member.userId),
    eq(buildingMembers.buildingId, member.buildingId),
  )
}

type ProfileField = 'name' | 'phone'

export type ProfileFormState = {
  /** What the fields hold: as typed after an error, as saved after a success. */
  values?: Record<ProfileField, string>
  errors?: Partial<Record<ProfileField, string[]>>
  message?: string | null
  /** When the details were last saved, so each save is announced again. */
  savedAt?: number
}

/** Saves the member's own name and phone (R13). The phone is optional, kept in E.164. */
export async function updateProfile(
  locale: string,
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const lang = resolveLocale(locale)
  const values = { name: typed(formData, 'name'), phone: typed(formData, 'phone') }

  const authorization = await authorizeAction('resident', lang)
  if (!authorization.ok) return { values, message: authorization.message }
  const { member } = authorization

  const t = await getTranslations({ locale: lang, namespace: 'ProfileErrors' })
  const validatedFields = profileSchema(t).safeParse(values)
  if (!validatedFields.success) {
    return { values, errors: z.flattenError(validatedFields.error).fieldErrors, message: null }
  }

  if (member.isDemo) return { values, message: await demoRefusal(lang) }

  const { name, phone } = validatedFields.data
  try {
    await db.update(user).set({ name, phone }).where(eq(user.id, member.userId))
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to save the profile', {
      area: 'actions/users',
      route,
      userId: member.userId,
      err,
    })
    return { values, message: t('saveFailed') }
  }

  refreshProfile()
  return {
    values: { name, phone: phone ? formatPhone(phone) : '' },
    message: null,
    savedAt: Date.now(),
  }
}

export type SettingState = { message?: string | null }

/**
 * Whether the directory shows the member's phone and email to neighbours (R11, R13), saved as
 * the switch changes; the control sends `showContact` as "true" or "false".
 */
export async function setShowContact(
  locale: string,
  _prevState: SettingState,
  formData: FormData,
): Promise<SettingState> {
  const lang = resolveLocale(locale)

  const authorization = await authorizeAction('resident', lang)
  if (!authorization.ok) return { message: authorization.message }
  const { member } = authorization

  const t = await getTranslations({ locale: lang, namespace: 'ProfileErrors' })
  const validatedFields = z.enum(['true', 'false']).safeParse(typed(formData, 'showContact'))
  if (!validatedFields.success) return { message: t('saveFailed') }

  if (member.isDemo) return { message: await demoRefusal(lang) }

  try {
    await db
      .update(buildingMembers)
      .set({ showContact: validatedFields.data === 'true' })
      .where(ownMembership(member))
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to save the directory visibility', {
      area: 'actions/users',
      route,
      userId: member.userId,
      buildingId: member.buildingId,
      err,
    })
    return { message: t('saveFailed') }
  }

  refreshProfile()
  return { message: null }
}

/**
 * Saves the language (R1, R13) to the profile and to the locale cookie, then opens the profile
 * in that language, at the language section. The cookie is what the proxy reads, so `/` then
 * goes to `/en` too. In a demo building only the cookie changes (spec §3).
 */
export async function setLocale(
  locale: string,
  _prevState: SettingState,
  formData: FormData,
): Promise<SettingState> {
  const lang = resolveLocale(locale)

  const authorization = await authorizeAction('resident', lang)
  if (!authorization.ok) return { message: authorization.message }
  const { member } = authorization

  const t = await getTranslations({ locale: lang, namespace: 'ProfileErrors' })
  const validatedFields = z.enum(routing.locales).safeParse(typed(formData, 'locale'))
  if (!validatedFields.success) return { message: t('locale') }
  const chosen = validatedFields.data

  if (!member.isDemo) {
    try {
      await db.update(user).set({ locale: chosen }).where(eq(user.id, member.userId))
    } catch (err) {
      unstable_rethrow(err)
      logger.error('Failed to save the language', {
        area: 'actions/users',
        route,
        userId: member.userId,
        err,
      })
      return { message: t('saveFailed') }
    }
  }

  const cookieStore = await cookies()
  cookieStore.set({ ...localeCookie, value: chosen, path: '/' })
  refreshProfile()
  // The other language is another root layout, so the browser loads the page afresh; the
  // fragment brings the person back to the control they just used.
  return redirect({ href: '/profile#language', locale: chosen })
}

type CommitteeContactField = 'committeePhone' | 'committeeEmail'

export type CommitteeContactState = {
  values?: Record<CommitteeContactField, string>
  errors?: Partial<Record<CommitteeContactField, string[]>>
  message?: string | null
  savedAt?: number
}

/**
 * Saves the contact a committee member publishes for the role on the Committee page (R12),
 * separate from their personal directory choice. Committee and admins only; the title is the
 * admin's to set, so it is not sent.
 */
export async function updateCommitteeContact(
  locale: string,
  _prevState: CommitteeContactState,
  formData: FormData,
): Promise<CommitteeContactState> {
  const lang = resolveLocale(locale)
  const values = {
    committeePhone: typed(formData, 'committeePhone'),
    committeeEmail: typed(formData, 'committeeEmail'),
  }

  const authorization = await authorizeAction('committee', lang)
  if (!authorization.ok) return { values, message: authorization.message }
  const { member } = authorization

  const t = await getTranslations({ locale: lang, namespace: 'ProfileErrors' })
  const validatedFields = committeeContactSchema(t).safeParse(values)
  if (!validatedFields.success) {
    return { values, errors: z.flattenError(validatedFields.error).fieldErrors, message: null }
  }

  if (member.isDemo) return { values, message: await demoRefusal(lang) }

  const { committeePhone, committeeEmail } = validatedFields.data
  try {
    await db
      .update(buildingMembers)
      .set({ committeePhone, committeeEmail })
      .where(ownMembership(member))
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to save the committee contact', {
      area: 'actions/users',
      route,
      userId: member.userId,
      buildingId: member.buildingId,
      err,
    })
    return { values, message: t('saveFailed') }
  }

  refreshProfile()
  return {
    values: {
      committeePhone: committeePhone ? formatPhone(committeePhone) : '',
      committeeEmail: committeeEmail ?? '',
    },
    message: null,
    savedAt: Date.now(),
  }
}
