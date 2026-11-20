import { describe, it, expect, vi } from 'vitest'

vi.mock('../storage', () => ({ dumpAccount: vi.fn(), restoreAccount: vi.fn(), countDocs: (d: object) => Object.keys(d).length }))
import { encryptBackup, decryptBackup, parseBackupFile, backupDue } from '../backup'

const docs = {
  'users/u1': { profile: { firstName: 'Kasun' } },
  'users/u1/transactions/t1': { amount: 1250, date: '2026-11-02', description: 'Groceries at Keells', createdAt: { __ts: [1762000000, 0] } },
  'users/u1/loans/L1': { counterparty: 'Nimal', principal: 25000 },
}

describe('encrypted backups', () => {
  it('round-trips and keeps no readable financial data in the file', async () => {
    const file = await encryptBackup({ exportedAt: '2026-11-20T09:00:00.000Z', docs }, 'correct horse battery')
    const text = JSON.stringify(file)
    expect(text).not.toMatch(/Kasun|Keells|Nimal|1250|25000/)
    expect(file.documents).toBe(3)
    const back = await decryptBackup(parseBackupFile(text), 'correct horse battery')
    expect(back.docs).toEqual(docs)
    expect(back.exportedAt).toBe('2026-11-20T09:00:00.000Z')
  }, 20000)

  it('rejects a wrong password, a tampered header and non-backup files', async () => {
    const file = await encryptBackup({ exportedAt: '2026-11-20T09:00:00.000Z', docs }, 'correct horse battery')
    await expect(decryptBackup(file, 'wrong password!')).rejects.toThrow(/Wrong password/)
    await expect(decryptBackup({ ...file, documents: 999 }, 'correct horse battery')).rejects.toThrow(/Wrong password|damaged/)
    expect(() => parseBackupFile('{"hello":1}')).toThrow(/not a FinanceFlow backup/)
    await expect(encryptBackup({ exportedAt: '', docs }, 'short')).rejects.toThrow(/at least 8/)
  }, 30000)

  it('works out when a backup reminder is due', () => {
    const now = new Date('2026-11-20T10:00:00Z')
    expect(backupDue({ last: null, via: null, frequency: 'weekly' }, now)).toBe(Infinity)
    expect(backupDue({ last: '2026-11-15T10:00:00Z', via: 'file', frequency: 'weekly' }, now)).toBeNull()
    expect(backupDue({ last: '2026-11-10T10:00:00Z', via: 'file', frequency: 'weekly' }, now)).toBe(10)
    expect(backupDue({ last: '2026-11-10T10:00:00Z', via: 'file', frequency: 'monthly' }, now)).toBeNull()
    expect(backupDue({ last: null, via: null, frequency: 'off' }, now)).toBeNull()
  })
})
