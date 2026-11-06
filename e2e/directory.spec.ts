import { expect, test } from './fixtures'
import { useSessionOf } from './helpers/auth'
import { messages, translator } from './helpers/copy'
import { setCommitteeContact, setContact } from './helpers/db'

// The flows are in Hebrew, the app's default language; the a11y spec covers English too.
const text = messages.he
const t = translator('he')
const resident = 'resident1@example.com'
// Seeded: noa shares her contact in the directory, avi does not. Phones are saved in E.164
// and shown as Israelis write them.
const noa = { name: 'נועה לוי', phone: '054-555-0301', tel: 'tel:+972545550301', apartment: '3' }
const avi = {
  name: 'אבי מזרחי',
  phone: '050-555-0401',
  e164: '+972505550401',
  email: 'resident3@example.com',
  apartment: '4',
}
const chair = {
  name: 'דוד כהן',
  title: 'יו״ר',
  committeePhone: '052-555-0201',
  tel: 'tel:+972525550201',
}

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
  ).toHaveAttribute('href', noa.tel)
  await expect(page.getByRole('main')).toContainText(avi.name)
  // The whole response, streamed data included: not hidden, absent.
  const html = (await response?.text()) ?? ''
  expect(html).toContain(noa.phone)
  expect(html).not.toContain(avi.phone)
  expect(html).not.toContain(avi.e164)
  expect(html).not.toContain(avi.email)

  // A search that finds avi: his row reaches the page, his contact does not.
  const main = page.getByRole('main')
  await main.getByLabel(text.Directory.searchLabel, { exact: true }).fill(avi.name)
  await expect(page).toHaveURL(`/building/directory?${new URLSearchParams({ q: avi.name })}`)
  await expect(main.getByRole('heading', { level: 3 })).toHaveText([
    t('Directory.apartment', { number: avi.apartment }),
  ])
  await expect(main).toContainText(avi.name)
  const everything = (await Promise.all(bodies)).join('\n')
  expect(everything).toContain(avi.name)
  expect(everything).not.toContain(avi.phone)
  expect(everything).not.toContain(avi.e164)
  expect(everything).not.toContain(avi.email)
})

test('a search narrows the directory, and Clear brings everyone back', async ({ page }) => {
  await useSessionOf(page, resident)
  await page.goto('/building/directory')
  const main = page.getByRole('main')
  const field = main.getByLabel(text.Directory.searchLabel, { exact: true })

  await field.fill(noa.name)
  await expect(page).toHaveURL(`/building/directory?${new URLSearchParams({ q: noa.name })}`)
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
  ).toHaveAttribute('href', chair.tel)
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

// The acceptance flows of M2: a resident opts in, a committee member publishes a contact.
const tester = {
  email: 'e2e3@example.com',
  name: 'בודק שלוש',
  seededPhone: '+972505559003',
  seededShown: '050-555-9003',
}

test('a resident adds a phone and shares it, and it appears in the directory', async ({ page }) => {
  const typed = '052 555 9013'
  const shown = '052-555-9013'
  await useSessionOf(page, tester.email)
  try {
    // Hidden at first, as seeded: the saved phone is nowhere in the document.
    const before = await page.goto('/building/directory')
    const directory = page.getByRole('main')
    await expect(directory).toContainText(tester.name)
    await expect(directory).not.toContainText(tester.seededShown)
    await expect(directory).not.toContainText(shown)
    const html = (await before?.text()) ?? ''
    expect(html).not.toContain(tester.seededPhone)
    expect(html).not.toContain(tester.seededShown)

    await page.goto('/profile')
    const main = page.getByRole('main')
    const phone = main.getByLabel(text.ProfileForm.phone, { exact: true })
    await phone.fill(typed)
    await main.getByRole('button', { name: text.ProfileForm.save, exact: true }).click()
    await expect(main.getByText(text.ProfileForm.saved, { exact: true })).toBeVisible()
    // Saved in E.164, shown as Israelis write it.
    await expect(phone).toHaveValue(shown)

    const share = main.getByRole('switch', { name: text.ContactVisibility.label, exact: true })
    await expect(share).not.toBeChecked()
    const saved = page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.url().endsWith('/profile'),
    )
    await share.click()
    await expect(share).toBeChecked()
    expect((await saved).ok()).toBe(true)

    await page.goto('/building/directory')
    await expect(
      directory.getByRole('link', { name: `${text.Contact.phone} ${shown}`, exact: true }),
    ).toHaveAttribute('href', 'tel:+972525559013')
    await expect(
      directory.getByRole('link', { name: `${text.Contact.email} ${tester.email}`, exact: true }),
    ).toBeVisible()
  } finally {
    await setContact(tester.email, { phone: tester.seededPhone, showContact: false })
  }
})

test('a committee member publishes a committee phone, and the Committee page shows it', async ({
  page,
}) => {
  // Seeded: the treasurer publishes her own phone and email for the role.
  const treasurer = {
    email: 'committee2@example.com',
    name: 'רונית ביטון',
    seeded: { phone: '+972525550601', email: 'committee2@example.com' },
  }
  const shown = '03-555-0699'
  await useSessionOf(page, treasurer.email)
  try {
    await page.goto('/profile')
    const main = page.getByRole('main')
    const committee = main.getByRole('region', { name: text.Profile.committeeTitle, exact: true })
    await expect(committee).toContainText(text.Profile.committeeLead)
    await committee.getByLabel(text.CommitteeContactForm.phone, { exact: true }).fill('03 5550699')
    await committee
      .getByRole('button', { name: text.CommitteeContactForm.save, exact: true })
      .click()
    await expect(
      committee.getByText(text.CommitteeContactForm.saved, { exact: true }),
    ).toBeVisible()

    await page.goto('/building/committee')
    const card = page
      .getByRole('main')
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { level: 2, name: treasurer.name, exact: true }) })
    await expect(
      card.getByRole('link', { name: `${text.Contact.phone} ${shown}`, exact: true }),
    ).toHaveAttribute('href', 'tel:+97235550699')
  } finally {
    await setCommitteeContact(treasurer.email, treasurer.seeded)
  }
})

test('a resident has no committee contact to publish', async ({ page }) => {
  await useSessionOf(page, resident)
  await page.goto('/profile')
  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { level: 2 })).toHaveText([
    text.Profile.detailsTitle,
    text.Profile.directoryTitle,
    text.Profile.languageTitle,
  ])
})

test('the language switch keeps the search, also in the HTML before any script runs', async ({
  page,
}) => {
  // One word: a space could be written as %20 or +.
  const q = 'נועה'
  const english = `/en/building/directory?q=${encodeURIComponent(q)}`
  await useSessionOf(page, resident)
  const response = await page.goto(`/building/directory?q=${encodeURIComponent(q)}`)
  // The document as the server sent it, streamed parts included: the switch's link carries the
  // query even if it is followed before hydration.
  expect((await response?.text()) ?? '').toContain(`href="${english}"`)

  await page
    .getByRole('banner')
    .getByRole('link', { name: messages.he.LanguageSwitch.otherLanguage, exact: true })
    .click()
  await expect(page).toHaveURL(english)
  await expect(
    page.getByRole('main').getByLabel(messages.en.Directory.searchLabel, { exact: true }),
  ).toHaveValue(q)
})
