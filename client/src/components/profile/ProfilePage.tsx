import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import { Card, SectionHeader, Button, Input, Select, Textarea } from '../ui'
import {
  UserCircleIcon,
  CameraIcon,
  EnvelopeIcon,
  PhoneIcon,
  CalendarIcon,
  PhotoIcon,
  TrashIcon
} from '@heroicons/react/24/outline'

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore()
  const [isEditing, setIsEditing] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handlePhotoClick = () => {
    fileInputRef.current?.click()
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB')
      return
    }

    setUploadingPhoto(true)
    try {
      // Convert to base64 for local storage
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        updateUser({ profile: { ...user?.profile, photoURL: base64 } })
        toast.success('Profile picture updated!')
        setUploadingPhoto(false)
      }
      reader.onerror = () => {
        toast.error('Failed to read image file')
        setUploadingPhoto(false)
      }
      reader.readAsDataURL(file)
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile picture')
      setUploadingPhoto(false)
    }
  }

  const handleRemovePhoto = () => {
    updateUser({ profile: { ...user?.profile, photoURL: undefined } })
    toast.success('Profile picture removed')
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
          <div className="relative group">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
            
            {/* Profile Picture */}
            {user?.profile?.photoURL ? (
              <img
                src={user.profile.photoURL}
                alt="Profile"
                className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-gray-700 shadow-lg"
              />
            ) : (
              <div className="w-24 h-24 rounded-full gradient-green flex items-center justify-center text-white text-3xl font-bold border-4 border-white dark:border-gray-700 shadow-lg">
                {user?.profile?.firstName?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            
            {/* Upload/Change button */}
            <button
              onClick={handlePhotoClick}
              disabled={uploadingPhoto}
              className="absolute bottom-0 right-0 w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Change profile picture"
            >
              {uploadingPhoto ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CameraIcon className="w-4 h-4" />
              )}
            </button>

            {/* Remove photo button (show on hover if photo exists) */}
            {user?.profile?.photoURL && (
              <button
                onClick={handleRemovePhoto}
                className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                title="Remove profile picture"
              >
                <TrashIcon className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {user?.profile?.firstName} {user?.profile?.lastName}
            </h2>
            <p className="text-gray-500 dark:text-gray-400">{user?.email}</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Member since {new Date(user?.createdAt || '').toLocaleDateString('en-LK', { month: 'long', year: 'numeric' })}
            </p>
            <button
              onClick={handlePhotoClick}
              disabled={uploadingPhoto}
              className="mt-2 text-sm text-primary-500 hover:text-primary-600 font-medium flex items-center gap-1"
            >
              <PhotoIcon className="w-4 h-4" />
              {user?.profile?.photoURL ? 'Change Photo' : 'Upload Photo'}
            </button>
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
                label="Monthly Income (Rs.)"
                type="number"
                placeholder="100000"
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
                    ? `Rs. ${Number(user.profile.monthlyIncome).toLocaleString('en-LK')}`
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
