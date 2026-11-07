import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { useQuickAdd, type QuickAddMode } from '../../store/quickAddStore'

const ITEMS: { mode: QuickAddMode | 'voice'; label: string; icon: string; color: string }[] = [
  { mode: 'expense', label: 'Expense', icon: '💸', color: 'bg-red-500' },
  { mode: 'income', label: 'Income', icon: '💰', color: 'bg-green-500' },
  { mode: 'investment', label: 'Investment', icon: '📈', color: 'bg-blue-500' },
  { mode: 'savings_contribution', label: 'Savings', icon: '🐷', color: 'bg-emerald-600' },
  { mode: 'transfer', label: 'Transfer', icon: '🔁', color: 'bg-slate-500' },
  { mode: 'bill', label: 'Bill', icon: '🧾', color: 'bg-amber-500' },
  { mode: 'voice', label: 'Voice', icon: '🎙️', color: 'bg-purple-500' },
]

/** Prominent floating Quick Add button (above the mobile bottom nav). */
export default function QuickAdd() {
  const [open, setOpen] = useState(false)
  const quick = useQuickAdd()
  const navigate = useNavigate()

  return (
    <div className="fixed z-40 right-4 bottom-20 lg:bottom-6 flex flex-col items-end gap-2">
      {open && (
        <div className="flex flex-col items-end gap-2 mb-1">
          {ITEMS.map(i => (
            <button key={i.mode} onClick={() => {
              setOpen(false)
              if (i.mode === 'voice') navigate('/voice')
              else quick.open(i.mode)
            }} className="flex items-center gap-2 group">
              <span className="px-2 py-1 rounded-md bg-gray-900/80 text-white text-sm shadow">{i.label}</span>
              <span className={`w-12 h-12 rounded-full ${i.color} text-white text-xl flex items-center justify-center shadow-lg`}>{i.icon}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        {!open && (
          <button onClick={() => quick.open('expense')} className="hidden sm:block px-4 py-3 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200">
            + Expense
          </button>
        )}
        <button aria-label={open ? 'Close quick add' : 'Quick add'} onClick={() => setOpen(!open)}
          className="w-14 h-14 rounded-full bg-primary-600 hover:bg-primary-700 text-white shadow-xl flex items-center justify-center">
          {open ? <XMarkIcon className="w-7 h-7" /> : <PlusIcon className="w-7 h-7" />}
        </button>
      </div>
    </div>
  )
}
