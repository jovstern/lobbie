/** The building fund: the single definition of how its balance is computed. */
export function balance({
  openingBalanceAgorot,
  adjustmentsAgorot,
  paymentsAgorot,
  expensesAgorot,
}: {
  openingBalanceAgorot: number
  adjustmentsAgorot: number
  paymentsAgorot: number
  expensesAgorot: number
}): number {
  return openingBalanceAgorot + adjustmentsAgorot + paymentsAgorot - expensesAgorot
}
