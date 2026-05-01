import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../config'

const BASE_URL = API_BASE_URL

const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent']

export default function AdminFeedbackPage({ isActive }) {
  const { token } = useAuth()
  const [feedbacks, setFeedbacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterRating, setFilterRating] = useState(0) // 0 = all

  useEffect(() => {
    if (!isActive) return
    const fetchFeedbacks = async () => {
      setLoading(true)
      setError('')
      try {
        const resp = await fetch(`${BASE_URL}/admin/feedbacks`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!resp.ok) throw new Error('Failed to load feedbacks')
        const data = await resp.json()
        setFeedbacks(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchFeedbacks()
  }, [token, isActive])

  const filtered = filterRating === 0 ? feedbacks : feedbacks.filter(f => f.rating === filterRating)

  const avgRating = feedbacks.length
    ? (feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length).toFixed(1)
    : null

  const dist = [5, 4, 3, 2, 1].map(r => ({
    stars: r,
    count: feedbacks.filter(f => f.rating === r).length,
    label: STAR_LABELS[r],
  }))

  return (
    <div className="admin-feedback-page">
      <div className="admin-feedback-header">
        <div className="admin-feedback-title-icon">
          <span className="material-symbols-outlined">rate_review</span>
        </div>
        <div className="admin-feedback-title-copy">
          <h2>User Feedback</h2>
          <p>{feedbacks.length} rating{feedbacks.length !== 1 ? 's' : ''} collected</p>
        </div>
        {avgRating && (
          <div className="admin-avg-badge">
            <span className="material-symbols-outlined">star</span>
            <span>{avgRating}</span>
            <small>avg</small>
          </div>
        )}
      </div>

      {/* Distribution bar */}
      {feedbacks.length > 0 && (
        <div className="admin-rating-dist">
          {dist.map(d => (
            <button
              key={d.stars}
              type="button"
              className={`admin-rating-row${filterRating === d.stars ? ' active' : ''}`}
              onClick={() => setFilterRating(filterRating === d.stars ? 0 : d.stars)}
              title={`Filter by ${d.stars} star${d.stars > 1 ? 's' : ''}`}
            >
              <span className="admin-rating-stars">
                {d.stars}
                <span className="material-symbols-outlined">star</span>
              </span>
              <div className="admin-rating-bar-wrap">
                <div
                  className="admin-rating-bar"
                  style={{ width: `${(d.count / feedbacks.length) * 100}%` }}
                  data-stars={d.stars}
                />
              </div>
              <span className="admin-rating-count">{d.count}</span>
            </button>
          ))}
          {filterRating !== 0 && (
            <button type="button" className="admin-filter-clear" onClick={() => setFilterRating(0)}>
              <span className="material-symbols-outlined">close</span>
              Clear filter
            </button>
          )}
        </div>
      )}

      {loading && (
        <div className="admin-feedback-empty">
          <span className="material-symbols-outlined btn-spin">progress_activity</span>
          <p>Loading feedback…</p>
        </div>
      )}

      {error && (
        <div className="admin-feedback-empty" style={{ color: '#ef4444' }}>
          <span className="material-symbols-outlined">error</span>
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && feedbacks.length === 0 && (
        <div className="admin-feedback-empty">
          <span className="material-symbols-outlined">inbox</span>
          <p>No feedback submitted yet.</p>
        </div>
      )}

      {!loading && !error && feedbacks.length > 0 && filtered.length === 0 && (
        <div className="admin-feedback-empty">
          <span className="material-symbols-outlined">filter_list_off</span>
          <p>No feedback matches the current filter.</p>
        </div>
      )}

      <div className="admin-feedback-list">
        {filtered.map(fb => (
          <article key={fb.id} className="admin-feedback-card">
            <div className="admin-feedback-card-top">
              <div className="admin-feedback-stars-row">
                {[1, 2, 3, 4, 5].map(s => (
                  <span
                    key={s}
                    className={`material-symbols-outlined admin-star ${fb.rating >= s ? 'filled' : 'empty'}`}
                  >star</span>
                ))}
                <span className="admin-feedback-rating-label">{STAR_LABELS[fb.rating]}</span>
              </div>
              <div className="admin-feedback-meta">
                {fb.ticket_number && (
                  <span className="admin-feedback-chip">
                    <span className="material-symbols-outlined">confirmation_number</span>
                    {fb.ticket_number}
                  </span>
                )}
                <span className="admin-feedback-chip">
                  <span className="material-symbols-outlined">person</span>
                  {fb.user_email}
                </span>
                <span className="admin-feedback-chip">
                  <span className="material-symbols-outlined">schedule</span>
                  {new Date(fb.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
            {fb.comment && (
              <blockquote className="admin-feedback-comment">
                <span className="material-symbols-outlined">format_quote</span>
                {fb.comment}
              </blockquote>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
