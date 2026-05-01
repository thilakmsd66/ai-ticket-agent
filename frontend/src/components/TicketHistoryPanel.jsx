import { useEffect, useState } from 'react'

export default function TicketHistoryPanel({ tickets, onUpdateTicket, onCancelTicket }) {
  const teamOptions = [
    'Helpdesk',
    'Development',
    'Database Team',
    'Network Support',
    'Unix Support',
    'Windows Support',
    'AWS Support',
    'Security',
    'Pending clarification',
  ]

  const ticketsPerPage = 5
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingTicketNumber, setEditingTicketNumber] = useState('')
  const [editOriginalMessage, setEditOriginalMessage] = useState('')
  const [editClarifiedMessage, setEditClarifiedMessage] = useState('')
  const [editAssignedTeam, setEditAssignedTeam] = useState('Helpdesk')
  const [actionLoadingTicket, setActionLoadingTicket] = useState('')

  const toCsvValue = (value) => {
    if (value === null || value === undefined) {
      return ''
    }
    const text = String(value).replace(/"/g, '""')
    return `"${text}"`
  }

  const exportTicketsCsv = () => {
    const headers = [
      'ticket_number',
      'assigned_team',
      'priority',
      'created_at',
      'clarification_needed',
      'clarification_question',
      'clarified_message',
      'original_message',
    ]

    const rows = filteredTickets.map((ticket) =>
      [
        ticket.ticket_number,
        ticket.assigned_team,
        ticket.priority,
        ticket.created_at,
        ticket.clarification_needed,
        ticket.clarification_question,
        ticket.clarified_message,
        ticket.original_message,
      ]
        .map(toCsvValue)
        .join(','),
    )

    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'ticket_history_export.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const formatCreatedAt = (createdAt) => {
    if (!createdAt) {
      return '—'
    }

    const parsed = new Date(createdAt)
    if (Number.isNaN(parsed.getTime())) {
      return String(createdAt)
    }

    return parsed.toLocaleString()
  }

  const filteredTickets = tickets.filter((ticket) => {
    if (!normalizedQuery) {
      return true
    }

    return [
      ticket.ticket_number,
      ticket.original_message,
      ticket.clarified_message,
      ticket.assigned_team,
      ticket.priority,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery))
  })

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / ticketsPerPage))
  const startIndex = (currentPage - 1) * ticketsPerPage
  const visibleTickets = filteredTickets.slice(startIndex, startIndex + ticketsPerPage)

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const startEditTicket = (ticket) => {
    setEditingTicketNumber(ticket.ticket_number)
    setEditOriginalMessage(ticket.original_message || '')
    setEditClarifiedMessage(ticket.clarified_message || '')
    setEditAssignedTeam(ticket.assigned_team || 'Helpdesk')
  }

  const discardEdit = () => {
    setEditingTicketNumber('')
    setEditOriginalMessage('')
    setEditClarifiedMessage('')
    setEditAssignedTeam('Helpdesk')
  }

  const saveEdit = async (ticketNumber) => {
    const original = editOriginalMessage.trim()
    const clarified = editClarifiedMessage.trim()

    if (!original || !clarified) {
      return
    }

    setActionLoadingTicket(ticketNumber)
    const ok = await onUpdateTicket(ticketNumber, {
      original_message: original,
      clarified_message: clarified,
      assigned_team: editAssignedTeam,
    })
    setActionLoadingTicket('')

    if (ok) {
      discardEdit()
    }
  }

  const cancelTicket = async (ticketNumber) => {
    if (!window.confirm(`Cancel ticket ${ticketNumber}?`)) {
      return
    }

    setActionLoadingTicket(ticketNumber)
    await onCancelTicket(ticketNumber)
    setActionLoadingTicket('')

    if (editingTicketNumber === ticketNumber) {
      discardEdit()
    }
  }

  return (
    <div className="ticket-history">
      <div className="history-header">
        <div className="history-header-title">
          <h3>
            <span className="material-symbols-outlined">history</span>
            Ticket history
          </h3>
          <p>
            {filteredTickets.length}
            {normalizedQuery ? ` of ${tickets.length}` : ''} ticket(s) shown
          </p>
        </div>
        <div className="history-header-actions">
          <button
            type="button"
            className="export-button history-export-button"
            onClick={exportTicketsCsv}
            disabled={filteredTickets.length === 0}
            title="Export shown tickets as CSV"
          >
            <span className="material-symbols-outlined">download</span>
            Export CSV
          </button>

          <label className="history-search" htmlFor="ticket-history-search">
            <span className="material-symbols-outlined">search</span>
            <input
              id="ticket-history-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by ticket #, message, team, priority"
            />
          </label>
        </div>
      </div>

      {filteredTickets.length === 0 ? (
        <div className="empty-state">
          <span className="material-symbols-outlined">inbox</span>
          <p>
            {tickets.length === 0
              ? 'No tickets yet. Start by submitting a request.'
              : 'No tickets match your search.'}
          </p>
        </div>
      ) : (
        visibleTickets.map((ticket, index) => (
          <article key={ticket.ticket_number || index} className="ticket-card">
            <div className="ticket-meta">
              {ticket.ticket_number && (
                <span className="badge">
                  <span className="material-symbols-outlined">confirmation_number</span>
                  Ticket: {ticket.ticket_number}
                </span>
              )}
              <span className="badge badge-team">
                <span className="material-symbols-outlined">groups</span>
                Team: {ticket.assigned_team}
              </span>
              {!ticket.clarification_needed && ticket.priority && (
                <span className={`badge badge-priority badge-priority-${ticket.priority}`}>
                  <span className="material-symbols-outlined">flag</span>
                  Priority: {ticket.priority}
                </span>
              )}
              <span className="badge">
                <span className="material-symbols-outlined">schedule</span>
                Created: {formatCreatedAt(ticket.created_at)}
              </span>
              {ticket.assigned_team === 'Cancelled' && (
                <span className="badge badge-cancelled">
                  <span className="material-symbols-outlined">cancel</span>
                  Cancelled
                </span>
              )}
              {ticket.clarification_needed && (
                <span className="badge badge-warning">
                  <span className="material-symbols-outlined">priority_high</span>
                  Needs clarification
                </span>
              )}
              {ticket.response_source === 'fallback' && (
                <span className="badge badge-fallback" title="Routed by rule-based fallback (AI offline)">
                  <span className="material-symbols-outlined">offline_bolt</span>
                  Fallback Routing
                </span>
              )}
            </div>
            <div className="ticket-body">
              {editingTicketNumber === ticket.ticket_number ? (
                <div className="ticket-edit-form">
                  <label className="ticket-edit-field">
                    <span className="ticket-edit-label">
                      <span className="material-symbols-outlined">description</span>
                      Original request
                    </span>
                    <textarea
                      className="ticket-edit-input"
                      rows={3}
                      value={editOriginalMessage}
                      onChange={(event) => setEditOriginalMessage(event.target.value)}
                    />
                  </label>
                  <label className="ticket-edit-field">
                    <span className="ticket-edit-label">
                      <span className="material-symbols-outlined">auto_awesome</span>
                      Clarified message
                    </span>
                    <textarea
                      className="ticket-edit-input"
                      rows={3}
                      value={editClarifiedMessage}
                      onChange={(event) => setEditClarifiedMessage(event.target.value)}
                    />
                  </label>
                  <label className="ticket-edit-field">
                    <span className="ticket-edit-label">
                      <span className="material-symbols-outlined">groups</span>
                      Assigned team
                    </span>
                    <select
                      className="ticket-edit-input"
                      value={editAssignedTeam}
                      onChange={(event) => setEditAssignedTeam(event.target.value)}
                    >
                      {teamOptions.map((team) => (
                        <option key={team} value={team}>
                          {team}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="ticket-action-row ticket-edit-actions">
                    <button
                      type="button"
                      className="ticket-action-button"
                      onClick={() => saveEdit(ticket.ticket_number)}
                      disabled={actionLoadingTicket === ticket.ticket_number}
                    >
                      <span className="material-symbols-outlined">save</span>
                      Save
                    </button>
                    <button
                      type="button"
                      className="ticket-action-button secondary"
                      onClick={discardEdit}
                      disabled={actionLoadingTicket === ticket.ticket_number}
                    >
                      <span className="material-symbols-outlined">close</span>
                      Discard
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p>
                    <strong>Original request:</strong> {ticket.original_message}
                  </p>
                  <p>
                    <strong>Clarified:</strong> {ticket.clarified_message}
                  </p>
                  {ticket.clarification_needed && ticket.clarification_question && (
                    <p>
                      <strong>Clarification question:</strong>{' '}
                      {ticket.clarification_question}
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="ticket-action-row">
              <button
                type="button"
                className="ticket-action-button secondary"
                onClick={() => startEditTicket(ticket)}
                disabled={ticket.assigned_team === 'Cancelled' || actionLoadingTicket === ticket.ticket_number}
              >
                <span className="material-symbols-outlined">edit</span>
                Edit
              </button>
              <button
                type="button"
                className="ticket-action-button danger"
                onClick={() => cancelTicket(ticket.ticket_number)}
                disabled={ticket.assigned_team === 'Cancelled' || actionLoadingTicket === ticket.ticket_number}
              >
                <span className="material-symbols-outlined">cancel</span>
                Cancel
              </button>
            </div>
          </article>
        ))
      )}

      {filteredTickets.length > ticketsPerPage && (
        <div className="ticket-pagination">
          <button
            type="button"
            className="pagination-button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
          >
            <span className="material-symbols-outlined">chevron_left</span>
            Previous
          </button>
          <span className="page-status">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            className="pagination-button"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={currentPage === totalPages}
          >
            Next
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      )}
    </div>
  )
}
