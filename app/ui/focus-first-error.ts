/**
 * Moves focus to the first field, in `order`, that has an error, so the person lands where the
 * fix is. A radio group's first option stands for the group.
 */
export function focusFirstError(
  form: HTMLFormElement | null,
  order: readonly string[],
  errors: Partial<Record<string, string[]>> | undefined,
): void {
  const first = order.find((name) => errors?.[name]?.length)
  if (!form || !first) return
  const control = form.elements.namedItem(first)
  const target = control instanceof RadioNodeList ? control[0] : control
  if (target instanceof HTMLElement) target.focus()
}
