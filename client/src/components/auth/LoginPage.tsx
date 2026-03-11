import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { toast } from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import { GOOGLE_CLIENT_ID } from '../../config/firebase'
import { Button, Input } from '../ui'
import { EyeIcon, EyeSlashIcon, EnvelopeIcon, LockClosedIcon } from '@heroicons/react/24/outline'

interface LoginFormData {
  email: string
  password: string
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const navigate = useNavigate()
  const { login, loginWithGoogle } = useAuthStore()
  const googleBtnRef = useRef<HTMLDivElement>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>()

  // Initialize Google Sign-In button
  const initGoogleButton = useCallback(() => {
    const goog = (window as any).google
    if (!goog?.accounts?.id || !GOOGLE_CLIENT_ID || !googleBtnRef.current) return

    goog.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response: any) => {
        if (!response.credential) return
        setIsGoogleLoading(true)
        try {
          await loginWithGoogle(response.credential)
          toast.success('Welcome!')
        } catch (error: any) {
          toast.error(error.message || 'Google sign-in failed')
        } finally {
          setIsGoogleLoading(false)
        }
      }
    })

    // Clear previous button
    googleBtnRef.current.innerHTML = ''

    goog.accounts.id.renderButton(googleBtnRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      width: googleBtnRef.current.offsetWidth,
      text: 'continue_with'
    })
  }, [loginWithGoogle])

  useEffect(() => {
    // Try immediately
    initGoogleButton()

    // Also retry when GIS script loads (it's async)
    const interval = setInterval(() => {
      if ((window as any).google?.accounts?.id) {
        initGoogleButton()
        clearInterval(interval)
      }
    }, 500)

    return () => clearInterval(interval)
  }, [initGoogleButton])

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password)
      toast.success('Welcome back!')
      navigate('/dashboard')
    } catch (error: any) {
      toast.error(error.message || 'Invalid email or password')
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Welcome Back
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Sign in to access your financial dashboard
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
          placeholder="Enter your password"
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
              value: 6,
              message: 'Password must be at least 6 characters'
            }
          })}
          error={errors.password?.message}
        />

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="rounded text-primary-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Remember me</span>
          </label>
          <Link
            to="/forgot-password"
            className="text-sm text-primary-500 hover:text-primary-600"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className="w-full" loading={isSubmitting}>
          Sign In
        </Button>
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-gray-700" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-gray-900 text-gray-500">
              Or continue with
            </span>
          </div>
        </div>

        <div className="mt-6">
          {isGoogleLoading ? (
            <div className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-primary-500 rounded-full animate-spin" />
              <span className="text-gray-700 dark:text-gray-300">Signing in...</span>
            </div>
          ) : (
            <div ref={googleBtnRef} className="flex justify-center" />
          )}
        </div>
      </div>

      <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
        Don't have an account?{' '}
        <Link to="/register" className="text-primary-500 hover:text-primary-600 font-medium">
          Sign up for free
        </Link>
      </p>
    </div>
  )
}
