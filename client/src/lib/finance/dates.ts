/**
 * Timezone-safe calendar date helpers.
 *
 * All transaction dates are stored as LOCAL calendar dates ("YYYY-MM-DD").
 * We never use `new Date('YYYY-MM-DD')` (which parses as UTC midnight and
 * shifts a day in negative-offset timezones). Date objects are only created
 * with the local-time constructor.
 */
import type { PeriodRange } from './types'

export const pad = (n: number) => String(n).padStart(2, '0')

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0) // local noon: DST/TZ safe
}

export function isValidDateKey(key: unknown): key is string {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false
  const d = parseDateKey(key)
  return toDateKey(d) === key
}

export const todayKey = (now: Date = new Date()) => toDateKey(now)
export const monthKey = (key: string) => key.slice(0, 7)

export function addDays(key: string, n: number): string {
  const d = parseDateKey(key)
  d.setDate(d.getDate() + n)
  return toDateKey(d)
}

/** Add months, clamping the day to the target month length (Jan 31 + 1m = Feb 28/29). */
export function addMonths(key: string, n: number, anchorDay?: number): string {
  const d = parseDateKey(key)
  const day = anchorDay ?? d.getDate()
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1, 12)
  const last = daysInMonth(target.getFullYear(), target.getMonth())
  target.setDate(Math.min(day, last))
  return toDateKey(target)
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate()
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseDateKey(b).getTime() - parseDateKey(a).getTime()) / 86400000)
}

export function startOfMonth(key: string): string { return key.slice(0, 8) + '01' }
export function endOfMonth(key: string): string {
  const d = parseDateKey(key)
  return `${key.slice(0, 8)}${pad(daysInMonth(d.getFullYear(), d.getMonth()))}`
}

/** Week starts Monday (ISO). */
export function startOfWeek(key: string): string {
  const d = parseDateKey(key)
  const dow = (d.getDay() + 6) % 7
  return addDays(key, -dow)
}

export const isWeekend = (key: string) => { const g = parseDateKey(key).getDay(); return g === 0 || g === 6 }

export function inRange(key: string, r: PeriodRange): boolean {
  return key >= r.start && key <= r.end
}

export function eachDay(r: PeriodRange): string[] {
  const out: string[] = []
  for (let k = r.start; k <= r.end; k = addDays(k, 1)) out.push(k)
  return out
}

export type PeriodPreset =
  | 'today' | 'this_week' | 'this_month' | 'last_month' | 'last_3_months'
  | 'last_6_months' | 'this_year' | 'last_year' | 'custom'

export type PeriodUnit = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom'

export interface Period extends PeriodRange {
  preset: PeriodPreset
  unit: PeriodUnit
  label: string
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const SHORT = MONTHS.map(m => m.slice(0, 3))

export function formatDateKey(key: string, opts: { year?: boolean; weekday?: boolean } = {}): string {
  const d = parseDateKey(key)
  const wd = opts.weekday ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] + ', ' : ''
  return `${wd}${SHORT[d.getMonth()]} ${d.getDate()}${opts.year ? `, ${d.getFullYear()}` : ''}`
}

