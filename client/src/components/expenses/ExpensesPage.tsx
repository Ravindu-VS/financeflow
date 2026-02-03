import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'react-hot-toast'
import { expenseService } from '../../services/firebaseService'
import { Expense, EXPENSE_CATEGORIES } from '../../types'
import { Card, SectionHeader, Button, Modal, Input, Select } from '../ui'
import { formatCurrency, getCurrencyLabel } from '../../utils/currency'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CreditCardIcon,
  FunnelIcon,
  ReceiptPercentIcon
} from '@heroicons/react/24/outline'
import { Timestamp } from 'firebase/firestore'

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [filter, setFilter] = useState({ category: '', month: '' })

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm()

  const fetchExpenses = async () => {
    try {
      setLoading(true)
      const data = await expenseService.getAll()
      // Transform data and apply filters
      let filtered = data.map((item: any) => ({
        ...item,
        _id: item.id,
        date: item.date?.toDate ? item.date.toDate().toISOString() : item.date
      }))
      
      if (filter.category) {
        filtered = filtered.filter((exp: any) => exp.category === filter.category)
      }
      
      setExpenses(filtered as Expense[])
    } catch (error) {
      toast.error('Failed to fetch expenses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExpenses()
  }, [filter])

  const openModal = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense)
      setValue('description', expense.description)
      setValue('amount', expense.amount)
      setValue('category', expense.category)
      setValue('date', expense.date.split('T')[0])
      setValue('notes', expense.notes || '')
      setValue('paymentMethod', expense.paymentMethod || 'cash')
      setValue('isRecurring', expense.isRecurring)
      setValue('recurringFrequency', expense.recurringFrequency || 'monthly')
    } else {
      reset()
      setEditingExpense(null)
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingExpense(null)
    reset()
  }

  const onSubmit = async (data: any) => {
    try {
      const expenseData = {
        ...data,
        amount: parseFloat(data.amount),
        date: Timestamp.fromDate(new Date(data.date))
      }
      
      if (editingExpense) {
        await expenseService.update(editingExpense._id, expenseData)
        toast.success('Expense updated successfully')
      } else {
        await expenseService.create(expenseData)
        toast.success('Expense added successfully')
      }
      closeModal()
      fetchExpenses()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save expense')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return
    try {
      await expenseService.delete(id)
      toast.success('Expense deleted successfully')
      fetchExpenses()
    } catch (error) {
      toast.error('Failed to delete expense')
    }
  }

  // Calculate totals
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0)
  const essentialExpenses = expenses
    .filter(exp => ['Housing', 'Food', 'Transport', 'Healthcare', 'Bills'].includes(exp.category))
    .reduce((sum, exp) => sum + exp.amount, 0)

  const categoryOptions = EXPENSE_CATEGORIES.map(cat => ({ value: cat, label: cat }))

  // Get category icon color
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Food': 'bg-orange-100 dark:bg-orange-900/30 text-orange-500',
      'Transport': 'bg-blue-100 dark:bg-blue-900/30 text-blue-500',
      'Entertainment': 'bg-purple-100 dark:bg-purple-900/30 text-purple-500',
      'Shopping': 'bg-pink-100 dark:bg-pink-900/30 text-pink-500',
      'Bills': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600',
      'Healthcare': 'bg-red-100 dark:bg-red-900/30 text-red-500',
      'Housing': 'bg-green-100 dark:bg-green-900/30 text-green-500',
      'Education': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-500',
    }
    return colors[category] || 'bg-gray-100 dark:bg-gray-700 text-gray-500'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Expenses</h1>
          <p className="text-gray-500 dark:text-gray-400">Track and categorize your spending</p>
        </div>
        <Button onClick={() => openModal()} icon={<PlusIcon className="w-5 h-5" />}>
          Add Expense
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Expenses</p>
          <p className="text-2xl font-bold text-red-500">{formatCurrency(totalExpenses)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Essential Expenses</p>
          <p className="text-2xl font-bold text-orange-500">{formatCurrency(essentialExpenses)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Transactions</p>
          <p className="text-2xl font-bold text-purple-500">{expenses.length}</p>
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
            {EXPENSE_CATEGORIES.map(cat => (
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

      {/* Expenses List */}
      <Card padding="none">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-12">
            <CreditCardIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No expense records found</p>
            <Button variant="outline" className="mt-4" onClick={() => openModal()}>
              Add your first expense
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 text-left text-sm text-gray-500 dark:text-gray-400">
                  <th className="p-4 font-medium">Description</th>
                  <th className="p-4 font-medium">Category</th>
                  <th className="p-4 font-medium">Date</th>
                  <th className="p-4 font-medium">Payment</th>
                  <th className="p-4 font-medium text-right">Amount</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense._id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getCategoryColor(expense.category)}`}>
                          <CreditCardIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{expense.description}</p>
                          {expense.notes && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{expense.notes}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {expense.category}
                      </span>
                    </td>
                    <td className="p-4 text-gray-500 dark:text-gray-400">
                      {new Date(expense.date).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 capitalize">
                        {expense.paymentMethod || 'Cash'}
                      </span>
                    </td>
                    <td className="p-4 text-right font-semibold text-red-500">
                      -{formatCurrency(expense.amount)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openModal(expense)}
                          className="p-2 text-gray-400 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(expense._id)}
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
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingExpense ? 'Edit Expense' : 'Add Expense'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Description"
            placeholder="e.g., Grocery shopping"
            {...register('description', { required: 'Description is required' })}
            error={errors.description?.message as string}
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

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Date"
              type="date"
              {...register('date', { required: 'Date is required' })}
              error={errors.date?.message as string}
            />
            <Select
              label="Payment Method"
              options={[
                { value: 'cash', label: 'Cash' },
                { value: 'debit', label: 'Debit Card' },
                { value: 'credit', label: 'Credit Card' },
                { value: 'upi', label: 'UPI' },
                { value: 'netbanking', label: 'Net Banking' },
                { value: 'wallet', label: 'Wallet' }
              ]}
              {...register('paymentMethod')}
            />
          </div>

          <Input
            label="Notes (Optional)"
            placeholder="Additional details..."
            {...register('notes')}
          />

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('isRecurring')} className="rounded text-primary-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Recurring expense</span>
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
              {editingExpense ? 'Update' : 'Add'} Expense
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
