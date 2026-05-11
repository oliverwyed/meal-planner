import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTasks } from '../hooks/useTasks'
import { useProfiles } from '../hooks/useProfiles'
import { useAuth } from '../lib/AuthContext'
import type { Task } from '../types'

interface Props {
  task?: Task
  onDone: () => void
}

export default function TaskForm({ task, onDone }: Props) {
  const { createTask, updateTask } = useTasks()
  const { profiles } = useProfiles()
  const { user } = useAuth()

  const [name, setName] = useState(task?.name ?? '')
  const [recurrenceDays, setRecurrenceDays] = useState(task?.recurrence_days ?? 7)
  const [assignedTo, setAssignedTo] = useState(task?.assigned_to ?? user?.id ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    if (task) {
      await updateTask(task.id, { name, recurrence_days: recurrenceDays, assigned_to: assignedTo })
    } else {
      await createTask({ name, recurrence_days: recurrenceDays, assigned_to: assignedTo, created_by: user!.id })
    }
    setSaving(false)
    onDone()
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="btn-back" onClick={onDone}>← Back</button>
        <h2>{task ? 'Edit Task' : 'New Task'}</h2>
      </div>

      <form onSubmit={handleSubmit} className="task-form">
        <label>
          Task name
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Vacuum living room"
            required
          />
        </label>

        <label>
          Repeat every
          <div className="recurrence-row">
            <input
              type="number"
              min={1}
              max={365}
              value={recurrenceDays}
              onChange={e => setRecurrenceDays(Number(e.target.value))}
              required
            />
            <span>days</span>
          </div>
        </label>

        <label>
          Assigned to
          <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} required>
            <option value="">Select person…</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onDone}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : task ? 'Save changes' : 'Add task'}
          </button>
        </div>
      </form>
    </div>
  )
}
