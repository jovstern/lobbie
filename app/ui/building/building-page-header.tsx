import BackToBuilding from '@/app/ui/building/back-to-building'

type Props = { title: string; lead: string }

/** The header of a page under Building: the way back, the title and a line on what it shows. */
export default function BuildingPageHeader({ title, lead }: Props) {
  return (
    <header className="flex flex-col gap-2">
      <BackToBuilding />
      <h1 className="text-2xl font-semibold text-balance">{title}</h1>
      <p className="text-text-muted max-w-prose text-pretty">{lead}</p>
    </header>
  )
}
