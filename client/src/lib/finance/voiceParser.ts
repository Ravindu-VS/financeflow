/**
 * Client-side natural-language → transaction preview.
 * Works offline and without the AI backend. Output is ALWAYS a preview that the user
 * confirms in the normal transaction form; nothing is saved directly.
 *
 * Examples:
 *   "Spent 500 on lunch"                     → expense 500, food_dining, today
 *   "Received 15,000 from freelance work"    → income 15000, freelance
 *   "Invested 20,000 in a fixed deposit"     → investment 20000, fixed_deposit
 *   "Paid 3,500 for vehicle repair yesterday"→ expense 3500, transport/Vehicle Repair, yesterday
 *   "Saved 5000 to emergency fund"           → savings_contribution 5000
 *   "Transfer 20000 from bank to savings"    → transfer 20000
 */
import type { TransactionType } from './types'
import { addDays, todayKey } from './dates'

export interface ParsedEntry {
  type: TransactionType | null
  amount: number | null
  category: string | null
  subcategory?: string
  description: string
  date: string
  confidence: number
  isUnexpected?: boolean
  fromAccountHint?: string
  toAccountHint?: string
  goalHint?: string
}

const WORD_NUM: Record<string, number> = { thousand: 1_000, k: 1_000, lakh: 100_000, lakhs: 100_000, lac: 100_000, million: 1_000_000, mn: 1_000_000 }

