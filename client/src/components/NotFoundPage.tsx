import { Link } from 'react-router-dom'
import { Button } from './ui'
import { HomeIcon } from '@heroicons/react/24/outline'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-primary-500">404</h1>
        <div className="mt-4">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Page Not Found
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md">
            Oops! The page you're looking for doesn't exist. It might have been moved or deleted.
          </p>
          <Link to="/dashboard">
            <Button icon={<HomeIcon className="w-5 h-5" />}>
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
