import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { GreetingForm } from './GreetingForm'

test('greets the user by name', async () => {
  const user = userEvent.setup()
  render(<GreetingForm />)

  await user.type(screen.getByLabelText('Name'), 'Ada')
  await user.click(screen.getByRole('button', { name: 'Greet' }))

  expect(await screen.findByRole('status')).toHaveTextContent('Hello, Ada!')
})

test('rejects a name that is too short', async () => {
  const user = userEvent.setup()
  render(<GreetingForm />)

  await user.type(screen.getByLabelText('Name'), 'A')
  await user.click(screen.getByRole('button', { name: 'Greet' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('at least 2 characters')
})