export function extractAmount(text: string): number | null {
  const t = text.toLowerCase().replace(/rs\.?|lkr|rupees?|₹|\$/g, ' ')
  const m = t.match(/(\d{1,3}(?:[,\s]\d{3})+|\d+(?:\.\d+)?)\s*(thousand|k|lakhs?|lac|million|mn)?\b/)
  if (!m) return null
  let n = parseFloat(m[1].replace(/[,\s]/g, ''))
  if (m[2]) n *= WORD_NUM[m[2]] || 1
  return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

const EXPENSE_KEYWORDS: [RegExp, string, string?][] = [
  [/\b(lunch|dinner|breakfast|meal|restaurant|cafe|coffee|kottu|rice and curry|food|snack|pizza|burger)\b/, 'food_dining'],
  [/\b(grocer(y|ies)|supermarket|keells|cargills|arpico|vegetables?)\b/, 'groceries'],
  [/\b(vehicle|car|bike|motorbike|tyre|tire)\s*(repair|service|maintenance)|mechanic|garage\b/, 'transport', 'Vehicle Repair'],
  [/\b(fuel|petrol|diesel|gas station)\b/, 'fuel'],
  [/\b(bus|train|taxi|uber|pickme|tuk|three.?wheeler|parking|transport)\b/, 'transport'],
  [/\b(rent|mortgage|house|apartment)\b/, 'housing'],
  [/\b(electricity|water bill|ceb|leco|utility|utilities)\b/, 'utilities'],
  [/\b(internet|mobile|phone bill|data|reload|dialog|mobitel|hutch|airtel|slt)\b/, 'internet_mobile'],
  [/\b(doctor|hospital|medicine|pharmacy|medical|clinic|dentist)\b/, 'healthcare'],
  [/\b(school|tuition|course|books?|university|class|fees?)\b/, 'education'],
  [/\b(movie|cinema|game|concert|netflix|entertainment)\b/, 'entertainment'],
  [/\b(subscription|spotify|youtube premium|icloud|prime)\b/, 'subscriptions'],
  [/\b(clothes|shoes|shopping|amazon|daraz|gadget|laptop|phone)\b/, 'shopping'],
  [/\b(flight|hotel|trip|travel|vacation)\b/, 'travel'],
  [/\b(salon|haircut|cosmetics|personal care)\b/, 'personal_care'],
  [/\b(gift|present|donation)\b/, 'gifts'],
  [/\b(insurance|premium)\b/, 'insurance'],
  [/\b(tax|taxes)\b/, 'taxes'],
  [/\b(loan|emi|credit card bill|debt)\b/, 'debt'],
  [/\b(emergency|urgent)\b/, 'emergency'],
]

const INCOME_KEYWORDS: [RegExp, string][] = [
  [/\b(salary|pay ?check|payroll|wage)\b/, 'salary'],
  [/\b(freelanc\w*|upwork|fiverr|client|project|gig)\b/, 'freelance'],
  [/\b(business|sales|shop)\b/, 'business'],
  [/\bbonus\b/, 'bonus'],
  [/\binterest\b/, 'interest'],
  [/\bdividends?\b/, 'dividend'],
  [/\brent(al)? income\b/, 'rental'],
  [/\b(gift|from (a |my )?(friend|mother|father|mom|dad|parents|brother|sister))\b/, 'gift'],
]

const INVEST_KEYWORDS: [RegExp, string][] = [
  [/\b(fixed deposit|fd)\b/, 'fixed_deposit'],
  [/\b(stocks?|shares?|cse|equity)\b/, 'stocks'],
  [/\b(mutual funds?|unit trust)\b/, 'mutual_funds'],
  [/\b(bonds?|treasury|t-?bills?)\b/, 'bonds'],
  [/\betfs?\b/, 'etf'],
  [/\bgold\b/, 'gold'],
  [/\b(crypto|bitcoin|btc|eth)\b/, 'crypto'],
]

function detectDate(t: string, today: string): string {
  if (/\bday before yesterday\b/.test(t)) return addDays(today, -2)
  if (/\byesterday\b/.test(t)) return addDays(today, -1)
  const ago = t.match(/\b(\d+)\s+days?\s+ago\b/)
  if (ago) return addDays(today, -Number(ago[1]))
  const iso = t.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  if (iso) return iso[1]
  return today
}

export function parseFinancialText(input: string, today: string = todayKey()): ParsedEntry {
  const text = input.trim()
  const t = text.toLowerCase()
  const amount = extractAmount(t)
  const date = detectDate(t, today)
  let type: TransactionType | null = null
  let category: string | null = null
  let subcategory: string | undefined
  let fromAccountHint: string | undefined, toAccountHint: string | undefined, goalHint: string | undefined
  let conf = 0.3

  const match = <T extends string>(list: [RegExp, T, string?][]) => list.find(([re]) => re.test(t))

  if (/\btransfer(red)?\b|\bmoved?\b.*\bto\b/.test(t)) {
    type = 'transfer'; category = 'transfer'
    const fm = t.match(/from\s+(?:my\s+)?([a-z ]+?)\s+(?:to|into)\s+(?:my\s+)?([a-z ]+?)(?:\s+(?:account|today|yesterday)|$)/)
    if (fm) { fromAccountHint = fm[1].trim(); toAccountHint = fm[2].trim(); conf += 0.2 }
  } else if (/\brefund(ed)?\b/.test(t)) {
    type = 'refund'; category = match(EXPENSE_KEYWORDS)?.[1] || 'other'
  } else if (/\breimburs\w*\b/.test(t)) {
    type = 'reimbursement'; category = match(EXPENSE_KEYWORDS)?.[1] || 'other'
  } else if (/\b(invest(ed|ing)?|bought (shares|stocks|gold|bonds|units))\b/.test(t)) {
    type = 'investment'; category = match(INVEST_KEYWORDS)?.[1] || 'other_investment'
  } else if (/\b(sav(e|ed|ing)|put aside|set aside)\b/.test(t) && !/\bspent\b/.test(t)) {
    type = 'savings_contribution'; category = 'savings'
    const g = t.match(/\b(?:to|into|for)\s+(?:my\s+|the\s+)?([a-z ]+?)(?:\s+(?:goal|fund))?(?:\s+(?:today|yesterday)|$)/)
    if (g) goalHint = g[1].trim()
  } else if (/\b(received|got paid|earned|income|credited|salary|bonus)\b/.test(t) || match(INCOME_KEYWORDS)?.[1] === 'salary') {
    type = 'income'; category = match(INCOME_KEYWORDS)?.[1] || 'other_income'
  } else if (/\b(spent|paid|bought|purchased|expense|cost|bill|pay)\b/.test(t) || match(EXPENSE_KEYWORDS)) {
    type = 'expense'
    const m = match(EXPENSE_KEYWORDS)
    category = m?.[1] || 'other'; subcategory = m?.[2]
  }

  if (type) conf += 0.3
  if (amount) conf += 0.3
  if (category && !/^other/.test(category)) conf += 0.1

  // description: phrase after "for"/"on"/"from"
  const d = t.match(/\b(?:for|on|from|at)\s+(?:a\s+|an\s+|the\s+|my\s+)?([a-z][a-z\s&'-]{1,40}?)(?:\s+(?:today|yesterday|this|last|\d+ days? ago)|[.,!]|$)/)
  let description = d ? d[1].trim() : ''
  if (!description && category) description = ''
  description = description.replace(/\b(work|rupees?|rs)\b$/, '').trim()

  return {
    type,
    amount,
    category,
    subcategory,
    description: description ? description[0].toUpperCase() + description.slice(1) : '',
    date,
    confidence: Math.min(1, Math.round(conf * 100) / 100),
    isUnexpected: /\b(unexpected|sudden|emergency|urgent)\b/.test(t) || undefined,
    fromAccountHint, toAccountHint, goalHint,
  }
}
