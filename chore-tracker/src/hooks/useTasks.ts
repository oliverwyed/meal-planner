import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Task } from '../types'

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*, profile:profiles!tasks_assigned_to_fkey(id, name, email)')
      .order('created_at', { ascending: true })
    setTasks((data as Task[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  async function markDone(taskId: string, userId: string) {
    const now = new Date().toISOString()
    await supabase.from('completions').insert({ task_id: taskId, completed_by: userId, completed_at: now })
    await supabase.from('tasks').update({ last_completed_at: now }).eq('id', taskId)
    await fetchTasks()
  }

  async function createTask(task: { name: string; recurrence_days: number; assigned_to: string; created_by: string }) {
    await supabase.from('tasks').insert(task)
    await fetchTasks()
  }

  async function updateTask(id: string, updates: Partial<Pick<Task, 'name' | 'recurrence_days' | 'assigned_to'>>) {
    await supabase.from('tasks').update(updates).eq('id', id)
    await fetchTasks()
  }

  async function deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id)
    await fetchTasks()
  }

  return { tasks, loading, markDone, createTask, updateTask, deleteTask, refresh: fetchTasks }
}
