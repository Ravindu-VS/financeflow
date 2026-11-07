import { create } from 'zustand'
import { makePeriod, shiftPeriod, type Period, type PeriodPreset, type PeriodRange, todayKey } from '../lib/finance'

interface PeriodState {
  period: Period
  setPreset: (p: PeriodPreset, custom?: PeriodRange) => void
  shift: (dir: -1 | 1) => void
  reset: () => void
}

/** Global period selector — default THIS MONTH. Shared by dashboard, lists, reports and insights. */
export const usePeriodStore = create<PeriodState>((set, get) => ({
  period: makePeriod('this_month'),
  setPreset: (preset, custom) => set({ period: makePeriod(preset, todayKey(), custom) }),
  shift: dir => set({ period: shiftPeriod(get().period, dir) }),
  reset: () => set({ period: makePeriod('this_month') }),
}))
