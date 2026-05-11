import { useState } from 'react'
import { useTasks } from '../hooks/useTasks'
import { getDueStatus, daysUntilDue } from '../types'
import type { Task } from '../types'
import TaskForm from './TaskForm'

export default function TaskList() {
  const { tasks, loading, deleteTask } = useTasks()
  const [editing, setEditing] = useState<Task | null>(null)
  const [adding, setAdding] = useState(false)

  const sorted = [...tasks].sort((a, b) => daysUntilDue(a) - daysUntilDue(b))

  if (loading) return <div className="loading">Loading…</div>

  if (editing) {
    return <TaskForm task={editing} onDone={() => setEditing(null)} />
  }
  if (adding) {
    return <TaskForm onDone={() => setAdding(false)} />
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h2>All Tasks</h2>
        <button className="btn-primary" onClick={() => setAdding(true)}>+ Add task</button>
      </div>

      {tasks.length === 0 && (
        <p className="empty-state">No tasks yet. Add one to get started.</p>
      )}

      <ul className="task-list">
        {sorted.map(task => {
          const status = getDueStatus(task)
          const days = daysUntilDue(task)
          const statusLabel =
            status === 'overdue' ? `${Math.abs(days)}d overdue` :
            status === 'due-today' ? 'Due today' :
            status === 'upcoming' ? `Due in ${days}d` :
            `Due in ${days}d`

          return (
            <li key={task.id} className={`task-card status-${status}`}>
              <div className="task-info">
                <span className="task-name">{task.name}</span>
                <span className="task-meta">
                  {task.profile?.name ?? 'Unassigned'} · every {task.recurrence_days}d · {statusLabel}
                </span>
              </div>
              <div className="task-actions">
                <button className="btn-icon" onClick={() => setEditing(task)} aria-label="Edit">✏️</button>
                <button className="btn-icon btn-danger" onClick={() => deleteTask(task.id)} aria-label="Delete">🗑</button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
