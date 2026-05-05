import { useEffect, useRef, useState } from 'react'

export default function TicketAgentPage({
  message,
  setMessage,
  isLoading,
  error,
  submitTicket,
  submitVoiceMessage,
  pendingOriginalMessage,
  clarificationQuestion,
  lastResponseSource,
  onSpeakClarification,
  onOpenVoiceModal,
}) {
  const isClarifying = Boolean(pendingOriginalMessage)
  const [isVoiceSupported, setIsVoiceSupported] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('')
  const recognitionRef = useRef(null)
  // Stable refs so the recognition effect doesn't tear down each render.
  const setMessageRef = useRef(setMessage)
  const submitVoiceMessageRef = useRef(submitVoiceMessage)
  const isClarifyingRef = useRef(isClarifying)

  useEffect(() => { setMessageRef.current = setMessage }, [setMessage])
  useEffect(() => { submitVoiceMessageRef.current = submitVoiceMessage }, [submitVoiceMessage])
  useEffect(() => { isClarifyingRef.current = isClarifying }, [isClarifying])

  const submitLabel = isLoading
    ? 'Processing...'
    : isClarifying
    ? 'Submit Clarification'
    : 'Submit Ticket'

  const resolvedVoiceStatus = isVoiceSupported
    ? voiceStatus || 'Use "Talk to AI Assistant" for a full conversation or "Quick mic" for a one-shot input.'
    : 'Voice input is not supported in this browser.'

  const voiceStatusTone = !isVoiceSupported
    ? 'error'
    : /successfully/i.test(resolvedVoiceStatus)
    ? 'success'
    : /(could not|not supported|try again|error)/i.test(resolvedVoiceStatus)
    ? 'error'
    : /(listening|sending|processing)/i.test(resolvedVoiceStatus)
    ? 'live'
    : 'neutral'

  const voiceStatusIcon = voiceStatusTone === 'success'
    ? 'check_circle'
    : voiceStatusTone === 'error'
    ? 'error'
    : voiceStatusTone === 'live'
    ? 'graphic_eq'
    : 'tips_and_updates'

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setIsVoiceSupported(false)
      return
    }

    setIsVoiceSupported(true)
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = false
    recognition.maxAlternatives = 1

    let finalTranscript = ''

    recognition.onstart = () => {
      finalTranscript = ''
      setIsListening(true)
      setVoiceStatus(
        isClarifyingRef.current
          ? 'Listening... speak your clarification answer now.'
          : 'Listening... speak your issue now.',
      )
    }

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0]?.transcript || ''
        if (result.isFinal) {
          finalTranscript += text
        } else {
          interim += text
        }
      }

      // Live preview into the textarea so the user sees their words.
      const liveText = (finalTranscript + interim).trim()
      if (liveText) {
        setMessageRef.current(liveText)
        if (interim) {
          setVoiceStatus(`Hearing: "${interim.trim().slice(0, 80)}"`)
        }
      }
    }

    recognition.onerror = (event) => {
      const code = event?.error || 'unknown'
      const messages = {
        'no-speech': 'No speech detected. Please tap the mic and try again.',
        'audio-capture': 'No microphone detected. Check your input device.',
        'not-allowed': 'Microphone access blocked. Allow mic permission in your browser.',
        'service-not-allowed': 'Speech service blocked by the browser.',
        'aborted': 'Voice input was cancelled.',
        'network': 'Network error during voice recognition. Please retry.',
      }
      setVoiceStatus(messages[code] || `Could not capture voice input (${code}). Please try again.`)
    }

    recognition.onend = () => {
      setIsListening(false)
      const finalText = finalTranscript.trim()
      if (!finalText) {
        // onerror or empty — nothing to submit.
        return
      }

      setMessageRef.current(finalText)
      setVoiceStatus(
        isClarifyingRef.current
          ? 'Voice captured. Sending clarification answer to AI...'
          : 'Voice captured. Sending to AI assistant...',
      )

      Promise.resolve(submitVoiceMessageRef.current(finalText)).then((ok) => {
        if (ok) {
          setVoiceStatus(
            isClarifyingRef.current
              ? 'Clarification submitted. Awaiting AI response...'
              : 'AI processed your voice input successfully.',
          )
        } else {
          setVoiceStatus('AI could not process the voice input. Please try again.')
        }
      })
    }

    recognitionRef.current = recognition

    return () => {
      try {
        recognition.abort()
      } catch {
        // no-op: browser may throw if recognition is already stopped
      }
      recognitionRef.current = null
    }
  }, [])

  const toggleVoiceInput = async () => {
    if (!recognitionRef.current) {
      setVoiceStatus('Voice input is not supported in this browser.')
      return
    }

    if (isListening) {
      try {
        recognitionRef.current.stop()
      } catch {
        // no-op
      }
      return
    }

    // Proactively request mic permission so the user gets a clear prompt
    // instead of a silent "no-speech" later.
    if (navigator?.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        // Release the stream immediately — Web Speech API opens its own.
        stream.getTracks().forEach((track) => track.stop())
      } catch {
        setVoiceStatus('Microphone access blocked. Allow mic permission in your browser.')
        return
      }
    }

    // Clear textarea so live preview starts fresh (especially for clarification).
    setMessage('')
    setVoiceStatus(
      isClarifying
        ? 'Preparing mic for clarification answer...'
        : 'Preparing mic...',
    )
    try {
      recognitionRef.current.start()
    } catch (err) {
      // start() throws if already started — recover gracefully.
      setVoiceStatus('Voice input is busy. Please wait a moment and try again.')
    }
  }

  const QUICK_TAGS = [
    { label: 'Bug Report',    icon: 'bug_report',       template: 'Bug: [App name] is not working as expected. Steps to reproduce: 1. ' },
    { label: 'Access Issue',  icon: 'lock_person',      template: 'Access issue: I cannot access [system/resource]. My role is [role]. ' },
    { label: 'Performance',   icon: 'speed',            template: 'Performance issue: [App name] is running slowly / timing out. Affected users: ' },
    { label: 'Data Issue',    icon: 'database',         template: 'Data issue: Incorrect or missing data in [system]. Expected vs actual: ' },
    { label: 'Incident',      icon: 'warning',          template: 'Incident: Service [name] is down / severely degraded. Business impact: ' },
    { label: 'Change Request',icon: 'edit_note',        template: 'Change request: Please update [setting/config/access] for [user/system]. Reason: ' },
  ]

  return (
    <div className="ticket-form">
      <div className="ticket-form-header">
        <div className="ticket-form-title-row">
          <span className="ticket-form-icon-wrap">
            <span className="material-symbols-outlined">confirmation_number</span>
          </span>
          <div>
            <label htmlFor="ticket-input" className="field-label">
              {isClarifying ? 'Answer the clarification question' : 'Describe your ticket request'}
            </label>
            <p className="form-hint">
              {isClarifying
                ? 'The AI needs one more detail before finalizing your ticket.'
                : 'The assistant will clarify your request and route it to the right team.'}
            </p>
          </div>
          {!isClarifying && (
            <div className="ticket-ai-badge">
              <span className="material-symbols-outlined">auto_awesome</span>
              AI-Powered
            </div>
          )}
          {!isClarifying && lastResponseSource === 'fallback' && (
            <div className="ticket-fallback-badge" title="AI service is offline. Using rule-based routing.">
              <span className="material-symbols-outlined">offline_bolt</span>
              Fallback Mode
            </div>
          )}
        </div>
      </div>

      {!isClarifying && (
        <div className="ticket-quick-tags">
          <p className="ticket-quick-tags-label">
            <span className="material-symbols-outlined">bolt</span>
            Quick templates
          </p>
          <div className="ticket-quick-tags-list">
            {QUICK_TAGS.map(tag => (
              <button
                key={tag.label}
                type="button"
                className="ticket-quick-tag"
                onClick={() => setMessage(tag.template)}
                title={`Start with ${tag.label} template`}
              >
                <span className="material-symbols-outlined">{tag.icon}</span>
                {tag.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {isClarifying && (
        <div className="clarification-banner clarification-active">
          <div className="clarification-header">
            <div className="clarification-pill">
              <span className="material-symbols-outlined icon-blink">
                chat_bubble
              </span>
              Clarification Needed
            </div>
            <span className="material-symbols-outlined clarification-indicator">
              help
            </span>
          </div>
          <div className="clarification-content">
            <div className="clarification-question-box">
              <span className="material-symbols-outlined question-icon">
                help_outline
              </span>
              <div>
                <p className="clarification-label">AI Question:</p>
                <p className="clarification-text">
                  {clarificationQuestion}
                </p>
              </div>
            </div>
            <button type="button" className="clarification-voice-button" onClick={onSpeakClarification}>
              <span className="material-symbols-outlined audio-wave">volume_up</span>
              <span>Listen to question</span>
            </button>
          </div>
          <div className="clarification-original">
            <span className="material-symbols-outlined original-icon">
              message
            </span>
            <div>
              <p className="original-label">Your original request:</p>
              <p className="original-text">{pendingOriginalMessage}</p>
            </div>
          </div>
        </div>
      )}

      <div className="voice-assistant-row">
        <div className="voice-row-buttons">
          <button
            type="button"
            className="open-voice-modal-btn whisper-cta"
            onClick={onOpenVoiceModal}
          >
            <span className="voice-modal-btn-orb">
              <span /><span /><span />
            </span>
            <span className="material-symbols-outlined">record_voice_over</span>
            Talk to AI Assistant
          </button>
          <button
            type="button"
            className={isListening ? 'voice-button listening' : 'voice-button'}
            onClick={toggleVoiceInput}
            disabled={!isVoiceSupported || isLoading}
            title="Quick one-shot voice input"
          >
            <span className="material-symbols-outlined">{isListening ? 'mic_off' : 'mic'}</span>
            {isListening ? 'Stop' : 'Quick mic'}
          </button>
        </div>
        <p className={`voice-status ${voiceStatusTone}`}>
          <span className="material-symbols-outlined">{voiceStatusIcon}</span>
          <span>{resolvedVoiceStatus}</span>
        </p>
      </div>

      <div className="ticket-input-shell">
        <textarea
          id="ticket-input"
          value={message}
          rows={4}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              if (!isLoading && message.trim()) {
                submitTicket()
              }
            }
          }}
          placeholder={
            isClarifying
              ? 'Type your answer to the clarification question here. (Ctrl+Enter to submit)'
              : 'E.g. Users cannot upload invoices, and we need this fixed before EOD. (Ctrl+Enter to submit)'
          }
        />

        <div className="ticket-char-bar-wrap">
          <div
            className="ticket-char-bar"
            style={{ width: `${Math.min((message.trim().length / 500) * 100, 100)}%` }}
            data-warn={message.trim().length > 400}
          />
        </div>

        <div className="ticket-input-meta">
          <p className="ticket-char-count">
            <span className="material-symbols-outlined">counter_1</span>
            {message.trim().length} / 500
          </p>
          <p className="ticket-input-tip">
            <span className="material-symbols-outlined">lightbulb</span>
            Tip: Include affected app, impact, and urgency for faster routing.
          </p>
        </div>
      </div>

      {!isClarifying && (
        <div className="ticket-routing-strip">
          <div className="ticket-routing-step routing-step-1">
            <span className="routing-icon material-symbols-outlined">psychology</span>
            <span className="routing-label">AI Analyses</span>
            <span className="step-dot"></span>
          </div>
          <span className="ticket-routing-arrow material-symbols-outlined">arrow_forward</span>
          <div className="ticket-routing-step routing-step-2">
            <span className="routing-icon material-symbols-outlined">hub</span>
            <span className="routing-label">Routes & Clarifies</span>
            <span className="step-dot"></span>
          </div>
          <span className="ticket-routing-arrow material-symbols-outlined">arrow_forward</span>
          <div className="ticket-routing-step routing-step-3">
            <span className="routing-icon material-symbols-outlined">groups</span>
            <span className="routing-label">Assigns Team</span>
            <span className="step-dot"></span>
          </div>
          <span className="ticket-routing-arrow material-symbols-outlined">arrow_forward</span>
          <div className="ticket-routing-step routing-step-4">
            <span className="routing-icon material-symbols-outlined">task_alt</span>
            <span className="routing-label">Ticket Created</span>
            <span className="step-dot final"></span>
          </div>
        </div>
      )}

      <div className="form-actions">
        <div className="form-primary-actions">
          <button className="btn-submit" onClick={submitTicket} disabled={isLoading || !message.trim()}>
            {isLoading
              ? <span className="material-symbols-outlined btn-spin">progress_activity</span>
              : <span className="material-symbols-outlined">send</span>}
            {submitLabel}
          </button>
          <button
            type="button"
            className="btn-reset"
            onClick={() => setMessage('')}
            disabled={isLoading || !message.trim()}
            title="Clear the input"
          >
            <span className="material-symbols-outlined">restart_alt</span>
            Reset
          </button>
        </div>
        {error && (
          <p className="form-error-msg">
            <span className="material-symbols-outlined">error</span>
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
