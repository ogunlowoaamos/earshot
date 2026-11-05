import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, naira, type Order } from '../lib/api'
import './OrderConfirmation.css'

export function OrderConfirmation() {
  const { reference } = useParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!reference) return
    let alive = true
    api
      .getOrder(reference)
      .then((o) => alive && setOrder(o))
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [reference])

  async function onUpload(file: File) {
    if (!reference) return
    setUploading(true)
    setUploadMsg(null)
    try {
      const updated = await api.uploadProof(reference, file)
      setOrder(updated)
      setUploadMsg('Receipt received. We will confirm shortly.')
    } catch (e) {
      setUploadMsg((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="container order-page">
        <div className="skeleton-card" style={{ height: 320, borderRadius: 16 }} />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="container checkout-empty">
        <h1>Order not found</h1>
        <p>{error ?? 'Check your reference number and try again.'}</p>
        <Link to="/track" className="btn btn--primary">
          Track an order
        </Link>
      </div>
    )
  }

  const needsProof = order.payment_method === 'transfer' && !order.proof_url

  return (
    <div className="order-page">
      <div className="container">
        <div className="order-hero">
          <div className="order-hero__icon" aria-hidden="true">
            ✓
          </div>
          <h1>Order received</h1>
          <p>
            Thanks {order.customer_name.split(' ')[0]}. The kitchen has your order and will start
            cooking shortly.
          </p>
          <div className="order-ref">
            <span>Reference</span>
            <strong>{order.reference}</strong>
          </div>
        </div>

        <div className="order-grid">
          <section className="order-card">
            <h2>What you ordered</h2>
            <ul className="order-items">
              {order.items.map((it, i) => (
                <li key={i}>
                  <span>
                    {it.qty} × {it.name}
                  </span>
                  <em>{naira(it.qty * it.unit_price_kobo)}</em>
                </li>
              ))}
            </ul>
            <dl className="order-totals">
              <div>
                <dt>Subtotal</dt>
                <dd>{naira(order.subtotal_kobo)}</dd>
              </div>
              <div>
                <dt>Delivery</dt>
                <dd>{order.delivery_fee_kobo === 0 ? 'Free' : naira(order.delivery_fee_kobo)}</dd>
              </div>
              <div className="order-totals__grand">
                <dt>Total</dt>
                <dd>{naira(order.total_kobo)}</dd>
              </div>
            </dl>
          </section>

          <section className="order-card">
            <h2>Details</h2>
            <dl className="order-details">
              <div>
                <dt>Method</dt>
                <dd>{order.order_type === 'delivery' ? 'Delivery' : 'Pickup'}</dd>
              </div>
              {order.delivery_address && (
                <div>
                  <dt>Address</dt>
                  <dd>{order.delivery_address}</dd>
                </div>
              )}
              <div>
                <dt>Phone</dt>
                <dd>{order.customer_phone}</dd>
              </div>
              <div>
                <dt>Payment</dt>
                <dd>
                  {order.payment_method === 'transfer'
                    ? 'Bank transfer'
                    : order.payment_method === 'online'
                      ? 'Online (card)'
                      : 'On delivery'}{' '}
                  · {order.payment_status}
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <span className="status-pill">{order.status}</span>
                </dd>
              </div>
            </dl>

            {needsProof && (
              <div className="proof-box">
                <h3>Upload your transfer receipt</h3>
                <p>Snap or select a screenshot of your transfer so we can confirm payment.</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) onUpload(f)
                  }}
                />
                <button
                  className="btn btn--gold"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? 'Uploading…' : 'Choose receipt'}
                </button>
              </div>
            )}

            {order.proof_url && <p className="proof-ok">Receipt uploaded ✓</p>}
            {uploadMsg && <p className="proof-msg">{uploadMsg}</p>}
          </section>
        </div>

        <div className="order-next">
          <Link to="/track" className="btn btn--ghost">
            Track this order
          </Link>
          <Link to="/menu" className="btn btn--primary">
            Order something else
          </Link>
        </div>
      </div>
    </div>
  )
}
