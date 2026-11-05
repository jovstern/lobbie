import type { InputHTMLAttributes } from 'react'

const inputClassName =
  'rounded-control border-text-muted bg-surface text-text hover:border-text focus-visible:border-accent aria-invalid:border-danger min-h-11 w-full border px-3 text-base transition-[background-color,border-color,color]'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'aria-describedby'> & {
  /** Also the input's id, so it must be unique on the page. */
  name: string
  label: string
  /** How to fill it in, read with the label. */
  hint?: string
  /** From the Server Action; announced as they appear. */
  errors?: string[]
}

/** A labelled input with its hint and its errors, which the input points to. */
export default function TextField({ name, label, hint, errors, ...inputProps }: Props) {
  const hintId = `${name}-hint`
  const errorId = `${name}-error`

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        {...inputProps}
        id={name}
        name={name}
        aria-describedby={hint ? `${hintId} ${errorId}` : errorId}
        aria-invalid={errors?.length ? true : undefined}
        className={inputClassName}
      />
      {hint ? (
        <p id={hintId} className="text-text-muted text-sm">
          {hint}
        </p>
      ) : null}
      <div id={errorId} aria-live="polite" aria-atomic="true">
        {errors?.map((error) => (
          <p key={error} className="text-danger text-sm">
            {error}
          </p>
        ))}
      </div>
    </div>
  )
}
