import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function AuthPage({ onAuthSuccess, defaultTab = 'login', resetToken = null }) {
  const [tab, setTab] = useState(resetToken ? 'reset' : defaultTab)
  const { login, register, forgotPassword, resetPassword, authLoading, authError, setAuthError } = useAuth()

  // Login
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')
  const [regRole, setRegRole] = useState('business_user')
  const [regSuccess, setRegSuccess] = useState(false)

  // Forgot password
  const [fpEmail, setFpEmail] = useState('')
  const [fpSent, setFpSent] = useState(false)

  // Reset password
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [resetDone, setResetDone] = useState(false)

  const switchTab = (t) => { setTab(t); setAuthError('') }

  const handleLogin = async (e) => {
    e.preventDefault()
    const ok = await login(loginEmail, loginPassword)
    if (ok) onAuthSuccess()
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    if (regPassword !== regConfirm) { setAuthError('Passwords do not match'); return }
    if (regPassword.length < 8) { setAuthError('Password must be at least 8 characters'); return }
    const result = await register(regEmail, regPassword, regName, regRole)
    if (result.success) setRegSuccess(true)
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    const result = await forgotPassword(fpEmail)
    if (result.success) setFpSent(true)
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmNewPassword) { setAuthError('Passwords do not match'); return }
    const result = await resetPassword(resetToken, newPassword)
    if (result.success) setResetDone(true)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-brand-icon-wrap">
            <span className="material-symbols-outlined">smart_toy</span>
          </span>
          <div>
            <span className="auth-brand-title">IntelliTriage</span>
            <span className="auth-brand-sub">Intelligent Support Platform</span>
          </div>
        </div>

        {tab !== 'forgot' && tab !== 'reset' && (
          <div className="auth-tabs">
            <button className={tab === 'login' ? 'auth-tab active' : 'auth-tab'} onClick={() => switchTab('login')}>
              <span className="material-symbols-outlined">login</span>
              Sign In
            </button>
            <button className={tab === 'register' ? 'auth-tab active' : 'auth-tab'} onClick={() => switchTab('register')}>
              <span className="material-symbols-outlined">person_add</span>
              Create Account
            </button>
          </div>
        )}

        {authError && (
          <div className="auth-error">
            <span className="material-symbols-outlined">error</span>
            {authError}
          </div>
        )}

        {/* ── Sign In ── */}
        {tab === 'login' && (
          <form className="auth-form" onSubmit={handleLogin}>
            <label className="auth-field">
              <span className="auth-field-label">
                <span className="material-symbols-outlined">mail</span> Email
              </span>
              <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                placeholder="your@email.com" required autoComplete="email" />
            </label>
            <label className="auth-field">
              <span className="auth-field-label">
                <span className="material-symbols-outlined">lock</span> Password
              </span>
              <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                placeholder="••••••••" required autoComplete="current-password" />
            </label>
            <button type="submit" className="auth-submit" disabled={authLoading}>
              {authLoading
                ? <span className="material-symbols-outlined btn-spin">progress_activity</span>
                : <span className="material-symbols-outlined">login</span>}
              {authLoading ? 'Signing in…' : 'Sign In'}
            </button>
            <button type="button" className="auth-link-btn" onClick={() => switchTab('forgot')}>
              <span className="material-symbols-outlined">lock_reset</span>
              Forgot password?
            </button>
          </form>
        )}

        {/* ── Create Account ── */}
        {tab === 'register' && !regSuccess && (
          <form className="auth-form" onSubmit={handleRegister}>
            <label className="auth-field">
              <span className="auth-field-label">
                <span className="material-symbols-outlined">badge</span> Full Name
              </span>
              <input type="text" value={regName} onChange={e => setRegName(e.target.value)}
                placeholder="John Smith" required />
            </label>
            <label className="auth-field">
              <span className="auth-field-label">
                <span className="material-symbols-outlined">mail</span> Email
              </span>
              <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                placeholder="your@email.com" required autoComplete="email" />
            </label>
            <div className="auth-field">
              <span className="auth-field-label">
                <span className="material-symbols-outlined">manage_accounts</span> Account Type
              </span>
              <div className="auth-role-picker">
                <button type="button"
                  className={regRole === 'business_user' ? 'auth-role-btn active' : 'auth-role-btn'}
                  onClick={() => setRegRole('business_user')}>
                  <span className="material-symbols-outlined">person</span>
                  Business User
                  <span className="auth-role-desc">Submit & track tickets</span>
                </button>
                <button type="button"
                  className={regRole === 'admin' ? 'auth-role-btn active' : 'auth-role-btn'}
                  onClick={() => setRegRole('admin')}>
                  <span className="material-symbols-outlined">admin_panel_settings</span>
                  Admin
                  <span className="auth-role-desc">Manage & view feedbacks</span>
                </button>
              </div>
            </div>
            <label className="auth-field">
              <span className="auth-field-label">
                <span className="material-symbols-outlined">lock</span> Password
              </span>
              <input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)}
                placeholder="At least 8 characters" required minLength={8} autoComplete="new-password" />
            </label>
            <label className="auth-field">
              <span className="auth-field-label">
                <span className="material-symbols-outlined">lock_reset</span> Confirm Password
              </span>
              <input type="password" value={regConfirm} onChange={e => setRegConfirm(e.target.value)}
                placeholder="••••••••" required autoComplete="new-password" />
            </label>
            <button type="submit" className="auth-submit" disabled={authLoading}>
              {authLoading
                ? <span className="material-symbols-outlined btn-spin">progress_activity</span>
                : <span className="material-symbols-outlined">person_add</span>}
              {authLoading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        )}

        {tab === 'register' && regSuccess && (
          <div className="auth-success">
            <span className="material-symbols-outlined auth-success-icon">mark_email_read</span>
            <h3>Account created!</h3>
            <p>Check your email for a verification link. Once verified, you can sign in.</p>
            <button type="button" className="auth-submit" onClick={() => { switchTab('login'); setRegSuccess(false) }}>
              <span className="material-symbols-outlined">login</span>
              Go to Sign In
            </button>
          </div>
        )}

        {/* ── Forgot Password ── */}
        {tab === 'forgot' && !fpSent && (
          <form className="auth-form" onSubmit={handleForgotPassword}>
            <div className="auth-section-header">
              <span className="material-symbols-outlined">lock_reset</span>
              <div>
                <h3>Forgot your password?</h3>
                <p>Enter your email and we'll send a reset link.</p>
              </div>
            </div>
            <label className="auth-field">
              <span className="auth-field-label">
                <span className="material-symbols-outlined">mail</span> Email
              </span>
              <input type="email" value={fpEmail} onChange={e => setFpEmail(e.target.value)}
                placeholder="your@email.com" required autoComplete="email" />
            </label>
            <button type="submit" className="auth-submit" disabled={authLoading}>
              {authLoading
                ? <span className="material-symbols-outlined btn-spin">progress_activity</span>
                : <span className="material-symbols-outlined">send</span>}
              {authLoading ? 'Sending…' : 'Send Reset Link'}
            </button>
            <button type="button" className="auth-link-btn" onClick={() => switchTab('login')}>
              <span className="material-symbols-outlined">arrow_back</span>
              Back to Sign In
            </button>
          </form>
        )}

        {tab === 'forgot' && fpSent && (
          <div className="auth-success">
            <span className="material-symbols-outlined auth-success-icon">mark_email_read</span>
            <h3>Check your inbox!</h3>
            <p>If an account exists with that email, you'll receive a reset link shortly.</p>
            <button type="button" className="auth-submit" onClick={() => switchTab('login')}>
              <span className="material-symbols-outlined">login</span>
              Back to Sign In
            </button>
          </div>
        )}

        {/* ── Reset Password (from email link) ── */}
        {tab === 'reset' && !resetDone && (
          <form className="auth-form" onSubmit={handleResetPassword}>
            <div className="auth-section-header">
              <span className="material-symbols-outlined">lock_open</span>
              <div>
                <h3>Set a new password</h3>
                <p>Choose a strong password for your account.</p>
              </div>
            </div>
            <label className="auth-field">
              <span className="auth-field-label">
                <span className="material-symbols-outlined">lock</span> New Password
              </span>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 8 characters" required minLength={8} autoComplete="new-password" />
            </label>
            <label className="auth-field">
              <span className="auth-field-label">
                <span className="material-symbols-outlined">lock_reset</span> Confirm Password
              </span>
              <input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)}
                placeholder="••••••••" required autoComplete="new-password" />
            </label>
            <button type="submit" className="auth-submit" disabled={authLoading}>
              {authLoading
                ? <span className="material-symbols-outlined btn-spin">progress_activity</span>
                : <span className="material-symbols-outlined">check_circle</span>}
              {authLoading ? 'Saving…' : 'Reset Password'}
            </button>
          </form>
        )}

        {tab === 'reset' && resetDone && (
          <div className="auth-success">
            <span className="material-symbols-outlined auth-success-icon">check_circle</span>
            <h3>Password updated!</h3>
            <p>Your password has been reset. You can now sign in with your new password.</p>
            <button type="button" className="auth-submit" onClick={() => switchTab('login')}>
              <span className="material-symbols-outlined">login</span>
              Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
