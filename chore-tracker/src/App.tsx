import { useState } from 'react'
import { useAuth } from './lib/AuthContext'
import AuthScreen from './screens/AuthScreen'
import TodayView from './screens/TodayView'
import TaskList from './screens/TaskList'
import PeopleList from './screens/PeopleList'
import BottomNav from './components/BottomNav'
import NotificationBanner from './components/NotificationBanner'
import './App.css'

type Tab = 'today' | 'tasks' | 'people'

export default function App() {
  const { session, loading } = useAuth()
  const [tab, setTab] = useState<Tab>('today')

  if (loading) {
    return (
      <div className="splash">
        <p>Loading…</p>
      </div>
    )
  }

  if (!session) return <AuthScreen />

  return (
    <div className="app">
      <NotificationBanner />
      <main className="main-content">
        {tab === 'today' && <TodayView />}
        {tab === 'tasks' && <TaskList />}
        {tab === 'people' && <PeopleList />}
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}
