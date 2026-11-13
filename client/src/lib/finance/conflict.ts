/**
 * Concurrent-edit handling. An edit starts from the version the user opened (`before`).
 * If the stored document changed in the meantime (another device, or a queued offline write
 * that synced), we rebase onto the stored version and only report a conflict when the SAME
 * fields were changed on both sides. Balances are always reversed from the stored version,
 * so they stay correct.
 */
import type { Transaction } from './types'

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export interface EditResolution {
  /** The version to apply the patch on top of */
  base: Transaction | null
  /** Fields the user edited that were also changed elsewhere */
  conflicts: string[]
  deleted: boolean
  changedElsewhere: boolean
}

export function resolveConcurrentEdit(before: Transaction, stored: Transaction | null, patch: Partial<Transaction>): EditResolution {
  if (!stored) return { base: null, conflicts: Object.keys(patch), deleted: true, changedElsewhere: true }
  const changedElsewhere = !!before.updatedAt && !!stored.updatedAt && before.updatedAt !== stored.updatedAt
  if (!changedElsewhere) return { base: stored, conflicts: [], deleted: false, changedElsewhere: false }
  const conflicts = Object.keys(patch).filter(k =>
    !['updatedAt', 'createdAt'].includes(k) &&
    !same((before as any)[k], (stored as any)[k]) &&
    !same((patch as any)[k], (stored as any)[k]))
  return { base: stored, conflicts, deleted: false, changedElsewhere: true }
}

export class EditConflictError extends Error {
  constructor(public fields: string[], public stored: Transaction | null) {
    super(stored ? `This transaction was changed on another device (${fields.join(', ')}). Review the latest version and try again.` : 'This transaction was deleted on another device.')
    this.name = 'EditConflictError'
  }
}
