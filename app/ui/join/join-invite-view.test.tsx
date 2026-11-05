import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { JoinView } from '@/app/lib/utils/join-view'
import JoinInviteView from '@/app/ui/join/join-invite-view'
import en from '@/messages/en.json'

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string
    children: ReactNode
    className: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

const copy = en.JoinInvite
const place = { buildingName: 'Rimon 12', apartmentNumber: '7' }

function renderView(view: JoinView) {
  const redeemAction = vi.fn(async () => ({}))
  render(
    <NextIntlClientProvider locale="en" messages={{ JoinInvite: copy }}>
      <JoinInviteView
        view={view}
        redeemAction={redeemAction}
        signInHref="/sign-in?next=%2Fjoin%2FABCDE23456"
      />
    </NextIntlClientProvider>,
  )
  return redeemAction
}

const heading = () => screen.getByRole('heading', { level: 1 })

describe('JoinInviteView', () => {
  it('offers to join the apartment it names', () => {
    renderView({ kind: 'valid', ...place })
    expect(heading()).toHaveTextContent('You’re invited to apartment 7 in Rimon 12')
    expect(screen.getByRole('button', { name: 'Join apartment 7' })).toBeEnabled()
  })

  it('sends a signed-out visitor to sign in, and back', () => {
    renderView({ kind: 'sign-in', ...place })
    expect(heading()).toHaveTextContent('apartment 7 in Rimon 12')
    expect(screen.getByText(copy.signInLead)).toBeVisible()
    expect(screen.getByRole('link', { name: copy.signIn })).toHaveAttribute(
      'href',
      '/sign-in?next=%2Fjoin%2FABCDE23456',
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it.each([
    ['invalid', copy.invalidTitle, copy.invalidBody],
    ['expired', copy.expiredTitle, copy.expiredBody],
    ['full', copy.fullTitle, copy.fullBody],
    ['revoked', copy.revokedTitle, copy.revokedBody],
  ] as const)('explains a %s invite without naming its apartment', (kind, title, body) => {
    renderView({ kind })
    expect(heading()).toHaveTextContent(title)
    expect(screen.getByText(body)).toBeVisible()
    expect(screen.queryByText(/apartment 7/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: copy.enterCode })).toHaveAttribute('href', '/join')
  })

  it('sends someone already in the apartment home', () => {
    renderView({ kind: 'already-member', ...place })
    expect(heading()).toHaveTextContent('You’re already in apartment 7')
    expect(screen.getByRole('link', { name: copy.goHome })).toHaveAttribute('href', '/')
  })

  it('refuses a member of another building, naming theirs', () => {
    renderView({ kind: 'other-building', buildingName: 'Elsewhere 3' })
    expect(heading()).toHaveTextContent(copy.otherTitle)
    expect(screen.getByText(/member of Elsewhere 3/)).toBeVisible()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('asks a visitor who tried too many links to wait, offering nothing to click', () => {
    renderView({ kind: 'rate-limited', minutes: 12 })
    expect(heading()).toHaveTextContent(copy.rateLimitedTitle)
    expect(screen.getByText(/wait 12 minutes/)).toBeVisible()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
