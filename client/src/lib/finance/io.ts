/**
 * Import / export of transactions (CSV + JSON). Imports are validated row-by-row
 * before anything is written; duplicates are detected against existing data.
 */
import type { Transaction, TransactionType } from './types'
import { TRANSACTION_TYPES } from './types'
import { validateTransaction, partitionDuplicates } from './detection'
import { isValidDateKey, toDateKey } from './dates'
import { mapLegacyExpenseCategory, mapLegacyIncomeCategory, categoryLabel } from './categories'
import { round2 } from './aggregate'

export const CSV_COLUMNS = ['date', 'time', 'type', 'amount', 'currency', 'base_amount', 'category', 'subcategory', 'description', 'merchant', 'account', 'payment_method', 'tags', 'notes', 'status', 'source'] as const

function esc(v: unknown): string {
  const s = v == null ? '' : String(v)
  // Neutralise spreadsheet formula injection
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCSV(txs: Transaction[], accountName: (id?: string) => string = id => id || ''): string {
  const rows = [CSV_COLUMNS.join(',')]
  for (const t of [...txs].sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push([
      t.date, t.time || '', t.type, t.originalAmount ?? t.amount, t.currency, t.baseAmount ?? t.amount, categoryLabel(t.category), t.subcategory || '', t.description || '',
      t.merchant || '', accountName(t.accountId), t.paymentMethod || '', (t.tags || []).join(';'), t.notes || '', t.status, t.source,
    ].map(esc).join(','))
  }
  return rows.join('\n')
}

/** RFC-4180-ish CSV parser (quotes, escaped quotes, CRLF). */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else q = false }
      else field += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(x => x.trim() !== ''))
}

