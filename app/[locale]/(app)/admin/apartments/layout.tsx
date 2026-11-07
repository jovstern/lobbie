import CreatedInvitesProvider from '@/app/ui/admin/created-invites-provider'
import ClientMessages from '@/app/ui/client-messages'

// The apartments pages share the links "Invite every apartment" made, so opening an apartment
// and coming back keeps them until the admin dismisses them. Their client components' copy:
// the list's and one apartment's (its residents, invite, fee and payments).
export default function AdminApartmentsLayout({
  children,
}: LayoutProps<'/[locale]/admin/apartments'>) {
  return (
    <ClientMessages
      namespaces={[
        'ApartmentForm',
        'ApartmentRemove',
        'CopyButton',
        'FeeForm',
        'InviteAdminClient',
        'InviteAll',
        'PaymentForm',
        'PaymentMethods',
        'ResidentsClient',
        'VoidPayment',
      ]}
    >
      <CreatedInvitesProvider>{children}</CreatedInvitesProvider>
    </ClientMessages>
  )
}
