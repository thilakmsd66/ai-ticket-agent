export default function UserGuide() {
  const quickStartSteps = [
    {
      title: 'Submit your ticket',
      icon: 'edit_note',
      description: 'Describe the issue in plain language and press Submit Ticket.',
    },
    {
      title: 'Review AI clarification',
      icon: 'live_help',
      description:
        'If the system needs more detail, answer the follow-up question to complete the ticket.',
    },
    {
      title: 'Use the dashboard',
      icon: 'monitoring',
      description: 'Track AI response-time, ticket trends, team distribution, and priority mix.',
    },
    {
      title: 'Manage from history',
      icon: 'history',
      description:
        'Review created tickets, search by keywords, and update or cancel tickets as needed.',
    },
  ]

  const featureMap = [
    {
      title: 'Ticket Agent',
      icon: 'support_agent',
      bullets: [
        'Creates incident tickets in INC######## format.',
        'Auto-assigns team and priority after clarification is complete.',
        'Shows service errors clearly when AI provider is unavailable.',
      ],
    },
    {
      title: 'Voice Assistant',
      icon: 'mic',
      bullets: [
        'Allows hands-free ticket creation via speech recognition.',
        'Speaks AI follow-up prompts and ticket confirmation.',
        'Displays ticket card with number, team, priority, and created date.',
      ],
    },
    {
      title: 'Ticket History',
      icon: 'receipt_long',
      bullets: [
        'Searches by ticket number, team, priority, or message text.',
        'Supports inline edit and cancel actions.',
        'Exports filtered records as CSV for reporting.',
      ],
    },
    {
      title: 'Analytics',
      icon: 'insights',
      bullets: [
        'Shows AI response-time KPI from measured ticket responses.',
        'Includes team and priority distribution visuals.',
        'Includes a 7-day trend chart with scroll-triggered animation.',
      ],
    },
  ]

  const troubleshooting = [
    {
      issue: '503 Service Unavailable',
      fix: 'AI provider is currently unavailable or quota-limited. Retry later and verify backend health endpoint.',
    },
    {
      issue: 'No ticket created after clarification',
      fix: 'Answer the follow-up question with impact and urgency details so classification can complete.',
    },
    {
      issue: 'Voice input not working',
      fix: 'Allow microphone permission in browser and verify SpeechRecognition is supported.',
    },
    {
      issue: 'Frontend cannot fetch backend',
      fix: 'Confirm backend is running on the configured API port and that CORS origin matches frontend URL.',
    },
  ]

  return (
    <section className="guide-page">
      <div className="page-title-row">
        <div>
          <h2>
            <span className="section-icon material-symbols-outlined">menu_book</span>
            User Guide
          </h2>
          <p className="page-subtitle">
            Learn the full workflow from submission to analytics, with troubleshooting
            guidance for common issues.
          </p>
        </div>
      </div>

      <div className="guide-content">
        <section className="guide-section">
          <div className="guide-section-header">
            <span className="material-symbols-outlined">rocket_launch</span>
            <h3>Quick Start</h3>
          </div>
          <ol className="guide-quick-start">
            {quickStartSteps.map((step) => (
              <li key={step.title}>
                <strong>
                  <span className="material-symbols-outlined guide-step-icon">{step.icon}</span>
                  {step.title}
                </strong>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="guide-section">
          <div className="guide-section-header">
            <span className="material-symbols-outlined">map</span>
            <h3>Feature Map</h3>
          </div>
          <div className="guide-feature-grid">
            {featureMap.map((feature) => (
              <article key={feature.title} className="guide-feature-card">
                <h4>
                  <span className="material-symbols-outlined">{feature.icon}</span>
                  {feature.title}
                </h4>
                <ul>
                  {feature.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="guide-section">
          <div className="guide-section-header">
            <span className="material-symbols-outlined">alt_route</span>
            <h3>Clarification Workflow</h3>
          </div>
          <div className="guide-flow">
            <div>
              <span className="guide-flow-step">1</span>
              <p>Submit issue description with application context.</p>
            </div>
            <div>
              <span className="guide-flow-step">2</span>
              <p>If needed, AI asks one follow-up clarification question.</p>
            </div>
            <div>
              <span className="guide-flow-step">3</span>
              <p>After clarification, ticket is classified and assigned to a team.</p>
            </div>
            <div>
              <span className="guide-flow-step">4</span>
              <p>Ticket appears in history and analytics with created date and performance metrics.</p>
            </div>
          </div>
        </section>

        <section className="guide-section">
          <div className="guide-section-header">
            <span className="material-symbols-outlined">build_circle</span>
            <h3>Troubleshooting</h3>
          </div>
          <div className="guide-troubleshooting">
            {troubleshooting.map((item) => (
              <article key={item.issue}>
                <h4>{item.issue}</h4>
                <p>{item.fix}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}
