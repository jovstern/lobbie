import clsx from 'clsx'

export type ButtonVariant = 'primary' | 'secondary'

// The outline colour is not transitioned, so the focus ring appears at once instead of
// fading in from the text colour.
const base =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-5 text-base font-medium transition-[background-color,border-color,color] disabled:cursor-wait disabled:opacity-70'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent/90 active:bg-accent/80',
  secondary:
    'border border-text-muted bg-surface-raised text-text hover:bg-surface active:bg-border',
}

/** The classes of a button, or of a link that looks like one. */
export function buttonClassName(variant: ButtonVariant): string {
  return clsx(base, variants[variant])
}
