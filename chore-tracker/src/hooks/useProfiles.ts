import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('profiles').select('*').order('name').then(({ data }) => {
      setProfiles((data as Profile[]) ?? [])
      setLoading(false)
    })
  }, [])

  return { profiles, loading }
}
