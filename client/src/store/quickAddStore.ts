import { create } from 'zustand'
import type { Transaction, TransactionType } from '../lib/finance'

export type QuickAddMode = TransactionType | 'bill'

interface QuickAddState {
  isOpen: boolean
  mode: QuickAddMode
  prefill: Partial<Transaction> | null
  editing: Transaction | null
  open: (mode?: QuickAddMode, prefill?: Partial<Transaction>) => void
  edit: (t: Transaction) => void
  close: () => void
}

/** One global transaction form, opened from Quick Add, pages, voice and receipts. */
export const useQuickAdd = create<QuickAddState>(set => ({
  isOpen: false,
  mode: 'expense',
  prefill: null,
  editing: null,
  open: (mode = 'expense', prefill) => set({ isOpen: true, mode, prefill: prefill || null, editing: null }),
  edit: t => set({ isOpen: true, mode: t.type, prefill: null, editing: t }),
  close: () => set({ isOpen: false, prefill: null, editing: null }),
}))
