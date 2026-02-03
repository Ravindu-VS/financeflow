import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'react-hot-toast'
import { investmentService } from '../../services/firebaseService'
import { Investment } from '../../types'
import { Card, SectionHeader, Button, Modal, Input, Select, Textarea } from '../ui'
import { formatCurrency, getCurrencyLabel } from '../../utils/currency'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { Timestamp } from 'firebase/firestore'

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4']

const INVESTMENT_TYPES = [
  'stocks', 'unit_trusts', 'fixed_deposit', 'treasury_bills', 'treasury_bonds', 
  'gold', 'real_estate', 'crypto', 'corporate_debentures', 'savings_certificates', 'other'
]

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null)

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm()

  const fetchInvestments = async () => {
    try {
      setLoading(true)
      const data = await investmentService.getAll()
      const transformed = data.map((item: any) => ({
        ...item,
        _id: item.id,
        purchaseDate: item.purchaseDate?.toDate ? item.purchaseDate.toDate().toISOString() : item.purchaseDate
      }))
      setInvestments(transformed as Investment[])
    } catch (error) {
      toast.error('Failed to fetch investments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvestments()
  }, [])

  const openModal = (investment?: Investment) => {
    if (investment) {
      setEditingInvestment(investment)
      setValue('name', investment.name)
      setValue('type', investment.type)
      setValue('amount', investment.amount)
      setValue('currentValue', investment.currentValue)
      setValue('purchaseDate', investment.purchaseDate?.split('T')[0])
      setValue('platform', investment.platform || '')
      setValue('notes', investment.notes || '')
    } else {
      reset()
      setEditingInvestment(null)
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingInvestment(null)
    reset()
  }

  const onSubmit = async (data: any) => {
    try {
      const investmentData = {
        ...data,
        amount: parseFloat(data.amount),
        currentValue: parseFloat(data.currentValue || data.amount),
        purchaseDate: data.purchaseDate ? Timestamp.fromDate(new Date(data.purchaseDate)) : null
      }
      
      if (editingInvestment) {
        await investmentService.update(editingInvestment._id, investmentData)
        toast.success('Investment updated successfully')
      } else {
        await investmentService.create(investmentData)
        toast.success('Investment added successfully')
      }
      closeModal()
      fetchInvestments()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save investment')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this investment?')) return
    try {
      await investmentService.delete(id)
      toast.success('Investment deleted successfully')
      fetchInvestments()
    } catch (error) {
      toast.error('Failed to delete investment')
    }
  }

  // Calculate totals
  const totalInvested = investments.reduce((sum, inv) => sum + inv.amount, 0)
  const totalCurrentValue = investments.reduce((sum, inv) => sum + (inv.currentValue || inv.amount), 0)
  const totalReturns = totalCurrentValue - totalInvested
  const returnPercentage = totalInvested > 0 ? ((totalReturns / totalInvested) * 100).toFixed(2) : '0'

  // Investment distribution for pie chart
  const investmentByType = INVESTMENT_TYPES.map(type => {
    const total = investments
      .filter(inv => inv.type === type)
      .reduce((sum, inv) => sum + (inv.currentValue || inv.amount), 0)
    return { name: type.replace('_', ' ').toUpperCase(), value: total }
  }).filter(item => item.value > 0)

  const typeOptions = INVESTMENT_TYPES.map(type => ({ 
    value: type, 
    label: type.replace('_', ' ').toUpperCase() 
  }))

  const getReturnColor = (investment: Investment) => {
    const returns = (investment.currentValue || investment.amount) - investment.amount
    if (returns > 0) return 'text-green-500'
    if (returns < 0) return 'text-red-500'
    return 'text-gray-500'
  }

  const getReturnIcon = (investment: Investment) => {
    const returns = (investment.currentValue || investment.amount) - investment.amount
    if (returns > 0) return <ArrowTrendingUpIcon className="w-4 h-4" />
    if (returns < 0) return <ArrowTrendingDownIcon className="w-4 h-4" />
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Investments</h1>
          <p className="text-gray-500 dark:text-gray-400">Track your investment portfolio</p>
        </div>
        <Button onClick={() => openModal()} icon={<PlusIcon className="w-5 h-5" />}>
          Add Investment
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Invested</p>
          <p className="text-2xl font-bold text-blue-500">{formatCurrency(totalInvested)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Current Value</p>
          <p className="text-2xl font-bold text-purple-500">{formatCurrency(totalCurrentValue)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Returns</p>
          <p className={`text-2xl font-bold ${totalReturns >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {totalReturns >= 0 ? '+' : ''}{formatCurrency(totalReturns)}
          </p>
        </Card>
        <Card className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Return %</p>
          <p className={`text-2xl font-bold ${Number(returnPercentage) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {Number(returnPercentage) >= 0 ? '+' : ''}{returnPercentage}%
          </p>
        </Card>
      </div>

      {/* Charts and List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Portfolio Distribution */}
        <Card>
          <SectionHeader title="Portfolio Distribution" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={investmentByType}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {investmentByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                  formatter={(value: number) => [formatCurrency(value), '']}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Investments List */}
        <Card className="lg:col-span-2" padding="none">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
          ) : investments.length === 0 ? (
            <div className="text-center py-12">
              <ChartBarIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No investments yet</p>
              <Button variant="outline" className="mt-4" onClick={() => openModal()}>
                Add your first investment
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 text-left text-sm text-gray-500 dark:text-gray-400">
                    <th className="p-4 font-medium">Investment</th>
                    <th className="p-4 font-medium">Type</th>
                    <th className="p-4 font-medium text-right">Invested</th>
                    <th className="p-4 font-medium text-right">Current</th>
                    <th className="p-4 font-medium text-right">Returns</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {investments.map((investment) => {
                    const returns = (investment.currentValue || investment.amount) - investment.amount
                    const returnPct = ((returns / investment.amount) * 100).toFixed(1)
                    
                    return (
                      <tr key={investment._id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                              <ChartBarIcon className="w-5 h-5 text-purple-500" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{investment.name}</p>
                              {investment.platform && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">{investment.platform}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase">
                            {investment.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4 text-right text-gray-900 dark:text-white">
                          {formatCurrency(investment.amount)}
                        </td>
                        <td className="p-4 text-right text-gray-900 dark:text-white">
                          {formatCurrency(investment.currentValue || investment.amount)}
                        </td>
                        <td className={`p-4 text-right font-medium ${getReturnColor(investment)}`}>
                          <div className="flex items-center justify-end gap-1">
                            {getReturnIcon(investment)}
                            <span>
                              {returns >= 0 ? '+' : ''}{formatCurrency(returns)} ({returnPct}%)
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openModal(investment)}
                              className="p-2 text-gray-400 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(investment._id)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingInvestment ? 'Edit Investment' : 'Add Investment'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Investment Name"
            placeholder="e.g., Nifty 50 Index Fund"
            {...register('name', { required: 'Name is required' })}
            error={errors.name?.message as string}
          />
          
          <Select
            label="Type"
            options={[{ value: '', label: 'Select type' }, ...typeOptions]}
            {...register('type', { required: 'Type is required' })}
            error={errors.type?.message as string}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={getCurrencyLabel('Invested Amount')}
              type="number"
              placeholder="10000"
              {...register('amount', { required: 'Amount is required', min: { value: 1, message: 'Must be positive' } })}
              error={errors.amount?.message as string}
            />
            <Input
              label={getCurrencyLabel('Current Value')}
              type="number"
              placeholder="12000"
              {...register('currentValue')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Purchase Date"
              type="date"
              {...register('purchaseDate')}
            />
            <Input
              label="Platform"
              placeholder="e.g., Zerodha, Groww"
              {...register('platform')}
            />
          </div>

          <Textarea
            label="Notes (Optional)"
            placeholder="Additional details..."
            {...register('notes')}
          />

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {editingInvestment ? 'Update' : 'Add'} Investment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
