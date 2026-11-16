/**
 * Sinhala (සිංහල) voice/text input → the same structured preview as English input.
 * Speech is recognised with lang "si-LK"; this module turns the Sinhala transcript into the
 * parser's vocabulary (verb + amount + category + date) so categorisation is identical.
 *
 *   "අද දවල් කෑමට රුපියල් 850ක් වියදම් කළා"   → expense 850, food & dining, today
 *   "ඊයේ ත්‍රීවීල් එකට 600ක් ගෙව්වා"           → expense 600, transport, yesterday
 *   "පඩිය රුපියල් ලක්ෂ දෙකයි පනස්දාහක් ලැබුණා" → income 250,000, salary
 *   "විදුලි බිලට දෙදාහයි පන්සියයි ගෙව්වා"       → expense 2,500, utilities
 *   "මේ මාසේ කීයද වියදම් කළේ"                  → question: how much did I spend this month
 */
import { parseFinancialText, type ParsedEntry } from './voiceParser'
import { todayKey } from './dates'

/** Remove zero-width joiners so "ත්‍රී" and "ත්රී" match the same keyword. */
const norm = (s: string) => s.replace(/[‌‍]/g, '').replace(/\s+/g, ' ').trim()

export const isSinhala = (s: string) => /[඀-෿]/.test(s)

// ── numbers ────────────────────────────────────────────────────────────────
const UNITS: Record<string, number> = {
  'බිංදුව': 0, 'එක': 1, 'එකයි': 1, 'දෙක': 2, 'තුන': 3, 'හතර': 4, 'පහ': 5, 'හය': 6, 'හත': 7, 'අට': 8, 'නවය': 9, 'නමය': 9,
  'දහය': 10, 'එකොළහ': 11, 'දොළහ': 12, 'දහතුන': 13, 'දාහතර': 14, 'දහහතර': 14, 'පහළොව': 15, 'දාසය': 16, 'දහසය': 16, 'දාහත': 17, 'දහහත': 17,
  'දහඅට': 18, 'දහනවය': 19, 'විස්ස': 20, 'තිහ': 30, 'හතළිහ': 40, 'පනහ': 50, 'හැට': 60, 'හැත්තෑව': 70, 'අසූව': 80, 'අනූව': 90,
}
// Combining forms used before සිය / දාහ / ලක්ෂ and inside compounds (විසිපහ = 25)
const TENS_PREFIX: [string, number][] = [['හැත්තෑ', 70], ['හතළිස්', 40], ['විසි', 20], ['තිස්', 30], ['පනස්', 50], ['හැට', 60], ['අසූ', 80], ['අනූ', 90], ['දහ', 10]]
const UNIT_PREFIX: [string, number][] = [['එක්', 1], ['දෙ', 2], ['තුන්', 3], ['හාර', 4], ['හතර', 4], ['පන්', 5], ['හය', 6], ['හත්', 7], ['අට', 8], ['නව', 9], ['නම', 9]]
const MULT: [string, number][] = [['ලක්ෂ', 100000], ['දාහ', 1000], ['දහස', 1000], ['සිය', 100], ['සීය', 100]]
const SUFFIX = /(යි|ක්|ය|ට|ක)$/

/** Value of a number prefix like "විසිපන්" (25), "දෙ" (2), "සිය" (100, as in සියදාහ). */
function prefixValue(p: string): number | null {
  if (!p) return 1
  if (p === 'සිය' || p === 'සීය') return 100
  if (UNITS[p] != null) return UNITS[p]
  for (const [t, v] of TENS_PREFIX) if (p.startsWith(t)) {
    const rest = p.slice(t.length)
    if (!rest) return v
    for (const [u, uv] of UNIT_PREFIX) if (rest === u) return v + uv
    if (UNITS[rest] != null && UNITS[rest] < 10) return v + UNITS[rest]
  }
  for (const [u, uv] of UNIT_PREFIX) if (p === u) return uv
  return null
}

/** Value of one Sinhala number word, or null. Handles පන්සියයි, දෙදාහ, විසිපන්දාහක්, ලක්ෂයක්, විස්සයි… */
export function sinhalaWordValue(word: string): { value: number; mult: boolean } | null {
  const w0 = norm(word)
  // try the word as-is, then without one or two grammatical suffixes (යි, ක්, ට…)
  const candidates = [w0]
  let w = w0
  for (let i = 0; i < 2 && SUFFIX.test(w); i++) { w = w.replace(SUFFIX, ''); candidates.push(w) }
  for (const c of candidates) {
    if (UNITS[c] != null) return { value: UNITS[c], mult: false }
    for (const [m, mv] of MULT) {
      if (c.endsWith(m)) {
        const pv = prefixValue(c.slice(0, c.length - m.length))
        if (pv != null) return { value: pv * mv, mult: true }
      }
    }
  }
  for (const c of candidates) {
    const pv = prefixValue(c)
    if (pv != null && pv !== 1 && c.length > 1) return { value: pv, mult: false }
  }
  return null
}

