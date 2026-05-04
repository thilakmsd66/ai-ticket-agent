import React, { useEffect, useRef, useState } from 'react'
import './App.css'
import NavBar from './components/NavBar'
import TicketAgentPage from './components/TicketAgentPage'
import TicketHistoryPanel from './components/TicketHistoryPanel'
import AnalyticalDashboard from './components/AnalyticalDashboard'
import UserGuide from './components/UserGuide'
import ImageCarousel from './components/ImageCarousel'
import VoiceAssistantModal from './components/VoiceAssistantModal'
import SupportFooter from './components/SupportFooter'
import AuthPage from './components/AuthPage'
import AdminFeedbackPage from './components/AdminFeedbackPage'
import NeuralBackground from './components/NeuralBackground'
import { API_BASE_URL } from './config'
import { useAuth } from './context/AuthContext'

function App() {
  const { currentUser, logout, submitFeedbackApi } = useAuth()

  // Handle ?reset=TOKEN and ?verify=TOKEN in URL
  const urlParams = new URLSearchParams(window.location.search)
  const resetToken = urlParams.get('reset')
  const verifyToken = urlParams.get('verify')

  // Show auth page when not logged in, or when handling a password reset link
  if (!currentUser || resetToken) {
    return (
      <AuthPage
        resetToken={resetToken}
        onAuthSuccess={() => {
          // Clear URL params after auth
          window.history.replaceState({}, '', window.location.pathname)
        }}
      />
    )
  }

  return <AppShell currentUser={currentUser} onLogout={logout} submitFeedbackApi={submitFeedbackApi} />
}

