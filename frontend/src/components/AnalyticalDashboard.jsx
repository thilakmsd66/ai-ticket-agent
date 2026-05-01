import { useEffect, useRef, useState } from 'react'

export default function AnalyticalDashboard({ tickets, pendingClarificationCount = 0 }) {
  const sectionRef = useRef(null)
  const [hasAnimated, setHasAnimated] = useState(false)

  useEffect(() => {
    const element = sectionRef.current
    if (!element || hasAnimated) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setHasAnimated(true)
          observer.disconnect()
        }
      },
      { threshold: 0.25 },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [hasAnimated])

  const toCsvValue = (value) => {
    if (value === null || value === undefined) {
      return ''
    }
    const text = String(value).replace(/"/g, '""')
    return `"${text}"`
  }

  const downloadFile = (content, fileName, mimeType) => {
    const blob = new Blob([content], { type: mimeType })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  const getTeamMeta = (teamName) => {
    const team = (teamName || '').toLowerCase()

    if (team.includes('aws') || team.includes('cloud')) {
      return { icon: 'cloud', tone: 'aws' }
    }
    if (
      team.includes('database') ||
      team.includes('sql') ||
      team.includes('oracle') ||
      team.includes('db')
    ) {
      return { icon: 'database', tone: 'database' }
    }
    if (team.includes('network') || team.includes('vpn') || team.includes('infra')) {
      return { icon: 'lan', tone: 'network' }
    }
    if (team.includes('helpdesk') || team.includes('support')) {
      return { icon: 'support_agent', tone: 'helpdesk' }
    }
    if (team.includes('dev') || team.includes('engineering')) {
      return { icon: 'code_blocks', tone: 'development' }
    }

    return { icon: 'groups', tone: 'default' }
  }

  const ticketCount = tickets.length
  const clarificationCount =
    tickets.filter((ticket) => ticket.clarification_needed).length + pendingClarificationCount
  const resolvedTickets = tickets.filter((ticket) => !ticket.clarification_needed)
  const teamCounts = Object.entries(
    resolvedTickets.reduce((acc, ticket) => {
      const team = ticket.assigned_team || 'Unassigned'
      if (!acc[team]) {
        acc[team] = { total: 0, priority: { P1: 0, P2: 0, P3: 0, P4: 0 } }
      }
      acc[team].total += 1
      if (ticket.priority && acc[team].priority[ticket.priority] !== undefined) {
        acc[team].priority[ticket.priority] += 1
      }
      return acc
    }, {}),
  ).sort((a, b) => b[1].total - a[1].total)
  const maxTeamCount = Math.max(...teamCounts.map(([, stats]) => stats.total), 1)

  const priorityCounts = resolvedTickets.reduce(
    (acc, ticket) => {
      if (ticket.priority && acc[ticket.priority] !== undefined) {
        acc[ticket.priority] += 1
      }
      return acc
    },
    { P1: 0, P2: 0, P3: 0, P4: 0 },
  )
  const urgentTicketCount = priorityCounts.P1 + priorityCounts.P2
  const urgencyLoadPercent = resolvedTickets.length
    ? Math.round((urgentTicketCount / resolvedTickets.length) * 100)
    : 0

  const buildConicGradient = (segments, fallbackColor = '#334155') => {
    const total = segments.reduce((sum, segment) => sum + segment.value, 0)
    if (total <= 0) {
      return `conic-gradient(${fallbackColor} 0% 100%)`
    }

    let cursor = 0
    const stops = segments
      .filter((segment) => segment.value > 0)
      .map((segment) => {
        const start = (cursor / total) * 100
        cursor += segment.value
        const end = (cursor / total) * 100
        return `${segment.color} ${start}% ${end}%`
      })

    return `conic-gradient(${stops.join(', ')})`
  }

  const priorityColors = {
    P1: '#ef4444',
    P2: '#f97316',
    P3: '#eab308',
    P4: '#22c55e',
  }

  const prioritySegments = Object.entries(priorityCounts).map(([priority, value]) => ({
    key: priority,
    label: priority,
    value,
    color: priorityColors[priority],
  }))
  const priorityTotal = prioritySegments.reduce((sum, segment) => sum + segment.value, 0)
  const priorityConic = buildConicGradient(prioritySegments, '#475569')

  const teamPalette = ['#60a5fa', '#34d399', '#f59e0b', '#f472b6', '#a78bfa', '#22d3ee']
  const rankedTeams = teamCounts.map(([team, stats]) => ({ team, total: stats.total }))
  const topTeams = rankedTeams.slice(0, 5)
  const otherTotal = rankedTeams.slice(5).reduce((sum, item) => sum + item.total, 0)
  const teamSegments = topTeams.map((item, index) => ({
    key: item.team,
    label: item.team,
    value: item.total,
    color: teamPalette[index % teamPalette.length],
  }))

  if (otherTotal > 0) {
    teamSegments.push({
      key: 'Other',
      label: 'Other',
      value: otherTotal,
      color: '#94a3b8',
    })
  }

  const teamTotal = teamSegments.reduce((sum, segment) => sum + segment.value, 0)
  const teamConic = buildConicGradient(teamSegments, '#334155')

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const trendDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startOfToday)
    date.setDate(startOfToday.getDate() - (6 - index))
    const key = date.toISOString().slice(0, 10)
    return {
      key,
      label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      count: 0,
    }
  })

  const trendByDay = Object.fromEntries(trendDates.map((day) => [day.key, 0]))
  tickets.forEach((ticket) => {
    if (!ticket.created_at) {
      return
    }
    const parsed = new Date(ticket.created_at)
    if (Number.isNaN(parsed.getTime())) {
      return
    }
    const key = parsed.toISOString().slice(0, 10)
    if (trendByDay[key] !== undefined) {
      trendByDay[key] += 1
    }
  })

  const trendData = trendDates.map((day) => ({ ...day, count: trendByDay[day.key] }))
  const maxTrendCount = Math.max(...trendData.map((day) => day.count), 1)
  const recentCount = trendData[trendData.length - 1]?.count || 0
  const previousCount = trendData[trendData.length - 2]?.count || 0
  const trendDelta = recentCount - previousCount
  const measuredResponseTimes = tickets
    .map((ticket) => Number(ticket.response_time_ms))
    .filter((value) => Number.isFinite(value) && value > 0)
  const avgResponseTimeMs = measuredResponseTimes.length
    ? Math.round(measuredResponseTimes.reduce((sum, value) => sum + value, 0) / measuredResponseTimes.length)
    : 0
  const aiResponseLabel = measuredResponseTimes.length
    ? `Average across ${measuredResponseTimes.length} measured ticket(s)`
    : 'No measured tickets yet'

  const trendChartWidth = 680
  const trendChartHeight = 220
  const trendPadX = 24
  const trendPadY = 20
  const trendInnerWidth = trendChartWidth - trendPadX * 2
  const trendInnerHeight = trendChartHeight - trendPadY * 2
  const trendDivisor = Math.max(trendData.length - 1, 1)

  const trendPoints = trendData.map((day, index) => {
    const x = trendPadX + (index / trendDivisor) * trendInnerWidth
    const y = trendPadY + trendInnerHeight - (day.count / maxTrendCount) * trendInnerHeight
    return { ...day, x, y }
  })

  const trendLinePoints = trendPoints
    .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(' ')

  const trendAreaPath = trendPoints.length
    ? `M ${trendPoints[0].x.toFixed(2)} ${(trendPadY + trendInnerHeight).toFixed(2)} ` +
      `${trendPoints.map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')} ` +
      `L ${trendPoints[trendPoints.length - 1].x.toFixed(2)} ${(trendPadY + trendInnerHeight).toFixed(2)} Z`
    : ''

  const trendGridRows = Array.from({ length: 5 }, (_, idx) => {
    const ratio = idx / 4
    const y = trendPadY + ratio * trendInnerHeight
    const value = Math.round(maxTrendCount - ratio * maxTrendCount)
    return { ratio, y, value }
  })

  const exportClassifiedTicketsCsv = () => {
    const headers = [
      'ticket_number',
      'assigned_team',
      'priority',
      'created_at',
      'clarified_message',
      'original_message',
    ]
    const rows = resolvedTickets.map((ticket) =>
      [
        ticket.ticket_number,
        ticket.assigned_team,
        ticket.priority,
        ticket.created_at,
        ticket.clarified_message,
        ticket.original_message,
      ]
        .map(toCsvValue)
        .join(','),
    )
    const csv = [headers.join(','), ...rows].join('\n')
    downloadFile(csv, 'analytics_classified_tickets.csv', 'text/csv;charset=utf-8')
  }

  const exportTeamSummaryCsv = () => {
    const headers = ['team', 'total', 'P1', 'P2', 'P3', 'P4']
    const rows = teamCounts.map(([team, stats]) =>
      [team, stats.total, stats.priority.P1, stats.priority.P2, stats.priority.P3, stats.priority.P4]
        .map(toCsvValue)
        .join(','),
    )
    const csv = [headers.join(','), ...rows].join('\n')
    downloadFile(csv, 'analytics_team_priority_summary.csv', 'text/csv;charset=utf-8')
  }

  const exportAnalyticsJson = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      totals: {
        tickets: ticketCount,
        clarification_needed: clarificationCount,
        classified: resolvedTickets.length,
        avg_response_time_ms: avgResponseTimeMs,
      },
      priority_counts: priorityCounts,
      team_summary: teamCounts.map(([team, stats]) => ({
        team,
        total: stats.total,
        priority: stats.priority,
      })),
      classified_tickets: resolvedTickets,
    }
    downloadFile(JSON.stringify(payload, null, 2), 'analytics_export.json', 'application/json')
  }

  return (
    <section ref={sectionRef} className={`dashboard-page ${hasAnimated ? 'dashboard-animate' : ''}`}>
      <div className="page-title-row">
        <div>
          <h2>
            <span className="section-icon material-symbols-outlined">insights</span>
            Analytical Dashboard
          </h2>
          <p className="page-subtitle">
            Track ticket flow, clarify requests, and see how your AI-assisted
            workflow is performing.
          </p>
        </div>
      </div>

      <div className="dashboard-grid">
        <article className="dashboard-card card-highlight">
          <div className="card-top">
            <span className="card-icon material-symbols-outlined">confirmation_number</span>
            <h3>Total tickets</h3>
          </div>
          <p>{ticketCount}</p>
        </article>
        <article className="dashboard-card card-highlight">
          <div className="card-top">
            <span className="card-icon material-symbols-outlined">timer</span>
            <h3>AI response time</h3>
          </div>
          <p>{measuredResponseTimes.length ? `${avgResponseTimeMs}ms` : '—'}</p>
          <small className="dashboard-metric-note">{aiResponseLabel}</small>
        </article>
        <article className="dashboard-card card-highlight">
          <div className="card-top">
            <span className="card-icon material-symbols-outlined">emergency</span>
            <h3>Urgency load</h3>
          </div>
          <p>{urgencyLoadPercent}%</p>
          <small className="dashboard-metric-note">{urgentTicketCount} P1/P2 ticket(s)</small>
        </article>
      </div>

      <div className="priority-strip">
        {Object.entries(priorityCounts).map(([priority, count]) => (
          <article key={priority} className={`priority-chip priority-chip-${priority}`}>
            <span className="material-symbols-outlined">flag</span>
            <div>
              <p>{priority}</p>
              <small>{count} ticket(s)</small>
            </div>
          </article>
        ))}
      </div>

      <div className="dashboard-chart">
        <div className="chart-header">
          <div>
            <span className="material-symbols-outlined chart-icon">stacked_bar_chart</span>
            <div>
              <h3>Ticket distribution</h3>
              <p>Team breakdown across all ticket assignments.</p>
            </div>
          </div>
          <div className="chart-actions">
            <span className="chart-total">{resolvedTickets.length} classified (team + priority)</span>
            <div className="export-actions">
              <button type="button" className="export-button" onClick={exportClassifiedTicketsCsv}>
                <span className="material-symbols-outlined">download</span>
                Tickets CSV
              </button>
              <button type="button" className="export-button" onClick={exportTeamSummaryCsv}>
                <span className="material-symbols-outlined">table_view</span>
                Team Summary CSV
              </button>
              <button type="button" className="export-button" onClick={exportAnalyticsJson}>
                <span className="material-symbols-outlined">data_object</span>
                Analytics JSON
              </button>
            </div>
          </div>
        </div>

        <div className="chart-bars">
          {teamCounts.map(([team, stats]) => {
            const teamMeta = getTeamMeta(team)

            return (
              <div key={team} className="chart-row">
                <div className="chart-row-title">
                  <span className={`material-symbols-outlined team-icon team-icon-${teamMeta.tone}`}>
                    {teamMeta.icon}
                  </span>
                  {team}
                </div>
                <div className="chart-row-bar">
                  <div
                    className="chart-row-fill"
                    style={{ width: `${(stats.total / maxTeamCount) * 100}%` }}
                  />
                </div>
                <div className="chart-row-count">{stats.total}</div>
                <div className="chart-priority-breakdown">
                  {['P1', 'P2', 'P3', 'P4'].map((priority) => (
                    <span key={priority} className={`priority-pill priority-pill-${priority}`}>
                      {priority}:{stats.priority[priority]}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="dashboard-analytics-grid">
        <article className="dashboard-detail dashboard-visual-card">
          <h3>
            <span className="material-symbols-outlined">pie_chart</span>
            Priority share
          </h3>
          <div className="donut-block">
            <div className="donut-chart" style={{ background: priorityConic }}>
              <div className="donut-center">
                <strong>{priorityTotal}</strong>
                <small>Total</small>
              </div>
            </div>
            <ul className="visual-legend">
              {prioritySegments.map((segment) => (
                <li key={segment.key}>
                  <span className="legend-dot" style={{ backgroundColor: segment.color }} />
                  <span>{segment.label}</span>
                  <strong>{segment.value}</strong>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="dashboard-detail dashboard-visual-card">
          <h3>
            <span className="material-symbols-outlined">donut_large</span>
            Team distribution
          </h3>
          <div className="donut-block">
            <div className="donut-chart" style={{ background: teamConic }}>
              <div className="donut-center">
                <strong>{teamTotal}</strong>
                <small>Classified</small>
              </div>
            </div>
            <ul className="visual-legend">
              {teamSegments.map((segment) => (
                <li key={segment.key}>
                  <span className="legend-dot" style={{ backgroundColor: segment.color }} />
                  <span>{segment.label}</span>
                  <strong>{segment.value}</strong>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </div>

      <div className="dashboard-detail dashboard-trend-card">
        <h3>
          <span className="material-symbols-outlined">trending_up</span>
          7-day ticket trend
        </h3>
        <p className="trend-subtitle">
          {trendDelta > 0
            ? `Today is up by ${trendDelta} ticket(s) compared to yesterday.`
            : trendDelta < 0
            ? `Today is down by ${Math.abs(trendDelta)} ticket(s) compared to yesterday.`
            : 'Today matches yesterday ticket volume.'}
        </p>
        <div className="trend-line-wrap">
          <svg className="trend-line-chart" viewBox={`0 0 ${trendChartWidth} ${trendChartHeight}`} role="img" aria-label="Ticket trend in last 7 days">
            <defs>
              <linearGradient id="trendAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.04" />
              </linearGradient>
            </defs>

            {trendGridRows.map((row) => (
              <g key={row.ratio}>
                <line
                  x1={trendPadX}
                  y1={row.y}
                  x2={trendPadX + trendInnerWidth}
                  y2={row.y}
                  className="trend-grid-line"
                />
                <text x={trendPadX - 8} y={row.y + 4} className="trend-grid-label">
                  {row.value}
                </text>
              </g>
            ))}

            {trendAreaPath && <path d={trendAreaPath} className="trend-area" />}
            <polyline points={trendLinePoints} className="trend-line" />

            {trendPoints.map((point) => (
              <g key={point.key}>
                <circle cx={point.x} cy={point.y} r="4" className="trend-point" />
                <text x={point.x} y={point.y - 10} textAnchor="middle" className="trend-point-label">
                  {point.count}
                </text>
              </g>
            ))}
          </svg>

          <div className="trend-x-axis">
            {trendPoints.map((point) => (
              <span key={point.key}>{point.label}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
