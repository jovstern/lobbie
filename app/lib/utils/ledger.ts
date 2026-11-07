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

/**
 * The earliest date an expense may carry: the first day of the building's billing start month
 * (`YYYY-MM`). Spending before it is part of the opening balance. (Payments may go a year
 * earlier, for apartments paying ahead; expenses never do.)
 */
export function earliestSpentOn(billingStartMonth: string): string {
  return `${billingStartMonth}-01`
}
