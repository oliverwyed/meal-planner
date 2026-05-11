import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { isPushSubscribed, subscribeToPush } from '../lib/push'

export default function NotificationBanner() {
  const { user } = useAuth()
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [subscribing, setSubscribing] = useState(false)

  useEffect(() => {
    isPushSubscribed().then(setSubscribed)
  }, [])

  if (subscribed === null || subscribed === true) return null
  if (Notification.permission === 'denied') return null

  async function handleEnable() {
    setSubscribing(true)
    const ok = await subscribeToPush(user!.id)
    setSubscribed(ok)
    setSubscribing(false)
  }

  return (
    <div className="notification-banner">
      <span>Enable push notifications to get daily task reminders.</span>
      <button className="btn-primary btn-sm" onClick={handleEnable} disabled={subscribing}>
        {subscribing ? 'Enabling…' : 'Enable'}
      </button>
    </div>
  )
}
