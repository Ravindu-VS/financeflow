/**
 * Receipt text → draft transaction. Works on OCR output (tesseract.js) or pasted text.
 * Nothing here is saved automatically: the result pre-fills the transaction form for the user
 * to confirm, and every field carries how sure we are.
 */
import { parseFinancialText } from './voiceParser'
import { isValidDateKey, pad, todayKey } from './dates'

export interface ReceiptDraft {
  amount: number | null
  date: string | null
  merchant: string | null
  category: string | null
  items: { name: string; amount: number }[]
  /** 0–1 — how much of the receipt we could read with certainty */
  confidence: number
  warnings: string[]
}

const NUM = /(?:rs\.?|lkr|\$|usd)?\s*(\d{1,3}(?:[,\s]\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 }
const TOTAL_STRONG = /\b(grand\s*total|net\s*total|total\s*(?:amount|due|payable)|amount\s*(?:due|payable)|balance\s*due|to\s*pay|net\s*amount)\b/i
const TOTAL_WEAK = /\btotal\b/i
const NOT_TOTAL = /\b(sub\s*-?\s*total|total\s*(?:items|qty|quantity|savings|discount)|tax|vat|cash|change|tendered|card\s*no|tel|phone)\b/i
const SKIP_MERCHANT = /\b(receipt|invoice|tax|bill\s*no|tel|phone|date|time|cashier|www\.|https?:|@|vat\s*reg|thank)\b/i

function numbersIn(line: string): number[] {
  const out: number[] = []
  for (const m of line.matchAll(NUM)) {
    const n = Number(m[1].replace(/[,\s]/g, ''))
    if (Number.isFinite(n) && n > 0) out.push(n)
  }
  return out
}

/** Parse a date in common receipt formats. Sri Lankan receipts are day-first (dd/mm/yyyy). */
export function parseReceiptDate(text: string, today: string = todayKey()): string | null {
  const y4 = (y: number) => (y < 100 ? 2000 + y : y)
  const make = (y: number, m: number, d: number) => {
    const k = `${y4(y)}-${pad(m)}-${pad(d)}`
    return isValidDateKey(k) && k <= today ? k : null
  }
  let m = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/)
  if (m) { const k = make(+m[1], +m[2], +m[3]); if (k) return k }
  m = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/)
  if (m) {
    const a = +m[1], b = +m[2], y = +m[3]
    // day-first unless that is impossible
    const k = a > 12 || b <= 12 ? make(y, b, a) : make(y, a, b)
    if (k) return k
    const alt = make(y, a, b); if (alt) return alt
  }
  m = text.match(/\b(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*[\s,.-]*(\d{2,4})\b/i)
  if (m) { const k = make(+m[3], MONTHS[m[2].toLowerCase()], +m[1]); if (k) return k }
  m = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\s*(\d{1,2}),?\s*(\d{2,4})\b/i)
  if (m) { const k = make(+m[3], MONTHS[m[1].toLowerCase()], +m[2]); if (k) return k }
  return null
}

export function parseReceiptText(raw: string, today: string = todayKey()): ReceiptDraft {
  const lines = raw.split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const warnings: string[] = []

  // ── total ──
  let amount: number | null = null
  let amountSure = false
  const strong = lines.filter(l => TOTAL_STRONG.test(l) && !/sub\s*-?\s*total/i.test(l))
  const weak = lines.filter(l => TOTAL_WEAK.test(l) && !NOT_TOTAL.test(l))
  const pick = (ls: string[]) => {
    for (let i = ls.length - 1; i >= 0; i--) { const n = numbersIn(ls[i]); if (n.length) return n[n.length - 1] }
    return null
  }
  amount = pick(strong); amountSure = amount != null
  if (amount == null) { amount = pick(weak); amountSure = amount != null }
  if (amount == null) {
    const all = lines.filter(l => !/\b(tel|phone|no\.?|#|reg)\b/i.test(l)).flatMap(numbersIn).filter(n => n < 1e7)
    amount = all.length ? Math.max(...all) : null
    if (amount != null) warnings.push('No "total" line found — used the largest amount; please check it.')
  }

  // ── line items: "name ... 1,250.00" ──
  const items: { name: string; amount: number }[] = []
  for (const l of lines) {
    if (TOTAL_WEAK.test(l) || TOTAL_STRONG.test(l) || NOT_TOTAL.test(l)) continue
    const m = l.match(/^([A-Za-z][A-Za-z0-9 &'./-]{1,40}?)\s+(?:\d+\s*[x@]\s*[\d.,]+\s+)?(\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2})$/)
    if (m) items.push({ name: m[1].trim(), amount: Number(m[2].replace(/,/g, '')) })
  }

  // ── merchant: first meaningful line near the top ──
  const merchant = lines.slice(0, 6).find(l => /[a-z]{3,}/i.test(l) && !SKIP_MERCHANT.test(l) && numbersIn(l).length === 0 && l.length <= 48) || null

  const date = parseReceiptDate(raw, today)
  if (!date) warnings.push('Date not found — today will be used unless you change it.')

  const guess = parseFinancialText(`spent on ${merchant || ''} ${items.map(i => i.name).join(' ')}`, today)
  const category = guess.category && guess.category !== 'other' ? guess.category : null

  const confidence = Math.round(((amountSure ? 0.5 : amount != null ? 0.2 : 0) + (date ? 0.2 : 0) + (merchant ? 0.2 : 0) + (category ? 0.1 : 0)) * 100) / 100
  if (amount == null) warnings.push('Could not read an amount.')
  return { amount, date, merchant, category, items: items.slice(0, 30), confidence, warnings }
}
