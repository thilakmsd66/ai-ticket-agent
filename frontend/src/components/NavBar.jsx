import React, { useEffect, useRef } from 'react'

const BASE_NAV_ITEMS = [
  { key: 'tickets', label: 'AI Companion', icon: 'smart_toy' },
  { key: 'ticketHistory', label: 'Ticket History', icon: 'history' },
  { key: 'dashboard', label: 'Analytical Dashboard', icon: 'dashboard' },
  { key: 'guide', label: 'User Guide', icon: 'menu_book' },
]

const ADMIN_NAV_ITEMS = [
  ...BASE_NAV_ITEMS,
  { key: 'feedbacks', label: 'Feedback Inbox', icon: 'rate_review' },
]

export default function NavBar({
  activePage,
  onNavigate,
  pendingClarificationCount,
  notificationOpen,
  toggleNotifications,
  closeNotifications,
  notificationTips,
  brandIconSrc,
  iconTheme,
  onIconThemeChange,
  currentUser,
  onLogout,
}) {
  const navItems = currentUser?.role === 'admin' ? ADMIN_NAV_ITEMS : BASE_NAV_ITEMS
  const iconThemeLabels = {
    classic: 'Classic',
    neon: 'Neon',
    minimal: 'Minimal',
  }

  const panelRef = useRef(null)
  const buttonRef = useRef(null)

  useEffect(() => {
    if (!notificationOpen) return

    function handleClickOutside(event) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        closeNotifications()
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        closeNotifications()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [notificationOpen, closeNotifications])

  return (
    <nav className="app-nav">
      <div className="nav-logo">
        <img src={brandIconSrc} alt="AI Ticket Agent" className="nav-logo-icon" />
        <span>AI Ticket Agent</span>
      </div>
      <div className="nav-actions">
        <span className="icon-theme-label" aria-live="polite">
          {iconThemeLabels[iconTheme] || 'Classic'}
        </span>

        <div className="icon-theme-picker" role="group" aria-label="AI Icon Theme">
          <button
            type="button"
            className={`icon-theme-button${iconTheme === 'classic' ? ' active' : ''}`}
            onClick={() => onIconThemeChange('classic')}
            title="Classic icon"
            aria-label="Switch to Classic icon"
          >
            <span className="material-symbols-outlined">token</span>
          </button>
          <button
            type="button"
            className={`icon-theme-button${iconTheme === 'neon' ? ' active' : ''}`}
            onClick={() => onIconThemeChange('neon')}
            title="Neon icon"
            aria-label="Switch to Neon icon"
          >
            <span className="material-symbols-outlined">auto_awesome</span>
          </button>
          <button
            type="button"
            className={`icon-theme-button${iconTheme === 'minimal' ? ' active' : ''}`}
            onClick={() => onIconThemeChange('minimal')}
            title="Minimal icon"
            aria-label="Switch to Minimal icon"
          >
            <span className="material-symbols-outlined">crop_square</span>
          </button>
        </div>

        <button
          type="button"
          className="notification-button"
          aria-label="Notifications"
          onClick={toggleNotifications}
          ref={buttonRef}
        >
          <span className="nav-icon material-symbols-outlined">notifications</span>
          <span className="notification-badge" />
        </button>
        {notificationOpen && (
          <div className="notification-panel" ref={panelRef}>
            <p className="notification-title">AI ticketing tips</p>
            <ul>
              {notificationTips.map((tip, index) => (
                <li key={index}>{tip}</li>
              ))}
            </ul>
          </div>
        )}

        {/* User chip + logout */}
        {currentUser && (
          <div className="nav-user-chip">
            <span className={`nav-user-role-dot ${currentUser.role === 'admin' ? 'admin' : 'user'}`} />
            <span className="nav-user-name">{currentUser.full_name.split(' ')[0]}</span>
            <span className={`nav-user-badge ${currentUser.role === 'admin' ? 'admin' : 'user'}`}>
              {currentUser.role === 'admin' ? 'Admin' : 'User'}
            </span>
            <button type="button" className="nav-logout-btn" onClick={onLogout} title="Sign out">
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        )}
      </div>
      <ul className="nav-list">
        {navItems.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              className={`nav-link nav-link-${item.key}${item.key === activePage ? ' active' : ''}`}
              onClick={() => onNavigate(item.key)}
            >
              <span className="nav-icon-wrap">
                <span className="nav-icon material-symbols-outlined">{item.icon}</span>
              </span>
              {item.label}
              {item.key === 'tickets' && pendingClarificationCount > 0 && (
                <span className="nav-pill">{pendingClarificationCount}</span>
              )}
              {item.key === 'feedbacks' && (
                <span className="nav-admin-pill">
                  <span className="material-symbols-outlined">admin_panel_settings</span>
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
