import { getTranslations } from 'next-intl/server'

type Props = {
  name: string
  email: string
  /** Whether this is the signed-in admin. */
  isSelf: boolean
  /** On a card the name is its heading; in a table the row header is enough. */
  asHeading?: boolean
}

/** A person's name, marked when it is the admin's own, with their email below. */
export default async function PersonName({ name, email, isSelf, asHeading = false }: Props) {
  const t = await getTranslations('People')
  const Name = asHeading ? 'h2' : 'span'

  return (
    <span className="flex min-w-0 flex-col">
      <Name className="flex flex-wrap items-center gap-2 text-lg font-semibold md:text-base">
        {name}
        {isSelf ? (
          <span className="bg-surface border-border text-text-muted rounded-full border px-2 text-xs font-medium">
            {t('you')}
          </span>
        ) : null}
      </Name>
      {/* Addresses read left to right in both languages. */}
      <span dir="ltr" className="text-text-muted text-sm break-all rtl:text-end">
        {email}
      </span>
    </span>
  )
}
