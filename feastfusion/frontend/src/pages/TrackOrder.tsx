import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, naira, type Order } from '../lib/api'
import './StaticPages.css'

export function TrackOrder() {
  const [ref, setRef] = useState('')
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOrder(null)
    setLoading(true)
    try {
      const found = await api.getOrder(ref.trim().toUpperCase())
      setOrder(found)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const stages = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'completed']
  const activeIndex = order ? Math.max(0, stages.indexOf(order.status)) : -1

  return (
    <div className="static-page">
      <header className="static-page__head static-page__head--compact">
        <div className="container">
          <span className="eyebrow">Order status</span>
          <h1>Where's my food?</h1>
          <p className="lede">Enter the reference number we sent you to see live status.</p>
        </div>
      </header>

      <div className="container static-page__body">
        <form className="track-form" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="ref">Order reference</label>
            <input
              id="ref"
              required
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="FF-AB12CD"
              autoComplete="off"
            />
          </div>
          <button className="btn btn--primary" type="submit" disabled={loading}>
            {loading ? 'Looking…' : 'Track'}
          </button>
        </form>

        {error && <p className="form-error">{error}</p>}

        {order && (
          <div className="track-result">
            <div className="track-result__head">
              <div>
                <span className="track-result__label">Reference</span>
                <strong>{order.reference}</strong>
              </div>
              <div>
                <span className="track-result__label">Total</span>
                <strong>{naira(order.total_kobo)}</strong>
              </div>
            </div>

            <ol className="track-steps">
              {stages.map((s, i) => (
                <li key={s} className={i <= activeIndex ? 'is-done' : ''}>
                  <span className="track-steps__dot" />
                  <span className="track-steps__label">{s.replace(/_/g, ' ')}</span>
                </li>
              ))}
            </ol>

            <p className="track-result__note">
              Placed {new Date(order.created_at).toLocaleString('en-NG')} ·{' '}
              {order.order_type === 'delivery' ? 'Delivery' : 'Pickup'}
            </p>

            <Link to={`/order/${order.reference}`} className="btn btn--ghost">
              View full order
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