/**
 * Total of the first run of Sinhala number words. Compounds already carry their multiplier
 * (දෙදාහ = 2000, පන්සිය = 500), so values add up; the one exception is a bare "ලක්ෂ" followed
 * by its count ("ලක්ෂ දෙකයි" = 200,000).
 */
export function parseSinhalaNumber(text: string): number | null {
  const words = norm(text).split(/[\s,.]+/)
  let total = 0, found = false
  for (let i = 0; i < words.length; i++) {
    const v = sinhalaWordValue(words[i])
    if (!v) { if (found) break; continue }
    found = true
    const bareLakh = v.mult && v.value === 100000 && /^ලක්ෂ/.test(norm(words[i]))
    const next = bareLakh ? sinhalaWordValue(words[i + 1] || '') : null
    if (next && !next.mult && next.value < 100) { total += next.value * 100000; i++ }
    else total += v.value
  }
  return found && total > 0 ? total : null
}

// ── vocabulary → parser English ─────────────────────────────────────────────
type Rule = [RegExp, string]
const rx = (words: string[]) => new RegExp(words.map(w => norm(w)).join('|'))

const CATEGORY_RULES: Rule[] = [
  [rx(['දවල් කෑම', 'දිවා ආහාර']), 'lunch'],
  [rx(['රෑ කෑම', 'රාත්‍රී කෑම', 'රාත්‍රී ආහාර']), 'dinner'],
  [rx(['උදේ කෑම', 'උදෑසන ආහාර']), 'breakfast'],
  [rx(['කොත්තු']), 'kottu'],
  [rx(['තේ', 'කෝපි', 'කැෆේ']), 'coffee'],
  [rx(['කෑම', 'ආහාර', 'බත්', 'හෝටල්']), 'food'],
  [rx(['සිල්ලර', 'එළවළු', 'එළවලු', 'සුපර්', 'බඩු මල්ල', 'කඩේ බඩු', 'ග්‍රොසරි']), 'groceries'],
  [rx(['වාහන අලුත්වැඩියා', 'වාහනය හදන්න', 'ගරාජ්', 'සර්විස්']), 'vehicle repair'],
  [rx(['පෙට්‍රල්', 'ඩීසල්', 'ඉන්ධන', 'තෙල් ගැහුව']), 'fuel'],
  [rx(['ත්‍රීවීල්', 'ත්‍රී වීල්', 'ටුක්', 'බස්', 'දුම්රිය', 'කෝච්චි', 'ටැක්සි', 'පික්මී', 'ඌබර්', 'ප්‍රවාහන']), 'transport'],
  [rx(['ගෙවල් කුලිය', 'නිවාස කුලිය', 'කාමර කුලිය', 'කුලිය']), 'rent'],
  [rx(['විදුලි බිල', 'කරන්ට් බිල', 'කරන්ට්', 'විදුලිය']), 'electricity'],
  [rx(['වතුර බිල', 'ජල බිල']), 'water bill'],
  [rx(['ෆෝන් බිල', 'දුරකථන බිල', 'රීලෝඩ්', 'ඩේටා', 'ඉන්ටර්නෙට්', 'අන්තර්ජාල']), 'internet'],
  [rx(['බෙහෙත්', 'ඖෂධ', 'දොස්තර', 'ඩොක්ටර්', 'වෛද්‍ය', 'රෝහල', 'ෆාමසි', 'ඉස්පිරිතාල']), 'medicine'],
  [rx(['පන්ති', 'ටියුෂන්', 'පාසල්', 'ඉස්කෝල', 'විශ්වවිද්‍යාල', 'පොත්', 'ගාස්තු']), 'tuition'],
  [rx(['චිත්‍රපට', 'ෆිල්ම්', 'සිනමා']), 'movie'],
  [rx(['ඇඳුම්', 'සපත්තු', 'ෂොපින්']), 'clothes'],
  [rx(['තෑගි', 'තෑග්ග', 'පරිත්‍යාග', 'දන්දීම', 'පින්කම']), 'gift'],
  [rx(['රක්ෂණ', 'ඉන්ෂුවරන්ස්']), 'insurance'],
  [rx(['බදු']), 'tax'],
  [rx(['ගුවන් ටිකට්', 'හෝටල් කාමර', 'ට්‍රිප්', 'සංචාර', 'විනෝද චාරිකා']), 'trip'],
  [rx(['කොණ්ඩේ කැපුව', 'සැලෝන්']), 'haircut'],
]
const INVEST_RULES: Rule[] = [
  [rx(['ස්ථාවර තැන්පතු', 'ෆික්ස්', 'එෆ්ඩී']), 'fixed deposit'],
  [rx(['කොටස්', 'ෂෙයාර්']), 'shares'],
  [rx(['යුනිට් ට්‍රස්ට්', 'ඒකක භාර']), 'unit trust'],
  [rx(['භාණ්ඩාගාර', 'බැඳුම්කර', 'බොන්ඩ්']), 'bonds'],
  [rx(['රත්තරන්', 'රන්']), 'gold'],
]
const INCOME_SOURCE: Rule[] = [
  [rx(['පඩිය', 'පඩි', 'වැටුප']), 'salary'],
  [rx(['බෝනස්', 'දීමනා']), 'bonus'],
  [rx(['ෆ්‍රීලාන්ස්', 'අප්වර්ක්', 'ක්ලයන්ට්', 'ව්‍යාපෘති']), 'freelance'],
  [rx(['පොලිය', 'පොලී']), 'interest'],
  [rx(['ව්‍යාපාර', 'බිස්නස්', 'විකුණුම්']), 'business'],
]

