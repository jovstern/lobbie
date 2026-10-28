import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { z } from 'zod'

const greetingSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
})

// Reference pattern for every form: TanStack Form + a Zod schema as the validator.
export function GreetingForm() {
  const [greeting, setGreeting] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { name: '' },
    validators: { onSubmit: greetingSchema },
    onSubmit: ({ value }) => {
      setGreeting(`Hello, ${value.name.trim()}!`)
    },
  })

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <form.Field name="name">
        {(field) => {
          const error = field.state.meta.errors[0]?.message
          return (
            <div className="flex flex-col gap-1">
              <label htmlFor={field.name} className="text-sm font-medium">
                Name
              </label>
              <input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  field.handleChange(event.target.value)
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${field.name}-error` : undefined}
                className="rounded border border-gray-300 px-3 py-2"
              />
              {error ? (
                <p id={`${field.name}-error`} role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              ) : null}
            </div>
          )
        }}
      </form.Field>

      <button type="submit" className="rounded bg-black px-4 py-2 text-white">
        Greet
      </button>

      {greeting ? <p role="status">{greeting}</p> : null}
    </form>
  )
}
