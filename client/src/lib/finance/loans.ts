/**
 * Loans you took (borrowed) and loans you gave (lent).
 * The amount borrowed/lent and each repayment are ordinary transactions linked by `loanId`:
 *   borrowed → loan_received (+cash), loan_repayment (−cash)
 *   lent     → loan_given    (−cash), loan_collected (+cash)
 * None of these are income or expenses. Interest you pay is recorded as an expense (category
 * "loan_interest"); interest you receive as income (category "interest").
 */
import type { Loan, Transaction } from './types'
import { round2 } from './aggregate'
import { diffDays } from './dates'

export interface LoanStatus {
  loan: Loan
  /** Amount actually borrowed/lent (from transactions; falls back to the loan's principal) */
  principal: number
  repaid: number
  outstanding: number
  pct: number
  interest: number
  overdueDays: number | null
  dueInDays: number | null
  repayments: Transaction[]
  status: Loan['status']
}

const counted = (t: Transaction) => t.status !== 'void'

export function loanStatus(loan: Loan, txs: Transaction[], today: string): LoanStatus {
  const mine = txs.filter(t => t.loanId === loan.id && counted(t))
  const openType = loan.direction === 'borrowed' ? 'loan_received' : 'loan_given'
  const repayType = loan.direction === 'borrowed' ? 'loan_repayment' : 'loan_collected'
  const opened = mine.filter(t => t.type === openType).reduce((s, t) => s + t.amount, 0)
  const principal = round2(opened || loan.principal || 0)
  const repayments = mine.filter(t => t.type === repayType).sort((a, b) => b.date.localeCompare(a.date))
  const repaid = round2(repayments.reduce((s, t) => s + t.amount, 0))
  const interest = round2(mine.filter(t => (t.type === 'expense' || t.type === 'income')).reduce((s, t) => s + t.amount, 0))
  const closed = loan.status !== 'active'
  const outstanding = closed ? 0 : round2(Math.max(0, principal - repaid))
  const due = loan.dueDate && !closed && outstanding > 0 ? diffDays(today, loan.dueDate) : null
  return {
    loan, principal, repaid, outstanding, interest, repayments,
    pct: principal ? Math.min(100, Math.round((closed ? principal : repaid) / principal * 100)) : 0,
    overdueDays: due != null && due < 0 ? -due : null,
    dueInDays: due != null && due >= 0 ? due : null,
    status: loan.status,
  }
}

export function loanTotals(loans: Loan[], txs: Transaction[], today: string) {
  let owedToYou = 0, youOwe = 0, overdue = 0
  for (const l of loans) {
    const s = loanStatus(l, txs, today)
    if (l.direction === 'lent') owedToYou += s.outstanding; else youOwe += s.outstanding
    if (s.overdueDays) overdue++
  }
  return { owedToYou: round2(owedToYou), youOwe: round2(youOwe), overdue }
}

/** Should the loan be marked repaid after this repayment? */
export const isFullyRepaid = (s: LoanStatus) => s.principal > 0 && s.repaid >= s.principal - 0.005

/** Loan balances as they stood at the end of `date` (for month-end net worth snapshots). */
export function loanTotalsAsOf(loans: Loan[], txs: Transaction[], date: string) {
  const asOf = loans
    .filter(l => l.startDate <= date)
    .map(l => (l.status !== 'active' && l.closedDate && l.closedDate > date ? { ...l, status: 'active' as const } : l))
  return loanTotals(asOf, txs.filter(t => t.date <= date), date)
}
