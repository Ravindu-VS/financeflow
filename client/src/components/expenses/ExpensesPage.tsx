import TransactionsPage from '../transactions/TransactionsPage'

/**
 * Expenses — one-time, sudden, unexpected and recurring expenses are all ordinary transactions.
 * Refunds and reimbursements are shown here because they reduce net spending.
 */
export default function ExpensesPage() {
  return <TransactionsPage fixedType={['expense', 'refund', 'reimbursement']} title="Expenses" subtitle="Everything you spent in the selected period" addMode="expense" />
}
