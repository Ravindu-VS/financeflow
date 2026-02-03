import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import { useThemeStore } from '../../store/themeStore'
import { authService } from '../../services/firebaseService'
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { auth } from '../../config/firebase'
import { Card, SectionHeader, Button, Input, Select } from '../ui'
import {
  Cog6ToothIcon,
  BellIcon,
  ShieldCheckIcon,
  CurrencyRupeeIcon,
  MoonIcon,
  SunIcon,
  KeyIcon
} from '@heroicons/react/24/outline'

export default function SettingsPage() {
  const { user, updateUser } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const [activeTab, setActiveTab] = useState<'preferences' | 'notifications' | 'security'>('preferences')
  const [loading, setLoading] = useState(false)

  const { register: registerPrefs, handleSubmit: handlePrefs, formState: { isSubmitting: isSubmittingPrefs } } = useForm({
    defaultValues: {
      currency: user?.preferences?.currency || 'LKR',
      language: user?.preferences?.language || 'en',
      dateFormat: user?.preferences?.dateFormat || 'DD/MM/YYYY'
    }
  })

  const { register: registerNotif, handleSubmit: handleNotif, formState: { isSubmitting: isSubmittingNotif } } = useForm({
    defaultValues: {
      emailNotifications: user?.preferences?.emailNotifications ?? true,
      budgetAlerts: user?.preferences?.budgetAlerts ?? true,
      weeklyReport: user?.preferences?.weeklyReport ?? true,
      savingsReminders: user?.preferences?.savingsReminders ?? true
    }
  })

  const { register: registerSecurity, handleSubmit: handleSecurity, watch: watchSecurity, formState: { errors: securityErrors, isSubmitting: isSubmittingSecurity } } = useForm()

  const onPrefsSubmit = async (data: any) => {
    try {
      updateUser({ preferences: { ...user?.preferences, ...data } })
      toast.success('Preferences updated successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to update preferences')
    }
  }

  const onNotifSubmit = async (data: any) => {
    try {
      updateUser({ preferences: { ...user?.preferences, ...data } })
      toast.success('Notification settings updated')
    } catch (error: any) {
      toast.error(error.message || 'Failed to update notifications')
    }
  }

  const onSecuritySubmit = async (data: any) => {
    if (data.newPassword !== data.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    try {
      const currentUser = auth.currentUser
      if (!currentUser || !currentUser.email) {
        toast.error('User not authenticated')
        return
      }
      
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(currentUser.email, data.currentPassword)
      await reauthenticateWithCredential(currentUser, credential)
      
      // Update password
      await updatePassword(currentUser, data.newPassword)
      toast.success('Password changed successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to change password')
    }
  }

  const tabs = [
    { id: 'preferences', name: 'Preferences', icon: Cog6ToothIcon },
    { id: 'notifications', name: 'Notifications', icon: BellIcon },
    { id: 'security', name: 'Security', icon: ShieldCheckIcon }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400">Manage your account preferences and security</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-primary-500 text-primary-500'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            {tab.name}
          </button>
        ))}
      </div>

      {/* Preferences Tab */}
      {activeTab === 'preferences' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Theme */}
          <Card>
            <SectionHeader title="Appearance" subtitle="Customize the look and feel" />
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <div className="flex items-center gap-3">
                {theme === 'dark' ? (
                  <MoonIcon className="w-6 h-6 text-purple-500" />
                ) : (
                  <SunIcon className="w-6 h-6 text-yellow-500" />
                )}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Theme</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {theme === 'dark' ? 'Dark mode' : 'Light mode'}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={toggleTheme}>
                {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
              </Button>
            </div>
          </Card>

          {/* Regional Settings */}
          <Card>
            <SectionHeader title="Regional Settings" />
            <form onSubmit={handlePrefs(onPrefsSubmit)} className="space-y-4">
              <Select
                label="Currency"
                options={[
                  { value: 'LKR', label: 'Rs. Sri Lankan Rupee (LKR)' },
                  { value: 'INR', label: '₹ Indian Rupee (INR)' },
                  { value: 'USD', label: '$ US Dollar (USD)' },
                  { value: 'EUR', label: '€ Euro (EUR)' },
                  { value: 'GBP', label: '£ British Pound (GBP)' }
                ]}
                {...registerPrefs('currency')}
              />
              <Select
                label="Language"
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'si', label: 'සිංහල (Sinhala)' },
                  { value: 'ta', label: 'தமிழ் (Tamil)' },
                  { value: 'hi', label: 'हिन्दी (Hindi)' }
                ]}
                {...registerPrefs('language')}
              />
              <Select
                label="Date Format"
                options={[
                  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' }
                ]}
                {...registerPrefs('dateFormat')}
              />
              <Button type="submit" loading={isSubmittingPrefs}>
                Save Preferences
              </Button>
            </form>
          </Card>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <Card>
          <SectionHeader title="Notification Preferences" subtitle="Choose what you want to be notified about" />
          <form onSubmit={handleNotif(onNotifSubmit)} className="space-y-4">
            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl cursor-pointer">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Email Notifications</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Receive updates via email</p>
                </div>
                <input
                  type="checkbox"
                  {...registerNotif('emailNotifications')}
                  className="w-5 h-5 text-primary-500 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl cursor-pointer">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Budget Alerts</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Get notified when approaching budget limits</p>
                </div>
                <input
                  type="checkbox"
                  {...registerNotif('budgetAlerts')}
                  className="w-5 h-5 text-primary-500 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl cursor-pointer">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Weekly Report</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Receive weekly financial summary</p>
                </div>
                <input
                  type="checkbox"
                  {...registerNotif('weeklyReport')}
                  className="w-5 h-5 text-primary-500 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl cursor-pointer">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Savings Reminders</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Remind me to contribute to savings goals</p>
                </div>
                <input
                  type="checkbox"
                  {...registerNotif('savingsReminders')}
                  className="w-5 h-5 text-primary-500 rounded"
                />
              </label>
            </div>

            <Button type="submit" loading={isSubmittingNotif}>
              Save Notification Settings
            </Button>
          </form>
        </Card>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <SectionHeader title="Change Password" subtitle="Update your password regularly for security" />
            <form onSubmit={handleSecurity(onSecuritySubmit)} className="space-y-4">
              <Input
                label="Current Password"
                type="password"
                placeholder="Enter current password"
                {...registerSecurity('currentPassword', { required: 'Current password is required' })}
                error={securityErrors.currentPassword?.message as string}
              />
              <Input
                label="New Password"
                type="password"
                placeholder="Enter new password"
                {...registerSecurity('newPassword', { 
                  required: 'New password is required',
                  minLength: { value: 8, message: 'Password must be at least 8 characters' }
                })}
                error={securityErrors.newPassword?.message as string}
              />
              <Input
                label="Confirm New Password"
                type="password"
                placeholder="Confirm new password"
                {...registerSecurity('confirmPassword', { required: 'Please confirm password' })}
                error={securityErrors.confirmPassword?.message as string}
              />
              <Button type="submit" loading={isSubmittingSecurity} icon={<KeyIcon className="w-5 h-5" />}>
                Update Password
              </Button>
            </form>
          </Card>

          <Card>
            <SectionHeader title="Account Security" subtitle="Additional security options" />
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <ShieldCheckIcon className="w-6 h-6 text-green-500" />
                  <p className="font-medium text-gray-900 dark:text-white">Two-Factor Authentication</p>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  Add an extra layer of security to your account
                </p>
                <Button variant="outline" size="sm" disabled>
                  Coming Soon
                </Button>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <KeyIcon className="w-6 h-6 text-blue-500" />
                  <p className="font-medium text-gray-900 dark:text-white">PIN Lock</p>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  Set a PIN to quickly access sensitive data
                </p>
                <Button variant="outline" size="sm" disabled>
                  Configure PIN
                </Button>
              </div>

              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                <p className="font-medium text-red-600 dark:text-red-400 mb-2">Danger Zone</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Permanently delete your account and all data
                </p>
                <Button variant="danger" size="sm">
                  Delete Account
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