export function monthLabel(key: string): string {
  const d = parseDateKey(key)
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function makePeriod(preset: PeriodPreset, today: string = todayKey(), custom?: PeriodRange): Period {
  switch (preset) {
    case 'today':
      return { preset, unit: 'day', start: today, end: today, label: formatDateKey(today, { year: true, weekday: true }) }
    case 'this_week': {
      const s = startOfWeek(today)
      return { preset, unit: 'week', start: s, end: addDays(s, 6), label: weekLabel(s) }
    }
    case 'this_month':
      return { preset, unit: 'month', start: startOfMonth(today), end: endOfMonth(today), label: monthLabel(today) }
    case 'last_month': {
      const k = addMonths(startOfMonth(today), -1)
      return { preset, unit: 'month', start: k, end: endOfMonth(k), label: monthLabel(k) }
    }
    case 'last_3_months': {
      const s = addMonths(startOfMonth(today), -2)
      return { preset, unit: 'custom', start: s, end: endOfMonth(today), label: `${SHORT[parseDateKey(s).getMonth()]} – ${monthLabel(today)}` }
    }
    case 'last_6_months': {
      const s = addMonths(startOfMonth(today), -5)
      return { preset, unit: 'custom', start: s, end: endOfMonth(today), label: `${SHORT[parseDateKey(s).getMonth()]} ${s.slice(0, 4)} – ${monthLabel(today)}` }
    }
    case 'this_year': {
      const y = today.slice(0, 4)
      return { preset, unit: 'year', start: `${y}-01-01`, end: `${y}-12-31`, label: y }
    }
    case 'last_year': {
      const y = String(Number(today.slice(0, 4)) - 1)
      return { preset, unit: 'year', start: `${y}-01-01`, end: `${y}-12-31`, label: y }
    }
    case 'custom': {
      const r = custom || { start: startOfMonth(today), end: today }
      const [start, end] = r.start <= r.end ? [r.start, r.end] : [r.end, r.start]
      return { preset, unit: 'custom', start, end, label: `${formatDateKey(start, { year: true })} – ${formatDateKey(end, { year: true })}` }
    }
  }
}

function weekLabel(start: string) {
  return `${formatDateKey(start)} – ${formatDateKey(addDays(start, 6), { year: true })}`
}

/** Move a period backwards (-1) or forwards (+1) by its own length. */
export function shiftPeriod(p: Period, dir: -1 | 1): Period {
  switch (p.unit) {
    case 'day': {
      const k = addDays(p.start, dir)
      return { ...p, preset: 'custom', start: k, end: k, label: formatDateKey(k, { year: true, weekday: true }) }
    }
    case 'week': {
      const s = addDays(p.start, 7 * dir)
      return { ...p, preset: 'custom', start: s, end: addDays(s, 6), label: weekLabel(s) }
    }
    case 'month': {
      const s = addMonths(p.start, dir, 1)
      return { ...p, preset: 'custom', start: s, end: endOfMonth(s), label: monthLabel(s) }
    }
    case 'year': {
      const y = String(Number(p.start.slice(0, 4)) + dir)
      return { ...p, preset: 'custom', start: `${y}-01-01`, end: `${y}-12-31`, label: y }
    }
    default: {
      const len = diffDays(p.start, p.end) + 1
      const s = addDays(p.start, len * dir)
      const e = addDays(p.end, len * dir)
      return { ...p, preset: 'custom', start: s, end: e, label: `${formatDateKey(s, { year: true })} – ${formatDateKey(e, { year: true })}` }
    }
  }
}

/** The equivalent preceding period (used for "vs last month/week" comparisons). */
export function previousPeriod(p: Period): Period {
  return shiftPeriod(p, -1)
}

/** Convert a legacy Firestore value (Timestamp | Date | ISO string | {seconds}) into a local date key. */
export function legacyToDateKey(v: any): string | null {
  if (!v) return null
  let d: Date | null = null
  if (typeof v?.toDate === 'function') d = v.toDate()
  else if (v instanceof Date) d = v
  else if (typeof v === 'object' && typeof v.seconds === 'number') d = new Date(v.seconds * 1000)
  else if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return isValidDateKey(v) ? v : null
    const t = Date.parse(v)
    if (!isNaN(t)) d = new Date(t)
  } else if (typeof v === 'number') d = new Date(v)
  if (!d || isNaN(d.getTime())) return null
  // The pre-upgrade app saved `Timestamp.fromDate(new Date('YYYY-MM-DD'))`,
  // i.e. exactly UTC midnight. Recover the intended calendar day from UTC parts.
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0) {
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  }
  return toDateKey(d)
}
