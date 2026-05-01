import { useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '../config'

export default function VoiceAssistantModal({ isOpen, onClose, onTicketCreated, normalizeServiceMessage }) {
  const [messages, setMessages] = useState([])
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [pendingOriginal, setPendingOriginal] = useState('')
  const [clarificationQuestion, setClarificationQuestion] = useState('')
  const [createdTicket, setCreatedTicket] = useState(null)
  const [voiceLevel, setVoiceLevel] = useState(0)
  const recognitionRef = useRef(null)
  const messagesEndRef = useRef(null)
  const hasGreeted = useRef(false)
  const mediaStreamRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const rafRef = useRef(null)

  const speak = (text) => {
    if (!text || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = 1
    utt.pitch = 1
    window.speechSynthesis.speak(utt)
  }

  const addMessage = (role, text) => {
    setMessages((prev) => [...prev, { role, text, id: Date.now() + Math.random() }])
  }

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const stopAudioVisualizer = () => {
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }

    analyserRef.current = null
    setVoiceLevel(0)
  }

  const startAudioVisualizer = async () => {
    stopAudioVisualizer()

    if (!navigator.mediaDevices?.getUserMedia) {
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      const AudioContextCtor = window.AudioContext || window.webkitAudioContext
      if (!AudioContextCtor) {
        return
      }

      const audioContext = new AudioContextCtor()
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.85
      source.connect(analyser)
      analyserRef.current = analyser

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const updateLevel = () => {
        if (!analyserRef.current) {
          return
        }

        analyserRef.current.getByteTimeDomainData(dataArray)
        let sumSquares = 0
        for (let i = 0; i < dataArray.length; i += 1) {
          const centered = (dataArray[i] - 128) / 128
          sumSquares += centered * centered
        }

        const rms = Math.sqrt(sumSquares / dataArray.length)
        const normalized = Math.max(0.04, Math.min(1, rms * 5.5))
        setVoiceLevel(normalized)
        rafRef.current = window.requestAnimationFrame(updateLevel)
      }

      updateLevel()
    } catch {
      setVoiceLevel(0)
    }
  }

  // Greet when modal opens
  useEffect(() => {
    if (!isOpen) {
      // Reset on close
      hasGreeted.current = false
      setMessages([])
      setPendingOriginal('')
      setClarificationQuestion('')
      setCreatedTicket(null)
      setIsListening(false)
      setIsProcessing(false)
      stopAudioVisualizer()
      window.speechSynthesis?.cancel()
      recognitionRef.current?.stop()
      return
    }

    if (hasGreeted.current) return
    hasGreeted.current = true

    const greeting = "Hi! I'm your AI ticket assistant. Tell me your issue and I'll create a ticket for you."
    addMessage('ai', greeting)
    setTimeout(() => speak(greeting), 300)
  }, [isOpen])

  // Setup speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsListening(true)
      startAudioVisualizer()
    }

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim()
      if (!transcript) return
      handleUserInput(transcript)
    }

    recognition.onerror = () => {
      addMessage('system', 'Could not capture voice. Please try again.')
      setIsListening(false)
      stopAudioVisualizer()
    }

    recognition.onend = () => {
      setIsListening(false)
      stopAudioVisualizer()
    }

    recognitionRef.current = recognition
    return () => {
      try { recognition.stop() } catch { /* no-op */ }
      recognitionRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      stopAudioVisualizer()
    }
  }, [])

  const handleUserInput = async (text) => {
    addMessage('user', text)
    setIsProcessing(true)

    const payload = {
      message: pendingOriginal || text,
      history: [],
    }

    if (pendingOriginal) {
      payload.clarification_answer = text
      payload.clarification_question = clarificationQuestion
    }

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error(`Server error: ${response.status}`)
      const data = await response.json()

      if (data.clarification_needed) {
        const question = data.clarification_question || 'Can you provide more detail?'
        setPendingOriginal(payload.message)
        setClarificationQuestion(question)
        addMessage('ai', question)
        speak(question)
      } else {
        setPendingOriginal('')
        setClarificationQuestion('')

        const ticket = {
          ticket_number: data.ticket_number,
          original_message: payload.message,
          clarified_message: data.clarified_message,
          assigned_team: data.assigned_team,
          priority: data.priority,
          created_at: data.created_at,
          response_time_ms: data.response_time_ms,
          clarification_needed: false,
        }
        setCreatedTicket(ticket)
        onTicketCreated(ticket)

        const createdAt = data.created_at
          ? new Date(data.created_at).toLocaleString()
          : new Date().toLocaleString()
        const summary = `Your ticket ${data.ticket_number} has been created and assigned to ${data.assigned_team} with ${data.priority} priority. Created at ${createdAt}.`
        addMessage('ai', summary)
        speak(summary)
      }
    } catch (err) {
      const msg = normalizeServiceMessage
        ? normalizeServiceMessage(err, 'AI service is unavailable right now.')
        : 'AI service is unavailable right now.'
      addMessage('system', msg)
      speak(msg)
    } finally {
      setIsProcessing(false)
    }
  }

  const toggleMic = () => {
    if (!recognitionRef.current) {
      addMessage('system', 'Voice input is not supported in this browser.')
      return
    }
    if (isListening) {
      recognitionRef.current.stop()
    } else {
      recognitionRef.current.start()
    }
  }

  const handleNewTicket = () => {
    setCreatedTicket(null)
    setPendingOriginal('')
    setClarificationQuestion('')
    setMessages([])
    hasGreeted.current = false
    const greeting = "I'm ready for your next issue. Go ahead and tell me."
    addMessage('ai', greeting)
    setTimeout(() => speak(greeting), 300)
  }

  if (!isOpen) return null

  return (
    <div className="voice-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="voice-modal">

        {/* Header */}
        <div className="voice-modal-header">
          <div className="voice-modal-title">
            <span className="material-symbols-outlined">smart_toy</span>
            AI Voice Assistant
          </div>
          <button className="voice-modal-close" onClick={onClose} aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Chat thread */}
        <div className="voice-modal-messages">
          {messages.map((msg) => (
            <div key={msg.id} className={`voice-chat-bubble voice-chat-${msg.role}`}>
              <span className="voice-bubble-icon-wrap" aria-hidden="true">
                {msg.role === 'ai' && (
                  <span className="voice-bubble-icon material-symbols-outlined">smart_toy</span>
                )}
                {msg.role === 'user' && (
                  <span className="voice-bubble-icon material-symbols-outlined">face</span>
                )}
                {msg.role === 'system' && (
                  <span className="voice-bubble-icon material-symbols-outlined">info</span>
                )}
              </span>
              <div className="voice-bubble-content">
                <span className="voice-bubble-role">
                  {msg.role === 'ai' ? 'AI CORE' : msg.role === 'user' ? 'YOU' : 'SYSTEM'}
                </span>
                <span className="voice-bubble-text">{msg.text}</span>
              </div>
            </div>
          ))}
          {isProcessing && (
            <div className="voice-chat-bubble voice-chat-ai voice-typing">
              <span className="voice-bubble-icon-wrap" aria-hidden="true">
                <span className="voice-bubble-icon material-symbols-outlined">smart_toy</span>
              </span>
              <div className="voice-bubble-content">
                <span className="voice-bubble-role">AI CORE</span>
                <span className="voice-typing-dots">
                  <span /><span /><span />
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Ticket success card */}
        {createdTicket && (
          <div className="voice-ticket-card">
            <div className="voice-ticket-card-header">
              <span className="material-symbols-outlined">confirmation_number</span>
              Ticket Created
            </div>
            <div className="voice-ticket-card-body">
              <div className="voice-ticket-row">
                <span className="voice-ticket-label">Ticket #</span>
                <span className="voice-ticket-value">{createdTicket.ticket_number}</span>
              </div>
              <div className="voice-ticket-row">
                <span className="voice-ticket-label">Team</span>
                <span className="voice-ticket-value">{createdTicket.assigned_team}</span>
              </div>
              <div className="voice-ticket-row">
                <span className="voice-ticket-label">Priority</span>
                <span className={`priority-chip priority-${createdTicket.priority?.toLowerCase()}`}>
                  {createdTicket.priority}
                </span>
              </div>
              <div className="voice-ticket-row">
                <span className="voice-ticket-label">Created</span>
                <span className="voice-ticket-value">
                  {createdTicket.created_at
                    ? new Date(createdTicket.created_at).toLocaleString()
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Orb + mic controls */}
        <div className="voice-modal-controls">
          <div
            className={`voice-orb ${isListening ? 'orb-listening whisper-live' : ''} ${isProcessing ? 'orb-processing' : ''}`}
            style={{ '--voice-level': voiceLevel }}
          >
            <div className="voice-orb-ring" />
            <div className="voice-orb-ring ring2" />
            <div className="voice-orb-ring ring3" />
            <span className="material-symbols-outlined voice-orb-icon">
              {isListening ? 'mic' : isProcessing ? 'hourglass_empty' : 'mic_none'}
            </span>
          </div>

          <div
            className={`voice-live-wave ${isListening ? 'active' : ''}`}
            style={{ '--voice-level': voiceLevel }}
            aria-hidden="true"
          >
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>

          <div className="voice-modal-buttons">
            <button
              className={`voice-modal-mic-btn whisper-mic ${isListening ? 'mic-active' : ''}`}
              onClick={toggleMic}
              disabled={isProcessing}
              title={isListening ? 'Stop listening' : 'Start speaking'}
            >
              <span className="material-symbols-outlined">
                {isListening ? 'mic_off' : 'mic'}
              </span>
              {isListening ? 'Stop' : 'Speak'}
            </button>

            {createdTicket && (
              <button className="voice-modal-new-btn" onClick={handleNewTicket}>
                <span className="material-symbols-outlined">add_circle</span>
                New Ticket
              </button>
            )}
          </div>

          <p className="voice-modal-status">
            {isListening
              ? 'Listening… speak your issue now.'
              : isProcessing
              ? 'AI is processing your request…'
              : createdTicket
              ? 'Ticket created! Say another issue or close.'
              : 'Press Speak and describe your issue.'}
          </p>
        </div>

      </div>
    </div>
  )
}
