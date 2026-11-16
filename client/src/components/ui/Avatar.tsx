import { useAuthStore } from '../../store/authStore'

/** The signed-in user's photo, or their initial on the brand gradient. */
export default function Avatar({ size = 40, className = '' }: { size?: number; className?: string }) {
  const user = useAuthStore(s => s.user)
  const src = user?.profile?.avatar
  const initial = (user?.profile?.firstName?.[0] || user?.email?.[0] || 'U').toUpperCase()
  const style = { width: size, height: size }
  return src
    ? <img src={src} alt="Profile" style={style} className={`rounded-full object-cover ring-2 ring-white dark:ring-gray-800 ${className}`} />
    : <span style={{ ...style, fontSize: size * 0.42 }} className={`gradient-green rounded-full inline-flex items-center justify-center text-white font-semibold ${className}`}>{initial}</span>
}
