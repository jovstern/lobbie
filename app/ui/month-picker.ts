/**
 * Whether this browser draws a picker for `<input type="month">`. Where it does not (Firefox,
 * Safari on a Mac), the field is plain text and its hint has to spell out the format; where it
 * does, that line is noise. Client only: it asks the DOM.
 */
export function hasMonthPicker(): boolean {
  const input = document.createElement('input')
  input.setAttribute('type', 'month')
  // An input type the browser does not know reads back as "text".
  return input.type === 'month'
}
