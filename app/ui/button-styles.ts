import clsx from 'clsx'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'danger-outline'

// The outline colour is not transitioned, so the focus ring appears at once instead of
// fading in from the text colour.
const base =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-5 text-base font-medium transition-[background-color,border-color,color] disabled:cursor-wait disabled:opacity-70'

const variants: Record<ButtonVariant, string> = {
  // Hover and press move away from the text colour (a translucent fill would move towards
  // it and fall below AA).
  primary: 'bg-accent text-on-accent hover:bg-accent-strong active:bg-accent-strong',
  secondary:
    'border border-text-muted bg-surface-raised text-text hover:bg-surface active:bg-border',
  // For the confirming button of a destructive action; on-accent text meets AA on it too.
  danger: 'bg-danger text-on-accent hover:bg-danger-strong active:bg-danger-strong',
  // A destructive choice offered beside a safer, recommended one, which keeps the fill.
  'danger-outline':
    'border border-danger bg-surface-raised text-danger hover:bg-surface active:bg-border',
}

/** The classes of a button, or of a link that looks like one. */
export function buttonClassName(variant: ButtonVariant): string {
  return clsx(base, variants[variant])
}
