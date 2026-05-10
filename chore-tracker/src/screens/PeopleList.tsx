import { useProfiles } from '../hooks/useProfiles'
import { useAuth } from '../lib/AuthContext'

export default function PeopleList() {
  const { profiles, loading } = useProfiles()
  const { profile: myProfile, signOut } = useAuth()

  if (loading) return <div className="loading">Loading…</div>

  return (
    <div className="screen">
      <h2>Household</h2>
      <p className="empty-state" style={{ marginBottom: '1rem' }}>
        Anyone who registers with this app joins the household automatically.
      </p>

      <ul className="task-list">
        {profiles.map(p => (
          <li key={p.id} className="task-card">
            <div className="task-info">
              <span className="task-name">
                {p.name}
                {p.id === myProfile?.id && <span className="badge">You</span>}
              </span>
              <span className="task-meta">{p.email}</span>
            </div>
          </li>
        ))}
      </ul>

      <button className="btn-secondary sign-out-btn" onClick={signOut}>
        Sign out
      </button>
    </div>
  )
}
