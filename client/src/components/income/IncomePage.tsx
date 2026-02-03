import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'react-hot-toast'
import { incomeService } from '../../services/firebaseService'
import { Income, INCOME_CATEGORIES } from '../../types'
import { Card, SectionHeader, Button, Modal, Input, Select } from '../ui'
import { formatCurrency, getCurrencyLabel } from '../../utils/currency'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  BanknotesIcon,
  FunnelIcon
} from '@heroicons/react/24/outline'
import { Timestamp } from 'firebase/firestore'

export default function IncomePage() {
  const [incomes, setIncomes] = useState<Income[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingIncome, setEditingIncome] = useState<Income | null>(null)
  const [filter, setFilter] = useState({ category: '', month: '' })

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm()

  const fetchIncomes = async () => {
    try {
      setLoading(true)
      const data = await incomeService.getAll()
      // Transform data and apply filters
      let filtered = data.map((item: any) => ({
        ...item,
        _id: item.id,
        date: item.date?.toDate ? item.date.toDate().toISOString() : item.date
      }))
      
      if (filter.category) {
        filtered = filtered.filter((inc: any) => inc.category === filter.category)
      }
      
      setIncomes(filtered as Income[])
    } catch (error) {
      toast.error('Failed to fetch incomes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIncomes()
  }, [filter])

  const openModal = (income?: Income) => {
    if (income) {
      setEditingIncome(income)
      setValue('source', income.source)
      setValue('amount', income.amount)
      setValue('category', income.category)
      setValue('date', income.date.split('T')[0])
      setValue('description', income.description || '')
      setValue('isRecurring', income.isRecurring)
      setValue('recurringFrequency', income.recurringFrequency || 'monthly')
    } else {
      reset()
      setEditingIncome(null)
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingIncome(null)
    reset()
  }

  const onSubmit = async (data: any) => {
    try {
      const incomeData = {
        ...data,
        amount: parseFloat(data.amount),
        date: Timestamp.fromDate(new Date(data.date))
      }
      
      if (editingIncome) {
        await incomeService.update(editingIncome._id, incomeData)
        toast.success('Income updated successfully')
      } else {
        await incomeService.create(incomeData)
        toast.success('Income added successfully')
      }
      closeModal()
      fetchIncomes()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save income')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this income?')) return
    try {
      await incomeService.delete(id)
      toast.success('Income deleted successfully')
      fetchIncomes()
    } catch (error) {
      toast.error('Failed to delete income')
    }
  }

  // Calculate totals
  const totalIncome = incomes.reduce((sum, inc) => sum + inc.amount, 0)
  const recurringIncome = incomes.filter(inc => inc.isRecurring).reduce((sum, inc) => sum + inc.amount, 0)

  const categoryOptions = INCOME_CATEGORIES.map(cat => ({ value: cat, label: cat }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Income</h1>
          <p className="text-gray-500 dark:text-gray-400">Track and manage your income sources</p>
        </div>
        <Button onClick={() => openModal()} icon={<PlusIcon className="w-5 h-5" />}>
          Add Income
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Income</p>
          <p className="text-2xl font-bold text-green-500">{formatCurrency(totalIncome)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Recurring Income</p>
          <p className="text-2xl font-bold text-blue-500">{formatCurrency(recurringIncome)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Income Sources</p>
          <p className="text-2xl font-bold text-purple-500">{incomes.length}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <FunnelIcon className="w-5 h-5 text-gray-400 hidden sm:block" />
          <select
            value={filter.category}
            onChange={(e) => setFilter({ ...filter, category: e.target.value })}
            className="input py-2"
          >
            <option value="">All Categories</option>
            {INCOME_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <input
            type="month"
            value={filter.month}
            onChange={(e) => setFilter({ ...filter, month: e.target.value })}
            className="input py-2"
          />
          <Button variant="ghost" size="sm" onClick={() => setFilter({ category: '', month: '' })}>
            Clear
          </Button>
        </div>
      </Card>

      {/* Income List */}
      <Card padding="none">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : incomes.length === 0 ? (
          <div className="text-center py-12">
            <BanknotesIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No income records found</p>
            <Button variant="outline" className="mt-4" onClick={() => openModal()}>
              Add your first income
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 text-left text-sm text-gray-500 dark:text-gray-400">
                  <th className="p-4 font-medium">Source</th>
                  <th className="p-4 font-medium">Category</th>
                  <th className="p-4 font-medium">Date</th>
                  <th className="p-4 font-medium">Type</th>
                  <th className="p-4 font-medium text-right">Amount</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {incomes.map((income) => (
                  <tr key={income._id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <BanknotesIcon className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{income.source}</p>
                          {income.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">{income.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {income.category}
                      </span>
                    </td>
                    <td className="p-4 text-gray-500 dark:text-gray-400">
                      {new Date(income.date).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="p-4">
                      {income.isRecurring ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                          Recurring ({income.recurringFrequency})
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                          One-time
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right font-semibold text-green-500">
                      +{formatCurrency(income.amount)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openModal(income)}
                          className="p-2 text-gray-400 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(income._id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingIncome ? 'Edit Income' : 'Add Income'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Source"
            placeholder="e.g., Company Salary"
            {...register('source', { required: 'Source is required' })}
            error={errors.source?.message as string}
          />
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={getCurrencyLabel('Amount')}
              type="number"
              placeholder="0"
              {...register('amount', { required: 'Amount is required', min: { value: 1, message: 'Amount must be positive' } })}
              error={errors.amount?.message as string}
            />
            <Select
              label="Category"
              options={[{ value: '', label: 'Select category' }, ...categoryOptions]}
              {...register('category', { required: 'Category is required' })}
              error={errors.category?.message as string}
            />
          </div>

          <Input
            label="Date"
            type="date"
            {...register('date', { required: 'Date is required' })}
            error={errors.date?.message as string}
          />

          <Input
            label="Description (Optional)"
            placeholder="Additional notes..."
            {...register('description')}
          />

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('isRecurring')} className="rounded text-primary-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Recurring income</span>
            </label>
          </div>

          <Select
            label="Frequency"
            options={[
              { value: 'weekly', label: 'Weekly' },
              { value: 'biweekly', label: 'Bi-weekly' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'quarterly', label: 'Quarterly' },
              { value: 'yearly', label: 'Yearly' }
            ]}
            {...register('recurringFrequency')}
          />

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {editingIncome ? 'Update' : 'Add'} Income
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
