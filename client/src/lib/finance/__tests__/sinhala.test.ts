import { describe, it, expect } from 'vitest'
import { parseSinhalaNumber, sinhalaToEnglish, parseAnyLanguage, isSinhala } from '..'

const T = '2026-11-16'

describe('Sinhala numbers', () => {
  it.each([
    ['පන්සියයි', 500], ['දෙදාහයි පන්සියයි', 2500], ['විසිපන්දාහක්', 25000], ['ලක්ෂ දෙකයි පනස්දාහක්', 250000],
    ['දෙලක්ෂයක්', 200000], ['දාහක්', 1000], ['හාරසිය පනහක්', 450], ['දහදාහ', 10000], ['තුන්දාහයි', 3000], ['සියදාහ', 100000],
  ])('%s → %d', (w, n) => expect(parseSinhalaNumber(w)).toBe(n))
})

describe('Sinhala sentences → preview', () => {
  it('lunch expense today, digits with suffix', () => {
    const r = parseAnyLanguage('අද දවල් කෑමට රුපියල් 850ක් වියදම් කළා', T)
    expect(r).toMatchObject({ language: 'si', type: 'expense', amount: 850, category: 'food_dining', date: T })
  })
  it('three-wheeler yesterday → transport', () => {
    const r = parseAnyLanguage('ඊයේ ත්‍රීවීල් එකට 600ක් ගෙව්වා', T)
    expect(r).toMatchObject({ type: 'expense', amount: 600, category: 'transport', date: '2026-11-15' })
  })
  it('ZWJ-less spelling matches too', () => {
    expect(parseAnyLanguage('ත්රීවීල් එකට 600ක් ගෙව්වා', T).category).toBe('transport')
  })
  it('salary in words', () => {
    const r = parseAnyLanguage('පඩිය රුපියල් ලක්ෂ දෙකයි පනස්දාහක් ලැබුණා', T)
    expect(r).toMatchObject({ type: 'income', amount: 250000, category: 'salary' })
  })
  it('electricity bill in words', () => {
    const r = parseAnyLanguage('විදුලි බිලට දෙදාහයි පන්සියයි ගෙව්වා', T)
    expect(r).toMatchObject({ type: 'expense', amount: 2500, category: 'utilities' })
  })
  it('groceries, fuel, medicine, rent', () => {
    expect(parseAnyLanguage('එළවළු ගත්තා 1200', T).category).toBe('groceries')
    expect(parseAnyLanguage('පෙට්‍රල් ගැහුවා 5000', T).category).toBe('fuel')
    expect(parseAnyLanguage('බෙහෙත් ගත්තා 1500ක්', T).category).toBe('healthcare')
    expect(parseAnyLanguage('ගෙවල් කුලිය 45000ක් ගෙව්වා', T).category).toBe('housing')
  })
  it('savings and investments are not expenses', () => {
    expect(parseAnyLanguage('5000ක් ඉතුරු කළා', T).type).toBe('savings_contribution')
    expect(parseAnyLanguage('රත්තරන් වලට 20000ක් ආයෝජනය කළා', T)).toMatchObject({ type: 'investment', category: 'gold', amount: 20000 })
  })
  it('category alone means spending; thousands written as digits + දාහ', () => {
    expect(parseAnyLanguage('බස් එකට 120', T)).toMatchObject({ type: 'expense', amount: 120, category: 'transport' })
    expect(parseAnyLanguage('ඇඳුම් වලට 5 දාහක් වියදම් කළා', T).amount).toBe(5000)
  })
  it('questions become balance queries', () => {
    expect(sinhalaToEnglish('මේ මාසේ කීයද වියදම් කළේ')).toBe('how much did i spend this month')
    expect(sinhalaToEnglish('අද කොච්චරද වියදම් කළේ')).toBe('how much did i spend today')
  })
  it('English passes through unchanged', () => {
    expect(isSinhala('Spent 500 on lunch')).toBe(false)
    expect(parseAnyLanguage('Spent 500 on lunch', T)).toMatchObject({ language: 'en', amount: 500, category: 'food_dining' })
  })
})
