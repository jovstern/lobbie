import { getTranslations } from 'next-intl/server'
import { displayName, hasGivenName, type Named } from '@/app/lib/utils/display-name'

type Props = {
  person: Named
  /** Whether this is the signed-in admin. */
  isSelf: boolean
  /** On a card the name is its heading; in a table the row header is enough. */
  asHeading?: boolean
}

/**
 * A person's name, marked when it is the admin's own, with their email below. Someone who has
 * not given a name yet is shown by their email alone.
 */
export default async function PersonName({ person, isSelf, asHeading = false }: Props) {
  const t = await getTranslations('People')
  const Name = asHeading ? 'h2' : 'span'
  const hasName = hasGivenName(person)

  return (
    <span className="flex min-w-0 flex-col">
      <Name className="flex flex-wrap items-center gap-2 text-lg font-semibold wrap-anywhere md:text-base">
        {hasName ? displayName(person) : <bdi dir="ltr">{person.email}</bdi>}
        {isSelf ? (
          <span className="bg-surface border-border text-text-muted rounded-full border px-2 text-xs font-medium">
            {t('you')}
          </span>
        ) : null}
      </Name>
      {hasName ? (
        // Addresses read left to right in both languages.
        <span dir="ltr" className="text-text-muted text-sm break-all rtl:text-end">
          {person.email}
        </span>
      ) : null}
    </span>
  )
}
