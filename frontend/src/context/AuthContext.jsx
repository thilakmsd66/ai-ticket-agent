import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'

const BASE_URL = API_BASE_URL
const TOKEN_KEY = 'ai-ticket-auth-token'
const USER_KEY = 'ai-ticket-auth-user'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null }
  })
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  const saveAuth = (tokenVal, userVal) => {
    localStorage.setItem(TOKEN_KEY, tokenVal)
    localStorage.setItem(USER_KEY, JSON.stringify(userVal))
    setToken(tokenVal)
    setCurrentUser(userVal)
  }

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setCurrentUser(null)
  }, [])

  // Validate token on mount — if server says token is bad, log out
  useEffect(() => {
    if (!token) return
    fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) logout()
      })
      .catch(() => {
        // Backend unreachable — keep local state, don't force logout
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (email, password) => {
    setAuthLoading(true)
    setAuthError('')
    try {
      const resp = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.detail || 'Login failed')
      saveAuth(data.access_token, data.user)
      return true
    } catch (err) {
      setAuthError(err.message)
      return false
    } finally {
      setAuthLoading(false)
    }
  }

  const register = async (email, password, fullName, role) => {
    setAuthLoading(true)
    setAuthError('')
    try {
      const resp = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName, role }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.detail || 'Registration failed')
      return { success: true }
    } catch (err) {
      setAuthError(err.message)
      return { success: false }
    } finally {
      setAuthLoading(false)
    }
  }

  const forgotPassword = async (email) => {
    setAuthLoading(true)
    setAuthError('')
    try {
      const resp = await fetch(`${BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.detail || 'Request failed')
      return { success: true, message: data.detail }
    } catch (err) {
      setAuthError(err.message)
      return { success: false }
    } finally {
      setAuthLoading(false)
    }
  }

  const resetPassword = async (resetToken, newPassword) => {
    setAuthLoading(true)
    setAuthError('')
    try {
      const resp = await fetch(`${BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, new_password: newPassword }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.detail || 'Reset failed')
      return { success: true }
    } catch (err) {
      setAuthError(err.message)
      return { success: false }
    } finally {
      setAuthLoading(false)
    }
  }

  const submitFeedbackApi = async (ticketNumber, rating, comment) => {
    if (!token) return { success: false, detail: 'Not authenticated' }
    try {
      const resp = await fetch(`${BASE_URL}/tickets/${encodeURIComponent(ticketNumber)}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating, comment: comment || null }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.detail || 'Failed to submit feedback')
      return { success: true }
    } catch (err) {
      return { success: false, detail: err.message }
    }
  }

  return (
    <AuthContext.Provider value={{
      currentUser,
      token,
      authLoading,
      authError,
      setAuthError,
      login,
      register,
      logout,
      forgotPassword,
      resetPassword,
      submitFeedbackApi,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
