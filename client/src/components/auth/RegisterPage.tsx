import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { toast } from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import { authService } from '../../services/firebaseService'
import { Button, Input } from '../ui'
import { EyeIcon, EyeSlashIcon, EnvelopeIcon, LockClosedIcon, UserIcon } from '@heroicons/react/24/outline'

interface RegisterFormData {
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
}

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const navigate = useNavigate()
  const { register: registerUser } = useAuthStore()

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<RegisterFormData>()
  const password = watch('password')

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await registerUser({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName
      })
      toast.success('Account created successfully!')
      navigate('/dashboard')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create account')
    }
  }
  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true)
    try {
      await authService.loginWithGoogle()
      toast.success('Account created successfully!')
      navigate('/dashboard')
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign up with Google')
    } finally {
      setIsGoogleLoading(false)
    }
  }
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Create Account
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Start your journey to financial freedom
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="First Name"
            placeholder="John"
            icon={<UserIcon className="w-5 h-5" />}
            {...register('firstName', {
              required: 'First name is required'
            })}
            error={errors.firstName?.message}
          />
          <Input
            label="Last Name"
            placeholder="Doe"
            {...register('lastName', {
              required: 'Last name is required'
            })}
            error={errors.lastName?.message}
          />
        </div>

        <Input
          label="Email Address"
          type="email"
          placeholder="you@example.com"
          icon={<EnvelopeIcon className="w-5 h-5" />}
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Invalid email address'
            }
          })}
          error={errors.email?.message}
        />

        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Create a strong password"
          icon={<LockClosedIcon className="w-5 h-5" />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showPassword ? (
                <EyeSlashIcon className="w-5 h-5" />
              ) : (
                <EyeIcon className="w-5 h-5" />
              )}
            </button>
          }
          {...register('password', {
            required: 'Password is required',
            minLength: {
              value: 8,
              message: 'Password must be at least 8 characters'
            },
            pattern: {
              value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
              message: 'Must contain uppercase, lowercase and number'
            }
          })}
          error={errors.password?.message}
        />

        <Input
          label="Confirm Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Confirm your password"
          icon={<LockClosedIcon className="w-5 h-5" />}
          {...register('confirmPassword', {
            required: 'Please confirm your password',
            validate: value =>
              value === password || 'Passwords do not match'
          })}
          error={errors.confirmPassword?.message}
        />

        {/* Password strength indicator */}
        {password && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">Password strength</p>
            <div className="flex gap-1">
              <div className={`h-1 flex-1 rounded ${password.length >= 8 ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
              <div className={`h-1 flex-1 rounded ${/[A-Z]/.test(password) ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
              <div className={`h-1 flex-1 rounded ${/[a-z]/.test(password) ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
              <div className={`h-1 flex-1 rounded ${/\d/.test(password) ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
              <div className={`h-1 flex-1 rounded ${/[^A-Za-z0-9]/.test(password) ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className={password.length >= 8 ? 'text-green-500' : ''}>8+ chars</span>
              <span className={/[A-Z]/.test(password) ? 'text-green-500' : ''}>Uppercase</span>
              <span className={/[a-z]/.test(password) ? 'text-green-500' : ''}>Lowercase</span>
              <span className={/\d/.test(password) ? 'text-green-500' : ''}>Number</span>
              <span className={/[^A-Za-z0-9]/.test(password) ? 'text-green-500' : ''}>Special</span>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            id="terms"
            className="mt-1 rounded text-primary-500"
            required
          />
          <label htmlFor="terms" className="text-sm text-gray-600 dark:text-gray-400">
            I agree to the{' '}
            <a href="#" className="text-primary-500 hover:text-primary-600">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-primary-500 hover:text-primary-600">Privacy Policy</a>
          </label>
        </div>

        <Button type="submit" className="w-full" loading={isSubmitting}>
          Create Account
        </Button>
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-gray-700" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-gray-900 text-gray-500">
              Or sign up with
            </span>
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGoogleLoading ? (
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            {isGoogleLoading ? 'Signing up...' : 'Continue with Google'}
          </button>
        </div>
      </div>

      <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
        Already have an account?{' '}
        <Link to="/login" className="text-primary-500 hover:text-primary-600 font-medium">
          Sign in
        </Link>
      </p>
    </div>
  )
}