const has = (t: string, words: string[]) => words.some(w => t.includes(norm(w)))

/** Map a Sinhala sentence to the English vocabulary the parser understands. */
export function sinhalaToEnglish(input: string): string {
  const t = norm(input)
  const parts: string[] = []

  // question?
  if (has(t, ['කීයද', 'කොච්චරද', 'කීයක්ද', 'කොපමණද', 'කොච්චර'])) {
    const what = has(t, ['ඉතුරු', 'ඉතිරි']) ? 'save' : has(t, ['ලැබුණ', 'ආදායම', 'පඩිය', 'වැටුප']) ? 'earn' : 'spend'
    const when = has(t, ['අද']) ? 'today' : has(t, ['ගිය මාස', 'පසුගිය මාස']) ? 'last month' : has(t, ['මේ සතිය', 'මේ සතියේ']) ? 'this week' : has(t, ['මේ අවුරුද්ද', 'මේ වසර']) ? 'this year' : 'this month'
    return `how much did i ${what} ${when}`
  }

  // amount: digits first ("රුපියල් 1,500ක්"), else Sinhala number words
  const digits = t.match(/(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)/)
  let amount = digits ? parseFloat(digits[1].replace(/,/g, '')) : parseSinhalaNumber(t)
  if (digits && has(t, ['ලක්ෂ'])) amount = (amount || 0) * 100000
  else if (digits && /\d\s*(දාහ|දහස)/.test(t)) amount = (amount || 0) * 1000

  const first = (rules: Rule[]) => rules.find(([re]) => re.test(t))?.[1]

  // type
  if (has(t, ['මාරු කළා', 'මාරු කරා', 'ට්‍රාන්ස්ෆර්'])) parts.push('transfer')
  else if (has(t, ['රිෆන්ඩ්', 'ආපසු ලැබුණ', 'ආපහු ලැබුණ', 'සල්ලි ආපසු'])) parts.push('refunded')
  else if (has(t, ['ආයෝජනය', 'ඉන්වෙස්ට්'])) parts.push('invested')
  else if (has(t, ['ඉතුරු කළා', 'ඉතිරි කළා', 'ඉතුරු කරා', 'ඉතිරි කරා', 'සේව් කළා', 'ඉතුරු කරගත්තා'])) parts.push('saved')
  else if (first(INCOME_SOURCE) || has(t, ['ලැබුණා', 'ලැබුණ', 'ලැබුනා', 'ආදායම', 'හම්බවුණා', 'හම්බුණා'])) parts.push('received')
  else if (has(t, ['වියදම්', 'වියදම', 'ගෙව්වා', 'ගෙව්ව', 'ගෙවුවා', 'ගෙවුව', 'ගත්තා', 'ගත්ත', 'මිලදී', 'වැය', 'බිල'])) parts.push('spent')

  if (amount) parts.push(String(amount))

  const cat = parts[0] === 'invested' ? first(INVEST_RULES) : parts[0] === 'received' ? first(INCOME_SOURCE) : first(CATEGORY_RULES)
  if (cat) parts.push(parts[0] === 'invested' ? `in ${cat}` : parts[0] === 'received' ? `from ${cat}` : `on ${cat}`)
  if (!parts.length || (parts.length === 1 && amount)) {
    // no verb: a category word alone means spending ("බස් එකට 120")
    const c = first(CATEGORY_RULES); if (c) parts.unshift('spent'), parts.push(`on ${c}`)
  }

  // when
  if (has(t, ['පෙරේදා'])) parts.push('day before yesterday')
  else if (has(t, ['ඊයේ', 'ඊයෙ'])) parts.push('yesterday')
  else {
    const ago = t.match(/(\d+)\s*(?:දවසකට|දවස්වලට|දිනකට|දින)\s*(?:කලින්|පෙර)/)
    if (ago) parts.push(`${ago[1]} days ago`)
  }
  if (has(t, ['හදිසි'])) parts.push('emergency')
  return parts.join(' ')
}

/** Parse Sinhala (or English) text into a transaction preview. */
export function parseAnyLanguage(input: string, today: string = todayKey()): ParsedEntry & { language: 'si' | 'en'; english?: string } {
  if (!isSinhala(input)) return { ...parseFinancialText(input, today), language: 'en' }
  const english = sinhalaToEnglish(input)
  const parsed = parseFinancialText(english, today)
  // keep a Sinhala description when the parser only found an English category word
  return { ...parsed, description: parsed.description || '', language: 'si', english }
}
