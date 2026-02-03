import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'react-hot-toast'
import { budgetService } from '../../services/firebaseService'
import { Budget, EXPENSE_CATEGORIES } from '../../types'
import { Card, SectionHeader, Button, Modal, Input, Select } from '../ui'
import { formatCurrency, getCurrencyLabel } from '../../utils/currency'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ChartPieIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm()

  const fetchBudgets = async () => {
    try {
      setLoading(true)
      const data = await budgetService.checkBudgetStatus()
      const transformed = data.map((item: any) => ({
        ...item,
        _id: item.id
      }))
      setBudgets(transformed as Budget[])
    } catch (error) {
      toast.error('Failed to fetch budgets')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBudgets()
  }, [])

  const openModal = (budget?: Budget) => {
    if (budget) {
      setEditingBudget(budget)
      setValue('category', budget.category)
      setValue('limit', budget.limit)
      setValue('period', budget.period)
      setValue('alertThreshold', budget.alertThreshold || 80)
    } else {
      reset()
      setEditingBudget(null)
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingBudget(null)
    reset()
  }

  const onSubmit = async (data: any) => {
    try {
      const budgetData = {
        ...data,
        limit: parseFloat(data.limit),
        alertThreshold: parseFloat(data.alertThreshold || 80)
      }
      
      if (editingBudget) {
        await budgetService.update(editingBudget._id, budgetData)
        toast.success('Budget updated successfully')
      } else {
        await budgetService.create(budgetData)
        toast.success('Budget created successfully')
      }
      closeModal()
      fetchBudgets()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save budget')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this budget?')) return
    try {
      await budgetService.delete(id)
      toast.success('Budget deleted successfully')
      fetchBudgets()
    } catch (error) {
      toast.error('Failed to delete budget')
    }
  }

  // Calculate totals
  const totalBudget = budgets.reduce((sum, b) => sum + b.limit, 0)
  const totalSpent = budgets.reduce((sum, b) => sum + (b.spent || 0), 0)
  const overBudgetCount = budgets.filter(b => (b.spent || 0) > b.limit).length

  const categoryOptions = EXPENSE_CATEGORIES.map(cat => ({ value: cat, label: cat }))

  const getProgressColor = (spent: number, limit: number, threshold: number) => {
    const percentage = (spent / limit) * 100
    if (percentage >= 100) return 'bg-red-500'
    if (percentage >= threshold) return 'bg-yellow-500'
    return 'gradient-green'
  }

  const getStatusBadge = (spent: number, limit: number) => {
    const percentage = (spent / limit) * 100
    if (percentage >= 100) return { text: 'Over Budget', class: 'bg-red-100 dark:bg-red-900/30 text-red-600' }
    if (percentage >= 80) return { text: 'Warning', class: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600' }
    return { text: 'On Track', class: 'bg-green-100 dark:bg-green-900/30 text-green-600' }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Budgets</h1>
          <p className="text-gray-500 dark:text-gray-400">Set spending limits for each category</p>
        </div>
        <Button onClick={() => openModal()} icon={<PlusIcon className="w-5 h-5" />}>
          Create Budget
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Budget</p>
          <p className="text-2xl font-bold text-blue-500">{formatCurrency(totalBudget)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Spent</p>
          <p className={`text-2xl font-bold ${totalSpent > totalBudget ? 'text-red-500' : 'text-green-500'}`}>
            {formatCurrency(totalSpent)}
          </p>
        </Card>
        <Card className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Over Budget</p>
          <p className={`text-2xl font-bold ${overBudgetCount > 0 ? 'text-red-500' : 'text-green-500'}`}>
            {overBudgetCount} categories
          </p>
        </Card>
      </div>

      {/* Budgets Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      ) : budgets.length === 0 ? (
        <Card className="text-center py-12">
          <ChartPieIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No budgets set yet</p>
          <Button variant="outline" className="mt-4" onClick={() => openModal()}>
            Create your first budget
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgets.map((budget) => {
            const spent = budget.spent || 0
            const percentage = Math.min((spent / budget.limit) * 100, 100)
            const remaining = budget.limit - spent
            const status = getStatusBadge(spent, budget.limit)

            return (
              <Card key={budget._id}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{budget.category}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{budget.period}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${status.class}`}>
                    {status.text}
                  </span>
                </div>

                {/* Progress */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      {formatCurrency(spent)} spent
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getProgressColor(spent, budget.limit, budget.alertThreshold || 80)}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={remaining < 0 ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}>
                      {remaining < 0 ? 'Over by ' : 'Remaining: '}
                      {formatCurrency(Math.abs(remaining))}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      Limit: {formatCurrency(budget.limit)}
                    </span>
                  </div>
                </div>

                {/* Warning if near limit */}
                {spent >= budget.limit * 0.8 && spent < budget.limit && (
                  <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400 mb-4 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <ExclamationTriangleIcon className="w-4 h-4" />
                    <span>Approaching budget limit!</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t dark:border-gray-700">
                  <button
                    onClick={() => openModal(budget)}
                    className="flex-1 flex items-center justify-center gap-2 p-2 text-gray-500 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <PencilIcon className="w-4 h-4" />
                    <span className="text-sm">Edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(budget._id)}
                    className="flex-1 flex items-center justify-center gap-2 p-2 text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                    <span className="text-sm">Delete</span>
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingBudget ? 'Edit Budget' : 'Create Budget'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Select
            label="Category"
            options={[{ value: '', label: 'Select category' }, ...categoryOptions]}
            {...register('category', { required: 'Category is required' })}
            error={errors.category?.message as string}
          />
          
          <Input
            label={getCurrencyLabel('Budget Limit')}
            type="number"
            placeholder="10000"
            {...register('limit', { required: 'Limit is required', min: { value: 1, message: 'Must be positive' } })}
            error={errors.limit?.message as string}
          />

          <Select
            label="Period"
            options={[
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'yearly', label: 'Yearly' }
            ]}
            {...register('period')}
          />

          <Input
            label="Alert Threshold (%)"
            type="number"
            placeholder="80"
            {...register('alertThreshold', { min: { value: 0, message: 'Min 0' }, max: { value: 100, message: 'Max 100' } })}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
            Get alerted when spending reaches this percentage of the budget
          </p>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {editingBudget ? 'Update' : 'Create'} Budget
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
