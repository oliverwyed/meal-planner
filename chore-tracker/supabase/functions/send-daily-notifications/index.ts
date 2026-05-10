import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-ignore — webpush is imported via esm.sh in the Deno runtime
import webpush from 'https://esm.sh/web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_MAILTO = Deno.env.get('VAPID_MAILTO')!

webpush.setVapidDetails(`mailto:${VAPID_MAILTO}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

Deno.serve(async (_req) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Fetch all tasks with assigned user's push subscriptions
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select(`
      id, name, recurrence_days, last_completed_at, assigned_to,
      profile:profiles!tasks_assigned_to_fkey(id, name),
      push_subscriptions(endpoint, p256dh, auth)
    `)

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  const notifications: Promise<void>[] = []

  for (const task of tasks ?? []) {
    const subs = (task as any).push_subscriptions as Array<{ endpoint: string; p256dh: string; auth: string }>
    if (!subs || subs.length === 0) continue

    const last = task.last_completed_at ? new Date(task.last_completed_at) : null
    const nextDue = last ? new Date(last.getTime() + task.recurrence_days * 86400000) : today
    nextDue.setHours(0, 0, 0, 0)

    const daysUntil = Math.round((nextDue.getTime() - today.getTime()) / 86400000)
    if (daysUntil > 0) continue // not yet due

    const profileName = (task as any).profile?.name ?? 'Someone'
    const body = daysUntil === 0
      ? `"${task.name}" is due today. Have you done it?`
      : `"${task.name}" is ${Math.abs(daysUntil)} day(s) overdue!`

    for (const sub of subs) {
      notifications.push(
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: `Hi ${profileName}!`, body, url: '/' })
        ).catch((err: Error) => {
          // Remove stale subscriptions (410 Gone)
          if ((err as any).statusCode === 410) {
            return supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          }
        })
      )
    }
  }

  await Promise.allSettled(notifications)

  return new Response(JSON.stringify({ sent: notifications.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
