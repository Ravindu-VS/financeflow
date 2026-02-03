import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import { Card, SectionHeader, Button, Input, Select, Textarea } from '../ui'
import {
  UserCircleIcon,
  CameraIcon,
  EnvelopeIcon,
  PhoneIcon,
  CalendarIcon
} from '@heroicons/react/24/outline'

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore()
  const [isEditing, setIsEditing] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      firstName: user?.profile?.firstName || '',
      lastName: user?.profile?.lastName || '',
      phone: user?.profile?.phone || '',
      dateOfBirth: user?.profile?.dateOfBirth?.split('T')[0] || '',
      occupation: user?.profile?.occupation || '',
      monthlyIncome: user?.profile?.monthlyIncome || '',
      bio: user?.profile?.bio || ''
    }
  })

  const onSubmit = async (data: any) => {
    try {
      updateUser({ profile: { ...user?.profile, ...data } })
      setIsEditing(false)
      toast.success('Profile updated successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your personal information</p>
        </div>
        <Button
          variant={isEditing ? 'outline' : 'primary'}
          onClick={() => setIsEditing(!isEditing)}
        >
          {isEditing ? 'Cancel' : 'Edit Profile'}
        </Button>
      </div>

      {/* Profile Card */}
      <Card>
        <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <div className="w-24 h-24 rounded-full gradient-green flex items-center justify-center text-white text-3xl font-bold">
              {user?.profile?.firstName?.[0]?.toUpperCase() || 'U'}
            </div>
            <button className="absolute bottom-0 right-0 w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white hover:bg-primary-600 transition-colors">
              <CameraIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {user?.profile?.firstName} {user?.profile?.lastName}
            </h2>
            <p className="text-gray-500 dark:text-gray-400">{user?.email}</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Member since {new Date(user?.createdAt || '').toLocaleDateString('en-LK', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit(onSubmit)} className="pt-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First Name"
                placeholder="John"
                {...register('firstName', { required: 'First name is required' })}
                error={errors.firstName?.message as string}
              />
              <Input
                label="Last Name"
                placeholder="Doe"
                {...register('lastName', { required: 'Last name is required' })}
                error={errors.lastName?.message as string}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Phone Number"
                placeholder="+91 98765 43210"
                {...register('phone')}
              />
              <Input
                label="Date of Birth"
                type="date"
                {...register('dateOfBirth')}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Occupation"
                placeholder="Software Engineer"
                {...register('occupation')}
              />
              <Input
                label="Monthly Income (₹)"
                type="number"
                placeholder="50000"
                {...register('monthlyIncome')}
              />
            </div>

            <Textarea
              label="Bio"
              placeholder="Tell us about yourself..."
              {...register('bio')}
            />

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                Save Changes
              </Button>
            </div>
          </form>
        ) : (
          <div className="pt-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <EnvelopeIcon className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                  <p className="font-medium text-gray-900 dark:text-white">{user?.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <PhoneIcon className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {user?.profile?.phone || 'Not set'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <CalendarIcon className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Date of Birth</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {user?.profile?.dateOfBirth 
                      ? new Date(user.profile.dateOfBirth).toLocaleDateString('en-LK', { day: 'numeric', month: 'long', year: 'numeric' })
                      : 'Not set'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Occupation</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {user?.profile?.occupation || 'Not set'}
                </p>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Monthly Income</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {user?.profile?.monthlyIncome 
                    ? `₹${Number(user.profile.monthlyIncome).toLocaleString('en-IN')}`
                    : 'Not set'}
                </p>
              </div>
            </div>

            {user?.profile?.bio && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Bio</p>
                <p className="text-gray-900 dark:text-white">{user.profile.bio}</p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="text-center">
          <p className="text-2xl font-bold text-primary-500">0</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Income Entries</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-red-500">0</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Expense Entries</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-blue-500">0</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Savings Goals</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-purple-500">0</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Investments</p>
        </Card>
      </div>
    </div>
  )
}
