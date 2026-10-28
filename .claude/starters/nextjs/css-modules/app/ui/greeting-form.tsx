'use client'

import { useActionState } from 'react'
import { greet, type GreetingState } from '@/app/lib/actions'
import styles from './greeting-form.module.css'

// Reference pattern for every form (Next.js Learn, chapter 13): useActionState + a Server
// Action, label tied to the input, errors in an aria-live region linked by aria-describedby.
export default function GreetingForm() {
  const initialState: GreetingState = { message: null, errors: {} }
  const [state, formAction, isPending] = useActionState(greet, initialState)

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="name" className={styles.label}>
          Your name
        </label>
        <input
          id="name"
          name="name"
          className={styles.input}
          aria-describedby="name-error"
        />
        <div id="name-error" aria-live="polite" aria-atomic="true">
          {state.errors?.name?.map((error) => (
            <p key={error} className={styles.error}>
              {error}
            </p>
          ))}
        </div>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className={styles.button}
      >
        Say hello
      </button>
      {state.message ? <p>{state.message}</p> : null}
    </form>
  )
}
