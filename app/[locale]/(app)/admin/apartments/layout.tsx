import CreatedInvitesProvider from '@/app/ui/admin/created-invites-provider'

// The apartments pages share the links "Invite every apartment" made, so opening an apartment
// and coming back keeps them until the admin dismisses them.
export default function AdminApartmentsLayout({
  children,
}: LayoutProps<'/[locale]/admin/apartments'>) {
  return <CreatedInvitesProvider>{children}</CreatedInvitesProvider>
}
