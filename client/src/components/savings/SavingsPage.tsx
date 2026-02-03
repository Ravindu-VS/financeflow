import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'react-hot-toast'
import { savingsService } from '../../services/firebaseService'
import { SavingsGoal } from '../../types'
import { Card, SectionHeader, Button, Modal, Input, Select, Textarea } from '../ui'
import { formatCurrency, getCurrencyLabel } from '../../utils/currency'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  WalletIcon,
  CheckCircleIcon,
  ArrowUpIcon
} from '@heroicons/react/24/outline'
import { Timestamp } from 'firebase/firestore'

export default function SavingsPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isContributeModalOpen, setIsContributeModalOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null)
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null)

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm()
  const { register: registerContribute, handleSubmit: handleContribute, reset: resetContribute, formState: { isSubmitting: isContributing } } = useForm()

  const fetchGoals = async () => {
    try {
      setLoading(true)
      const data = await savingsService.getAll()
      const transformed = data.map((item: any) => ({
        ...item,
        _id: item.id,
        targetDate: item.targetDate?.toDate ? item.targetDate.toDate().toISOString() : item.targetDate
      }))
      setGoals(transformed as SavingsGoal[])
    } catch (error) {
      toast.error('Failed to fetch savings goals')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGoals()
  }, [])

  const openModal = (goal?: SavingsGoal) => {
    if (goal) {
      setEditingGoal(goal)
      setValue('name', goal.name)
      setValue('targetAmount', goal.targetAmount)
      setValue('currentAmount', goal.currentAmount)
      setValue('targetDate', goal.targetDate?.split('T')[0])
      setValue('category', goal.category)
      setValue('priority', goal.priority)
      setValue('notes', goal.notes || '')
    } else {
      reset()
      setEditingGoal(null)
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingGoal(null)
    reset()
  }

  const openContributeModal = (goal: SavingsGoal) => {
    setSelectedGoal(goal)
    resetContribute()
    setIsContributeModalOpen(true)
  }

  const onSubmit = async (data: any) => {
    try {
      const goalData = {
        ...data,
        targetAmount: parseFloat(data.targetAmount),
        currentAmount: parseFloat(data.currentAmount || 0),
        targetDate: data.targetDate ? Timestamp.fromDate(new Date(data.targetDate)) : null
      }
      
      if (editingGoal) {
        await savingsService.update(editingGoal._id, goalData)
        toast.success('Goal updated successfully')
      } else {
        await savingsService.create(goalData)
        toast.success('Goal created successfully')
      }
      closeModal()
      fetchGoals()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save goal')
    }
  }

  const onContribute = async (data: any) => {
    if (!selectedGoal) return
    try {
      await savingsService.addContribution(selectedGoal._id, Number(data.amount), data.notes)
      toast.success('Contribution added successfully')
      setIsContributeModalOpen(false)
      setSelectedGoal(null)
      fetchGoals()
    } catch (error: any) {
      toast.error(error.message || 'Failed to add contribution')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) return
    try {
      await savingsService.delete(id)
      toast.success('Goal deleted successfully')
      fetchGoals()
    } catch (error) {
      toast.error('Failed to delete goal')
    }
  }

  // Calculate totals
  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0)
  const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0)
  const completedGoals = goals.filter(g => g.status === 'completed').length

  const categoryOptions = [
    { value: 'emergency', label: 'Emergency Fund' },
    { value: 'vacation', label: 'Vacation' },
    { value: 'home', label: 'Home' },
    { value: 'vehicle', label: 'Vehicle' },
    { value: 'education', label: 'Education' },
    { value: 'wedding', label: 'Wedding' },
    { value: 'retirement', label: 'Retirement' },
    { value: 'gadgets', label: 'Gadgets' },
    { value: 'other', label: 'Other' }
  ]

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      'active': 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      'completed': 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
      'paused': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
    }
    return badges[status] || badges['active']
  }

  const getPriorityBadge = (priority: string) => {
    const badges: Record<string, string> = {
      'high': 'bg-red-100 dark:bg-red-900/30 text-red-600',
      'medium': 'bg-orange-100 dark:bg-orange-900/30 text-orange-600',
      'low': 'bg-gray-100 dark:bg-gray-700 text-gray-600'
    }
    return badges[priority] || badges['medium']
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Savings Goals</h1>
          <p className="text-gray-500 dark:text-gray-400">Set and track your financial goals</p>
        </div>
        <Button onClick={() => openModal()} icon={<PlusIcon className="w-5 h-5" />}>
          New Goal
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Target</p>
          <p className="text-2xl font-bold text-blue-500">{formatCurrency(totalTarget)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Saved</p>
          <p className="text-2xl font-bold text-green-500">{formatCurrency(totalSaved)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Completed Goals</p>
          <p className="text-2xl font-bold text-purple-500">{completedGoals} / {goals.length}</p>
        </Card>
      </div>

      {/* Goals Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      ) : goals.length === 0 ? (
        <Card className="text-center py-12">
          <WalletIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No savings goals yet</p>
          <Button variant="outline" className="mt-4" onClick={() => openModal()}>
            Create your first goal
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map((goal) => {
            const progress = (goal.currentAmount / goal.targetAmount) * 100
            const daysLeft = goal.targetDate 
              ? Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null

            return (
              <Card key={goal._id} className="relative overflow-hidden">
                {goal.status === 'completed' && (
                  <div className="absolute top-2 right-2">
                    <CheckCircleIcon className="w-6 h-6 text-green-500" />
                  </div>
                )}
                
                <div className="mb-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{goal.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{goal.category}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityBadge(goal.priority)}`}>
                      {goal.priority}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Progress</span>
                      <span className="font-medium text-gray-900 dark:text-white">{progress.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          progress >= 100 ? 'bg-green-500' : 'gradient-green'
                        }`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        {formatCurrency(goal.currentAmount)}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatCurrency(goal.targetAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                {daysLeft !== null && daysLeft > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    {daysLeft} days left to reach target
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openContributeModal(goal)}
                    icon={<ArrowUpIcon className="w-4 h-4" />}
                    disabled={goal.status === 'completed'}
                  >
                    Add
                  </Button>
                  <button
                    onClick={() => openModal(goal)}
                    className="p-2 text-gray-400 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(goal._id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create/Edit Goal Modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingGoal ? 'Edit Goal' : 'Create Goal'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Goal Name"
            placeholder="e.g., Emergency Fund"
            {...register('name', { required: 'Name is required' })}
            error={errors.name?.message as string}
          />
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={getCurrencyLabel('Target Amount')}
              type="number"
              placeholder="100000"
              {...register('targetAmount', { required: 'Target amount is required', min: { value: 1, message: 'Must be positive' } })}
              error={errors.targetAmount?.message as string}
            />
            <Input
              label={getCurrencyLabel('Current Amount')}
              type="number"
              placeholder="0"
              {...register('currentAmount', { min: { value: 0, message: 'Cannot be negative' } })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Target Date"
              type="date"
              {...register('targetDate')}
            />
            <Select
              label="Category"
              options={[{ value: '', label: 'Select category' }, ...categoryOptions]}
              {...register('category', { required: 'Category is required' })}
              error={errors.category?.message as string}
            />
          </div>

          <Select
            label="Priority"
            options={[
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' }
            ]}
            {...register('priority')}
          />

          <Textarea
            label="Notes (Optional)"
            placeholder="Additional details about this goal..."
            {...register('notes')}
          />

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {editingGoal ? 'Update' : 'Create'} Goal
            </Button>
          </div>
        </form>
      </Modal>

      {/* Contribute Modal */}
      <Modal isOpen={isContributeModalOpen} onClose={() => setIsContributeModalOpen(false)} title={`Add to ${selectedGoal?.name}`}>
        <form onSubmit={handleContribute(onContribute)} className="space-y-4">
          <Input
            label={getCurrencyLabel('Amount')}
            type="number"
            placeholder="1000"
            {...registerContribute('amount', { required: 'Amount is required', min: { value: 1, message: 'Must be positive' } })}
          />
          <Input
            label="Notes (Optional)"
            placeholder="e.g., Monthly contribution"
            {...registerContribute('notes')}
          />
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setIsContributeModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isContributing}>
              Add Contribution
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
