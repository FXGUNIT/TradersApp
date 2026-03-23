// In-memory invites with localStorage persistence for testing admin invites flow
import { useEffect, useState, useCallback } from 'react'

const STORAGE_KEY = 'TradersApp_Invites'

export function useInvites() {
  const [invites, setInvites] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(invites))
    } catch {
      // ignore
    }
  }, [invites])

  const addInvite = useCallback((email, name) => {
    const id = 'INV-' + Date.now()
    const invite = { id, email, name, status: 'PENDING', createdAt: Date.now() }
    setInvites(prev => [invite, ...prev])
    return invite
  }, [])

  const approveInvite = useCallback((id) => {
    setInvites(prev => prev.map(i => i.id === id ? { ...i, status: 'APPROVED', approvedAt: Date.now() } : i))
    return id
  }, [])

  const resetInvites = useCallback(() => setInvites([]), [])

  return { invites, addInvite, approveInvite, resetInvites, setInvites }
}

export default { useInvites }