function normDate(s: string): string | null {
  s = s.trim()
  if (isValidDateKey(s as unknown)) return s
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/) // DD/MM/YYYY (Sri Lankan default)
  if (m) { const k = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; return isValidDateKey(k) ? k : null }
  m = s.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/)
  if (m) { const k = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`; return isValidDateKey(k) ? k : null }
  const t = Date.parse(s)
  return isNaN(t) ? null : toDateKey(new Date(t))
}

export interface ImportRow { row: number; tx?: Omit<Transaction, 'id'>; errors: string[]; warnings: string[] }
export interface ImportPreview { rows: ImportRow[]; valid: Omit<Transaction, 'id'>[]; duplicates: Omit<Transaction, 'id'>[]; invalid: ImportRow[] }

/**
 * Accepts the app's own export format and common bank-statement shapes:
 *  - `type` column, or signed `amount`, or separate `debit`/`credit` columns.
 */
export function previewCSVImport(text: string, existing: Transaction[], opts: { accountId?: string; currency?: string; today?: string } = {}): ImportPreview {
  const grid = parseCSV(text.replace(/^﻿/, ''))
  if (!grid.length) return { rows: [], valid: [], duplicates: [], invalid: [] }
  const header = grid[0].map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
  const col = (...names: string[]) => names.map(n => header.indexOf(n)).find(i => i >= 0) ?? -1
  const ci = {
    date: col('date', 'transaction_date', 'posting_date', 'value_date'),
    time: col('time'),
    type: col('type'),
    amount: col('amount', 'value'),
    debit: col('debit', 'withdrawal', 'withdrawals', 'dr'),
    credit: col('credit', 'deposit', 'deposits', 'cr'),
    currency: col('currency'),
    category: col('category'),
    subcategory: col('subcategory'),
    description: col('description', 'details', 'narration', 'particulars', 'memo'),
    merchant: col('merchant', 'payee', 'payer'),
    tags: col('tags'),
    notes: col('notes'),
    paymentMethod: col('payment_method'),
  }
  const rows: ImportRow[] = []
  for (let r = 1; r < grid.length; r++) {
    const g = grid[r]
    const v = (i: number) => (i >= 0 ? (g[i] ?? '').trim() : '')
    const errors: string[] = [], warnings: string[] = []
    const date = normDate(v(ci.date))
    let type = v(ci.type).toLowerCase().replace(/\s+/g, '_') as TransactionType
    let amount = parseFloat(v(ci.amount).replace(/[^0-9.\-]/g, ''))
    if (ci.debit >= 0 || ci.credit >= 0) {
      const dr = parseFloat(v(ci.debit).replace(/[^0-9.]/g, '')) || 0
      const cr = parseFloat(v(ci.credit).replace(/[^0-9.]/g, '')) || 0
      if (dr && !cr) { amount = dr; type = type || 'expense' }
      else if (cr && !dr) { amount = cr; type = type || 'income' }
    }
    if (!TRANSACTION_TYPES.includes(type)) {
      if (isFinite(amount)) { type = amount < 0 ? 'expense' : 'income'; warnings.push('Type inferred from amount sign') }
    }
    amount = Math.abs(amount)
    const rawCat = v(ci.category)
    const category = type === 'income' ? mapLegacyIncomeCategory(rawCat) : mapLegacyExpenseCategory(rawCat)
    if (!rawCat && (type === 'income' || type === 'expense')) warnings.push('No category — set to Other')
    const tx: Omit<Transaction, 'id'> = {
      type, amount: round2(amount), currency: v(ci.currency) || opts.currency || 'LKR', date: date || '',
      time: v(ci.time) || undefined, category, subcategory: v(ci.subcategory) || undefined,
      description: v(ci.description) || undefined, merchant: v(ci.merchant) || undefined,
      tags: v(ci.tags) ? v(ci.tags).split(/[;|]/).map(s => s.trim()).filter(Boolean) : undefined,
      notes: v(ci.notes) || undefined, paymentMethod: v(ci.paymentMethod) || undefined,
      accountId: opts.accountId, status: 'cleared', source: 'imported',
    }
    for (const i of validateTransaction(tx, { today: opts.today })) (i.severity === 'error' ? errors : warnings).push(i.message)
    rows.push({ row: r + 1, tx: errors.length ? undefined : tx, errors, warnings })
  }
  const ok = rows.filter(r => r.tx).map(r => r.tx!)
  const { fresh, dupes } = partitionDuplicates(ok, existing)
  return { rows, valid: fresh, duplicates: dupes, invalid: rows.filter(r => r.errors.length) }
}

export function previewJSONImport(text: string, existing: Transaction[], opts: { accountId?: string; today?: string } = {}): ImportPreview {
  let data: any
  try { data = JSON.parse(text) } catch { return { rows: [{ row: 0, errors: ['Invalid JSON'], warnings: [] }], valid: [], duplicates: [], invalid: [{ row: 0, errors: ['Invalid JSON'], warnings: [] }] } }
  const list: any[] = Array.isArray(data) ? data : Array.isArray(data?.transactions) ? data.transactions : []
  const rows: ImportRow[] = list.map((x, i) => {
    const tx: Omit<Transaction, 'id'> = {
      type: x.type, amount: round2(Math.abs(Number(x.amount))), currency: x.currency || 'LKR', date: normDate(String(x.date || '')) || '',
      time: x.time, category: x.category || 'other', subcategory: x.subcategory, description: x.description, merchant: x.merchant,
      tags: Array.isArray(x.tags) ? x.tags : undefined, notes: x.notes, paymentMethod: x.paymentMethod,
      accountId: opts.accountId || x.accountId, status: x.status === 'void' ? 'void' : 'cleared', source: 'imported',
    }
    const issues = validateTransaction(tx, { today: opts.today })
    const errors = issues.filter(i => i.severity === 'error').map(i => i.message)
    return { row: i + 1, tx: errors.length ? undefined : tx, errors, warnings: issues.filter(i => i.severity === 'warning').map(i => i.message) }
  })
  const ok = rows.filter(r => r.tx).map(r => r.tx!)
  const { fresh, dupes } = partitionDuplicates(ok, existing)
  return { rows, valid: fresh, duplicates: dupes, invalid: rows.filter(r => r.errors.length) }
}