function AppShell({ currentUser, onLogout, submitFeedbackApi }) {
  const iconOptions = {
    classic: { src: '/favicon.svg', label: 'Classic' },
    neon: { src: '/favicon-neon.svg', label: 'Neon' },
    minimal: { src: '/favicon-minimal.svg', label: 'Minimal' },
  }

  const normalizeServiceMessage = (err, fallbackMessage) => {
    const message = err instanceof Error ? err.message.toLowerCase() : ''

    if (message.includes('failed to fetch') || message.includes('networkerror')) {
      return 'AI service is unavailable right now. Please try again later.'
    }

    if (message.includes('server error: 5')) {
      return 'AI service is temporarily unavailable. Please try again shortly.'
    }

    if (message.includes('token limit') || message.includes('suspended') || message.includes('unreachable')) {
      return 'AI service is currently unreachable. Please try again later or contact support.'
    }

    if (message.includes('server error: 4')) {
      return 'Your request could not be completed by the AI service. Please review the details and try again.'
    }

    return fallbackMessage
  }

  const [activePage, setActivePage] = useState('tickets')
  const [iconTheme, setIconTheme] = useState(() => {
    const saved = window.localStorage.getItem('ai-ticket-icon-theme')
    return saved && iconOptions[saved] ? saved : 'classic'
  })
  const [message, setMessage] = useState('')
  const [tickets, setTickets] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingOriginalMessage, setPendingOriginalMessage] = useState('')
  const [clarificationQuestion, setClarificationQuestion] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [serviceMessage, setServiceMessage] = useState('')
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [profilePanelOpen, setProfilePanelOpen] = useState(false)
  const [voiceModalOpen, setVoiceModalOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackRating, setFeedbackRating] = useState(0)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [feedbackTicket, setFeedbackTicket] = useState('GENERAL')
  const [isBackendReachable, setIsBackendReachable] = useState(false)
  const profileButtonRef = useRef(null)
  const profilePanelRef = useRef(null)
  const spokenClarificationRef = useRef('')
  const activeIcon = iconOptions[iconTheme] || iconOptions.classic

  useEffect(() => {
    window.localStorage.setItem('ai-ticket-icon-theme', iconTheme)
    const favicon = document.querySelector('link[rel="icon"]')
    if (favicon) {
      favicon.setAttribute('href', activeIcon.src)
    }
  }, [iconTheme, activeIcon.src])

  const speakMessage = (text) => {
    if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1
    utterance.pitch = 1
    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => {
    let isMounted = true

    const checkBackendReachability = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health/aicafe`, { method: 'GET' })
        if (isMounted) {
          setIsBackendReachable(response.ok)
        }
      } catch {
        if (isMounted) {
          setIsBackendReachable(false)
        }
      }
    }

    checkBackendReachability()
    const interval = window.setInterval(checkBackendReachability, 20000)

    return () => {
      isMounted = false
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const loadTickets = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/tickets`)
        if (!response.ok) {
          throw new Error('Unable to load ticket history.')
        }
        const data = await response.json()
        setTickets(data)
      } catch (err) {
        console.error(err)
        setServiceMessage(
          normalizeServiceMessage(
            err,
            'Ticket history is unavailable right now. Please try again shortly.',
          ),
        )
      }
    }

    loadTickets()
  }, [])

  useEffect(() => {
    if (!toastMessage) {
      return
    }

    const timeout = window.setTimeout(() => {
      setToastMessage('')
    }, 4200)

    return () => window.clearTimeout(timeout)
  }, [toastMessage])

  useEffect(() => {
    if (!profilePanelOpen) {
      return
    }

    const handleScroll = () => setProfilePanelOpen(false)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [profilePanelOpen])

  useEffect(() => {
    if (!pendingOriginalMessage || !clarificationQuestion) {
      spokenClarificationRef.current = ''
      return
    }

    if (spokenClarificationRef.current === clarificationQuestion) {
      return
    }

    speakMessage(`Clarification question: ${clarificationQuestion}`)
    spokenClarificationRef.current = clarificationQuestion
  }, [pendingOriginalMessage, clarificationQuestion])

  useEffect(() => {
    if (!profilePanelOpen) {
      return
    }

    const handlePointerDown = (event) => {
      const target = event.target
      if (
        profilePanelRef.current &&
        !profilePanelRef.current.contains(target) &&
        profileButtonRef.current &&
        !profileButtonRef.current.contains(target)
      ) {
        setProfilePanelOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setProfilePanelOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [profilePanelOpen])

  const notificationTips = [
    'Include the affected application, urgency, and any error messages.',
    'Describe the exact steps that reproduce the issue.',
    'Mention whether it is a new bug or a repeat problem.',
    'Add any relevant request IDs, user roles, or timestamps.',
    'Tell the AI your expected outcome or SLA need.',
  ]

  const goToTicketAgent = () => {
    setActivePage('tickets')
    setNotificationOpen(false)
    setProfilePanelOpen(false)
    setVoiceModalOpen(false)

    window.setTimeout(() => {
      const ticketSection = document.querySelector('.ticket-page')
      if (ticketSection) {
        ticketSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }

      const ticketInput = document.getElementById('ticket-input')
      if (ticketInput) {
        ticketInput.focus()
      }
    }, 60)
  }

  const submitFeedback = async () => {
    if (!feedbackRating) {
      setToastMessage('Please select a rating before submitting feedback.')
      return
    }

    const result = await submitFeedbackApi(feedbackTicket, feedbackRating, feedbackComment)
    setFeedbackOpen(false)
    setFeedbackComment('')
    setFeedbackRating(0)
    setFeedbackTicket('GENERAL')
    if (result.success) {
      setToastMessage('Thanks for your feedback! It helps us improve the AI assistant.')
    } else {
      setToastMessage('Feedback noted. (Could not save to server: ' + result.detail + ')')
    }
  }

  const history = tickets.map((ticket) => ticket.original_message)

  const submitTicketWithInput = async (inputMessage) => {
    const trimmedMessage = inputMessage.trim()

    if (!trimmedMessage) {
      setError(
        pendingOriginalMessage
          ? 'Enter a response to the clarification question.'
          : 'Enter a ticket description to continue.',
      )
      return false
    }

    setError('')
    setIsLoading(true)

    const payload = {
      message: pendingOriginalMessage || trimmedMessage,
      history,
    }

    if (pendingOriginalMessage) {
      // Use the just-provided input as the clarification answer (works for
      // both typed and voice input — avoids stale `message` state).
      payload.clarification_answer = trimmedMessage
      payload.clarification_question = clarificationQuestion
    }

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }

      const data = await response.json()

        if (data.clarification_needed) {
        setPendingOriginalMessage(payload.message)
        setClarificationQuestion(
          data.clarification_question ||
            'Can you provide more detail so we can route this request correctly?',
        )
        setMessage('')
        setToastMessage('Your ticket is pending clarification. Answer the AI question to continue.')
        return true
      }

      setTickets([
        {
          ticket_number: data.ticket_number,
          original_message: payload.message,
          clarified_message: data.clarified_message,
          assigned_team: data.assigned_team,
          priority: data.priority,
          created_at: data.created_at,
          response_time_ms: data.response_time_ms,
          clarification_needed: data.clarification_needed,
          clarification_question: data.clarification_question,
          response_source: data.response_source || 'ai',
        },
        ...tickets,
      ])
      setMessage('')
      setPendingOriginalMessage('')
      setClarificationQuestion('')
      const createdAt = data.created_at
        ? new Date(data.created_at).toLocaleString()
        : new Date().toLocaleString()
      const successMessage =
        `Ticket ${data.ticket_number} created at ${createdAt} and assigned to ${data.assigned_team}.`
      setToastMessage(successMessage)
      speakMessage(`AI update. ${successMessage}`)
      return true
    } catch (err) {
      setError('')
      setServiceMessage(
        normalizeServiceMessage(
          err,
          'AI service is unavailable right now. Please try again later.',
        ),
      )
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const submitTicket = async () => submitTicketWithInput(message)

  const updateTicket = async (ticketNumber, updates) => {
    try {
      const response = await fetch(`${API_BASE_URL}/tickets/${encodeURIComponent(ticketNumber)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }

      const updatedTicket = await response.json()
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.ticket_number === ticketNumber ? { ...ticket, ...updatedTicket } : ticket,
        ),
      )
      setToastMessage(`Ticket ${ticketNumber} updated.`)
      return true
    } catch (err) {
      setServiceMessage(
        normalizeServiceMessage(
          err,
          'Unable to update the ticket right now. Please try again.',
        ),
      )
      return false
    }
  }

  const cancelTicket = async (ticketNumber) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/tickets/${encodeURIComponent(ticketNumber)}/cancel`,
        {
          method: 'POST',
        },
      )

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }

      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.ticket_number === ticketNumber
            ? {
                ...ticket,
                assigned_team: 'Cancelled',
                priority: 'P4',
                clarification_needed: false,
                clarification_question: 'Cancelled by user',
              }
            : ticket,
        ),
      )
      setToastMessage(`Ticket ${ticketNumber} cancelled.`)
      return true
    } catch (err) {
      setServiceMessage(
        normalizeServiceMessage(
          err,
          'Unable to cancel the ticket right now. Please try again.',
        ),
      )
      return false
    }
  }

  const pendingClarificationCount = pendingOriginalMessage ? 1 : 0
  const routedCount = tickets.filter((ticket) => !ticket.clarification_needed).length
  const highPriorityCount = tickets.filter((ticket) => ticket.priority === 'P1').length
  const measuredResponseTimes = tickets
    .map((ticket) => Number(ticket.response_time_ms))
    .filter((value) => Number.isFinite(value) && value > 0)
  const avgResponseMs = measuredResponseTimes.length
    ? Math.round(measuredResponseTimes.reduce((sum, value) => sum + value, 0) / measuredResponseTimes.length)
    : null
  const latestTicketNumber = tickets[0]?.ticket_number || 'No tickets yet'

  const heroMetrics = [
    {
      label: 'Tickets Processed',
      value: tickets.length,
      icon: 'confirmation_number',
    },
    {
      label: 'Auto Routed',
      value: routedCount,
      icon: 'route',
    },
    {
      label: 'Pending Clarification',
      value: pendingClarificationCount,
      icon: 'help_outline',
    },
  ]

  const heroSignals = [
    {
      icon: 'bolt',
      label: 'Avg AI Response',
      value: avgResponseMs ? `${avgResponseMs} ms` : 'Pending samples',
      tone: 'speed',
    },
    {
      icon: 'warning',
      label: 'Critical Queue',
      value: `${highPriorityCount} P1 ticket(s)`,
      tone: 'critical',
    },
    {
      icon: 'confirmation_number',
      label: 'Latest Ticket',
      value: latestTicketNumber,
      tone: 'ticket',
    },
  ]

  const pages = {
    tickets: (
      <TicketAgentPage
        message={message}
        setMessage={setMessage}
        isLoading={isLoading}
        error={error}
        submitTicket={submitTicket}
        submitVoiceMessage={submitTicketWithInput}
        pendingOriginalMessage={pendingOriginalMessage}
        clarificationQuestion={clarificationQuestion}
        lastResponseSource={tickets.length > 0 ? tickets[0].response_source : null}
        onOpenVoiceModal={() => setVoiceModalOpen(true)}
        onSpeakClarification={() =>
          speakMessage(
            clarificationQuestion
              ? `Clarification question: ${clarificationQuestion}`
              : 'No clarification question is currently available.',
          )
        }
      />
    ),
    ticketHistory: (
      <TicketHistoryPanel
        tickets={tickets}
        onUpdateTicket={updateTicket}
        onCancelTicket={cancelTicket}
      />
    ),
    dashboard: (
      <AnalyticalDashboard
        tickets={tickets}
        pendingClarificationCount={pendingClarificationCount}
      />
    ),
    guide: <UserGuide />,
    ...(currentUser.role === 'admin' ? { feedbacks: <AdminFeedbackPage isActive={activePage === 'feedbacks'} /> } : {}),
  }

  return (
    <div className="app-shell">
      <NeuralBackground />
      {/* AI ambient overlays */}
      <div className="ai-scan-line" aria-hidden="true" />
      <div className="ai-pulse-ring" aria-hidden="true" />
      <div className="ai-pulse-ring" aria-hidden="true" />
      <div className="ai-pulse-ring" aria-hidden="true" />
      <div className="ai-pulse-ring" aria-hidden="true" />
      <div className="ai-pulse-ring" aria-hidden="true" />
      <div className="ai-data-label" aria-hidden="true">MODEL: GPT-4.1</div>
      <div className="ai-data-label" aria-hidden="true">ROUTING: ACTIVE</div>
      <div className="ai-data-label" aria-hidden="true">PRIORITY: P1–P4</div>
      <div className="ai-data-label" aria-hidden="true">LATENCY: 142ms</div>
      <div className="ai-data-label" aria-hidden="true">QUEUE: 0 PENDING</div>
      {toastMessage && <div className="toast">{toastMessage}</div>}
      {serviceMessage && (
        <div className="message-panel-backdrop" role="presentation">
          <div className="message-panel" role="alertdialog" aria-labelledby="service-panel-title">
            <div className="message-panel-icon">
              <span className="material-symbols-outlined">error</span>
            </div>
            <div className="message-panel-copy">
              <p id="service-panel-title">Service Notice</p>
              <span>{serviceMessage}</span>
            </div>
            <button
              type="button"
              className="message-panel-close"
              onClick={() => setServiceMessage('')}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <header className="app-header">
        <div className="brand-group">
          <div className="brand-mark">
            <img src={activeIcon.src} alt="AI Ticket Agent" className="brand-mark-icon" />
          </div>
          <div className="brand-copy">
            <p className="eyebrow">
              <span
                className={isBackendReachable ? 'ai-heartbeat-dot online' : 'ai-heartbeat-dot offline'}
                aria-hidden="true"
              />
              AI Ticket Agent
            </p>
            <h1>Fast, intelligent ticket routing with real-time AI insights</h1>
          </div>
        </div>
        <p>
          Quickly submit requests, resolve follow-up clarifications, and review
          AI-driven assignments from one clean dashboard.
        </p>

        <div className="hero-signal-row" aria-label="AI live signals">
          {heroSignals.map((signal) => (
            <article key={signal.label} className={`hero-signal-card hero-signal-${signal.tone}`}>
              <span className="material-symbols-outlined">{signal.icon}</span>
              <div>
                <p className="hero-signal-label">{signal.label}</p>
                <strong className="hero-signal-value">{signal.value}</strong>
              </div>
            </article>
          ))}
        </div>

        <div className="hero-metrics" aria-label="Ticketing highlights">
          {heroMetrics.map((metric) => (
            <article key={metric.label} className="hero-metric-card">
              <span className="material-symbols-outlined">{metric.icon}</span>
              <div>
                <p className="hero-metric-value">{metric.value}</p>
                <p className="hero-metric-label">{metric.label}</p>
              </div>
            </article>
          ))}
        </div>
      </header>

      <ImageCarousel />

      <NavBar
        activePage={activePage}
        onNavigate={setActivePage}
        pendingClarificationCount={pendingClarificationCount}
        notificationOpen={notificationOpen}
        toggleNotifications={() => setNotificationOpen((open) => !open)}
        closeNotifications={() => setNotificationOpen(false)}
        notificationTips={notificationTips}
        brandIconSrc={activeIcon.src}
        iconTheme={iconTheme}
        onIconThemeChange={setIconTheme}
        currentUser={currentUser}
        onLogout={onLogout}
      />

      <button
        type="button"
        className={activePage === 'tickets' ? 'route-ticket-button active' : 'route-ticket-button'}
        aria-label="Wanna submit a ticket?"
        title="Wanna submit a ticket?"
        onClick={goToTicketAgent}
      >
        <span className="material-symbols-outlined">add_task</span>
        Wanna submit a ticket?
      </button>

      <button
        type="button"
        className={profilePanelOpen ? 'top-profile-button active' : 'top-profile-button'}
        aria-label="Open profile"
        title="User Profile"
        onClick={() => setProfilePanelOpen((open) => !open)}
        ref={profileButtonRef}
      >
        <span className="profile-avatar" aria-hidden="true">
          <span className="profile-avatar-halo" />
          <span className="profile-avatar-hair" />
          <span className="profile-avatar-head" />
          <span className="profile-avatar-eye profile-avatar-eye-left" />
          <span className="profile-avatar-eye profile-avatar-eye-right" />
          <span className="profile-avatar-smile" />
          <span className="profile-avatar-body" />
        </span>
      </button>

      <button
        type="button"
        className="ai-feedback-button"
        aria-label="Give feedback for AI assistant"
        title="Give AI Feedback"
        onClick={() => setFeedbackOpen(true)}
      >
        <span className="material-symbols-outlined">rate_review</span>
        AI Feedback
      </button>

      {profilePanelOpen && (
        <aside className="profile-flyout" aria-label="User Profile Panel" ref={profilePanelRef}>
          <div className="profile-flyout-header">
            <p>{currentUser.full_name}</p>
            <span className={`profile-role-chip ${currentUser.role === 'admin' ? 'admin' : 'user'}`}>
              <span className="material-symbols-outlined">
                {currentUser.role === 'admin' ? 'admin_panel_settings' : 'person'}
              </span>
              {currentUser.role === 'admin' ? 'Admin' : 'Business User'}
            </span>
          </div>
          <div className="profile-flyout-body">
            <div>
              <span className="material-symbols-outlined">mail</span>
              <p>{currentUser.email}</p>
            </div>
            <div>
              <span className="material-symbols-outlined">verified</span>
              <p>{currentUser.is_verified ? 'Email verified' : 'Email not verified'}</p>
            </div>
            <div>
              <span className="material-symbols-outlined">notifications</span>
              <p>Notifications enabled</p>
            </div>
          </div>
          <button type="button" className="profile-logout-btn" onClick={onLogout}>
            <span className="material-symbols-outlined">logout</span>
            Sign Out
          </button>
        </aside>
      )}

      {feedbackOpen && (
        <div
          className="feedback-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setFeedbackOpen(false)
            }
          }}
        >
          <div className="feedback-modal" role="dialog" aria-labelledby="feedback-title" aria-modal="true">
            <h3 id="feedback-title">How was the AI assistant?</h3>
            <p>Rate your experience and share feedback to improve AI responses.</p>

            <div className="feedback-ticket-select-wrap">
              <label className="feedback-field-label">
                <span className="material-symbols-outlined">confirmation_number</span>
                Feedback for
              </label>
              <div className="feedback-ticket-list">
                {[
                  { value: 'GENERAL', label: 'General', sub: 'Overall tool experience', icon: 'thumb_up' },
                  ...tickets
                    .filter(t => !t.clarification_needed && t.ticket_number)
                    .map(t => ({
                      value: t.ticket_number,
                      label: t.ticket_number,
                      sub: t.original_message.length > 60 ? t.original_message.slice(0, 60) + '…' : t.original_message,
                      icon: 'confirmation_number',
                      team: t.assigned_team,
                      priority: t.priority,
                    }))
                ].map(item => (
                  <button
                    key={item.value}
                    type="button"
                    className={`feedback-ticket-pill${feedbackTicket === item.value ? ' selected' : ''}`}
                    onClick={() => setFeedbackTicket(item.value)}
                  >
                    <span className="feedback-ticket-pill-icon material-symbols-outlined">{item.icon}</span>
                    <span className="feedback-ticket-pill-body">
                      <span className="feedback-ticket-pill-label">{item.label}</span>
                      <span className="feedback-ticket-pill-sub">{item.sub}</span>
                    </span>
                    {item.team && (
                      <span className="feedback-ticket-pill-meta">
                        <span className={`feedback-ticket-pill-priority p-${item.priority}`}>{item.priority}</span>
                        <span className="feedback-ticket-pill-team">{item.team}</span>
                      </span>
                    )}
                    {feedbackTicket === item.value && (
                      <span className="feedback-ticket-pill-check material-symbols-outlined">check_circle</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="feedback-rating-row" aria-label="Select rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={feedbackRating >= star ? 'feedback-star active' : 'feedback-star'}
                  onClick={() => setFeedbackRating(star)}
                  aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                >
                  <span className="material-symbols-outlined">star</span>
                </button>
              ))}
            </div>

            <textarea
              className="feedback-comment"
              rows={4}
              value={feedbackComment}
              onChange={(event) => setFeedbackComment(event.target.value)}
              placeholder="Optional: Tell us what worked well or what should improve."
            />

            <div className="feedback-actions">
              <button type="button" className="feedback-cancel" onClick={() => setFeedbackOpen(false)}>
                Cancel
              </button>
              <button type="button" className="feedback-submit" onClick={submitFeedback}>
                Submit Feedback
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="main-content">
        {Object.entries(pages).map(([key, component]) => (
          <section
            key={key}
            className={
              key === activePage
                ? `page-panel active page-panel-${key}`
                : 'page-panel hidden'
            }
          >
            {component}
          </section>
        ))}
      </main>

      <SupportFooter />

      <VoiceAssistantModal
        isOpen={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
        normalizeServiceMessage={normalizeServiceMessage}
        onTicketCreated={(ticket) => {
          setTickets((prev) => [ticket, ...prev])
        }}
      />
    </div>
  )
}

export default App
