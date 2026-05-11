export interface Profile {
  id: string
  name: string
  email: string
}

export interface Task {
  id: string
  name: string
  recurrence_days: number
  assigned_to: string
  last_completed_at: string | null
  created_at: string
  profile?: Profile
}

export interface Completion {
  id: string
  task_id: string
  completed_by: string
  completed_at: string
}

export interface PushSubscriptionRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

export type DueStatus = 'overdue' | 'due-today' | 'upcoming' | 'done'

export function getDueStatus(task: Task): DueStatus {
  if (!task.last_completed_at) return 'overdue'
  const last = new Date(task.last_completed_at)
  const nextDue = new Date(last)
  nextDue.setDate(nextDue.getDate() + task.recurrence_days)

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const nextDueDay = new Date(nextDue.getFullYear(), nextDue.getMonth(), nextDue.getDate())

  const diffDays = Math.round((nextDueDay.getTime() - today.getTime()) / 86400000)

  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'due-today'
  if (diffDays <= 2) return 'upcoming'
  return 'done'
}

export function daysUntilDue(task: Task): number {
  if (!task.last_completed_at) return -999
  const last = new Date(task.last_completed_at)
  const nextDue = new Date(last)
  nextDue.setDate(nextDue.getDate() + task.recurrence_days)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const nextDueDay = new Date(nextDue.getFullYear(), nextDue.getMonth(), nextDue.getDate())
  return Math.round((nextDueDay.getTime() - today.getTime()) / 86400000)
}
