import { useTasks } from '../hooks/useTasks'
import { useAuth } from '../lib/AuthContext'
import { getDueStatus, daysUntilDue } from '../types'
import type { Task } from '../types'

export default function TodayView() {
  const { tasks, loading, markDone } = useTasks()
  const { user } = useAuth()

  const actionable = tasks
    .filter(t => {
      const s = getDueStatus(t)
      return s === 'overdue' || s === 'due-today'
    })
    .sort((a, b) => daysUntilDue(a) - daysUntilDue(b))

  const upcoming = tasks
    .filter(t => getDueStatus(t) === 'upcoming')
    .sort((a, b) => daysUntilDue(a) - daysUntilDue(b))

  if (loading) return <div className="loading">Loading…</div>

  return (
    <div className="screen">
      <h2>Today</h2>

      {actionable.length === 0 && (
        <p className="empty-state">All caught up! Nothing overdue or due today.</p>
      )}

      {actionable.length > 0 && (
        <section>
          <h3 className="section-label">Needs attention</h3>
          <ul className="task-list">
            {actionable.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onMarkDone={() => markDone(task.id, user!.id)}
              />
            ))}
          </ul>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <h3 className="section-label">Coming up</h3>
          <ul className="task-list">
            {upcoming.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function TaskCard({ task, onMarkDone }: { task: Task; onMarkDone?: () => void }) {
  const status = getDueStatus(task)
  const days = daysUntilDue(task)

  const statusLabel =
    status === 'overdue' ? `${Math.abs(days)}d overdue` :
    status === 'due-today' ? 'Due today' :
    `Due in ${days}d`

  return (
    <li className={`task-card status-${status}`}>
      <div className="task-info">
        <span className="task-name">{task.name}</span>
        <span className="task-meta">
          {task.profile?.name ?? 'Unassigned'} · {statusLabel}
        </span>
      </div>
      {onMarkDone && (
        <button className="btn-done" onClick={onMarkDone} aria-label="Mark done">
          ✓
        </button>
      )}
    </li>
  )
}
