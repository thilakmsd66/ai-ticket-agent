export default function SupportFooter() {
  return (
    <footer className="app-disclaimer" aria-live="polite">
      <div className="disclaimer-item">
        <span className="material-symbols-outlined" aria-hidden="true">warning</span>
        <div>
          <p className="disclaimer-title">AI response warning</p>
          <p>AI responses may not always be accurate. Validate outputs before implementation.</p>
        </div>
      </div>

      <div className="disclaimer-item">
        <span className="material-symbols-outlined" aria-hidden="true">fact_check</span>
        <div>
          <p className="disclaimer-title">Critical verification</p>
          <p>Always verify production-impacting details with approved runbooks or SMEs.</p>
        </div>
      </div>

      <div className="disclaimer-item">
        <span className="material-symbols-outlined" aria-hidden="true">support_agent</span>
        <div>
          <p className="disclaimer-title">Need help?</p>
          <p>
            Contact Service Desk: <a href="mailto:support@aicafe.internal">support@aicafe.internal</a> |{' '}
            +1 (800) 555-0142
          </p>
          <p>
            Escalation: <a href="mailto:incident-manager@aicafe.internal">incident-manager@aicafe.internal</a>
          </p>
        </div>
      </div>

      <div className="disclaimer-item">
        <span className="material-symbols-outlined" aria-hidden="true">privacy_tip</span>
        <div>
          <p className="disclaimer-title">Data safety</p>
          <p>Do not share passwords, API keys, personal data, or regulated information in prompts.</p>
        </div>
      </div>
    </footer>
  )
}
