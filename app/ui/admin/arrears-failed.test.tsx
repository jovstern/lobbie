import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import ArrearsFailed from '@/app/ui/admin/arrears-failed'
import en from '@/messages/en.json'

describe('ArrearsFailed', () => {
  it('says the list failed, under its title, and tries again', async () => {
    const retry = vi.fn()
    render(
      <NextIntlClientProvider locale="en" messages={{ ErrorPage: en.ErrorPage }}>
        <ArrearsFailed
          title={en.AdminPayments.arrearsTitle}
          message={en.AdminPayments.arrearsFailed}
          retry={retry}
        />
      </NextIntlClientProvider>,
    )

    expect(screen.getByRole('region', { name: en.AdminPayments.arrearsTitle })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(en.AdminPayments.arrearsFailed)
    await userEvent.click(screen.getByRole('button', { name: en.ErrorPage.retry }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
