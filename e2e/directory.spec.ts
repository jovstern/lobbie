import { expect, test } from './fixtures'
import { useSessionOf } from './helpers/auth'
import { messages, translator } from './helpers/copy'

// The flows are in Hebrew, the app's default language; the a11y spec covers English too.
const text = messages.he
const t = translator('he')
const resident = 'resident1@example.com'
// Seeded: noa shares her contact in the directory, avi does not.
const noa = { name: 'נועה לוי', phone: '054-5550301', apartment: '3' }
const avi = {
  name: 'אבי מזרחי',
  phone: '050-5550401',
  email: 'resident3@example.com',
  apartment: '4',
}
const chair = { name: 'דוד כהן', title: 'יו״ר', committeePhone: '052-5550201' }

test('a resident sees the directory by floor, with their own apartment marked', async ({
  page,
}) => {
  await useSessionOf(page, resident)
  await page.goto('/building')
  await page
    .getByRole('main')
    .getByRole('link', { name: text.BuildingHub.directory, exact: true })
    .click()
  await expect(page).toHaveURL('/building/directory')

  const main = page.getByRole('main')
  // The seed's e2e apartments are on the ground floor, apartments 1–12 on floors 1 to 4.
  await expect(main.getByRole('heading', { level: 2 })).toHaveText(
    [0, 1, 2, 3, 4].map((floor) => t('Directory.floor', { floor })),
  )
  const firstFloor = main.getByRole('region', { name: t('Directory.floor', { floor: 1 }) })
  await expect(firstFloor.getByRole('heading', { level: 3 })).toHaveText([
    `${t('Directory.apartment', { number: '1' })}, ${text.Directory.yourApartment}`,
    t('Directory.apartment', { number: '2' }),
    t('Directory.apartment', { number: '3' }),
  ])
})

test('a phone shows only when its owner shared it, and a hidden one never reaches the page', async ({
  page,
}) => {
  await useSessionOf(page, resident)
  // Every response, documents and the RSC payloads of the search's navigations alike.
  const bodies: Promise<string>[] = []
  page.on('response', (response) => {
    bodies.push(response.text().catch(() => ''))
  })
  const response = await page.goto('/building/directory')

  await expect(
    page
      .getByRole('main')
      .getByRole('link', { name: `${text.Contact.phone} ${noa.phone}`, exact: true }),
  ).toHaveAttribute('href', `tel:${noa.phone.replace(/\D/g, '')}`)
  await expect(page.getByRole('main')).toContainText(avi.name)
  // The whole response, streamed data included: not hidden, absent.
  const html = (await response?.text()) ?? ''
  expect(html).toContain(noa.phone)
  expect(html).not.toContain(avi.phone)
  expect(html).not.toContain(avi.email)

  // A search that finds avi: his row reaches the page, his contact does not.
  const main = page.getByRole('main')
  await main.getByLabel(text.Directory.searchLabel, { exact: true }).fill(avi.name)
  await expect(page).toHaveURL(`/building/directory?q=${encodeURIComponent(avi.name)}`)
  await expect(main.getByRole('heading', { level: 3 })).toHaveText([
    t('Directory.apartment', { number: avi.apartment }),
  ])
  await expect(main).toContainText(avi.name)
  const everything = (await Promise.all(bodies)).join('\n')
  expect(everything).toContain(avi.name)
  expect(everything).not.toContain(avi.phone)
  expect(everything).not.toContain(avi.email)
})

test('a search narrows the directory, and Clear brings everyone back', async ({ page }) => {
  await useSessionOf(page, resident)
  await page.goto('/building/directory')
  const main = page.getByRole('main')
  const field = main.getByLabel(text.Directory.searchLabel, { exact: true })

  await field.fill(noa.name)
  await expect(page).toHaveURL(`/building/directory?q=${encodeURIComponent(noa.name)}`)
  await expect(main.getByRole('heading', { level: 3 })).toHaveText([
    t('Directory.apartment', { number: noa.apartment }),
  ])
  await expect(main).not.toContainText(avi.name)

  await main.getByRole('button', { name: text.Search.clearLabel, exact: true }).click()
  await expect(page).toHaveURL('/building/directory')
  await expect(field).toBeFocused()
  await expect(field).toHaveValue('')
  await expect(main).toContainText(avi.name)

  await page.goto('/building/directory?q=nobody-here')
  await expect(
    main.getByRole('heading', {
      level: 2,
      name: t('Directory.noResultsTitle', { q: 'nobody-here' }),
      exact: true,
    }),
  ).toBeVisible()
})

test('the committee page leads with the chair and their committee contact', async ({ page }) => {
  await useSessionOf(page, resident)
  await page.goto('/building/committee')
  const main = page.getByRole('main')

  const cards = main.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 2 }) })
  const first = cards.first()
  await expect(first.getByRole('heading', { level: 2 })).toHaveText(chair.name)
  await expect(first).toContainText(chair.title)
  await expect(
    first.getByRole('link', {
      name: `${text.Contact.phone} ${chair.committeePhone}`,
      exact: true,
    }),
  ).toHaveAttribute('href', `tel:${chair.committeePhone.replace(/\D/g, '')}`)
  // The seeded admin publishes no committee contact.
  await expect(main).toContainText(text.Committee.noContact)
})

for (const path of ['/building', '/building/directory', '/building/committee']) {
  test(`the Building tab is current on ${path}`, async ({ page, isMobile }) => {
    await useSessionOf(page, resident)
    await page.goto(path)

    const nav = page.getByTestId(isMobile ? 'tab-bar' : 'side-nav')
    await expect(nav.getByRole('link', { name: text.Nav.building, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(nav.getByRole('link', { name: text.Nav.home, exact: true })).not.toHaveAttribute(
      'aria-current',
    )
  })
}
