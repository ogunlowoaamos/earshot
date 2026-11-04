import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, naira, type OrderType, type PaymentMethod, type Settings, type DeliveryZone } from '../lib/api'
import { useCart } from '../lib/cart'
import './Checkout.css'

export function Checkout() {
  const { lines, subtotalKobo, clear, count } = useCart()
  const navigate = useNavigate()

  const [settings, setSettings] = useState<Settings | null>(null)
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [deliveryState, setDeliveryState] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    delivery_address: '',
    notes: '',
  })
  const [orderType, setOrderType] = useState<OrderType>('delivery')
  const [payment, setPayment] = useState<PaymentMethod>('transfer')

  useEffect(() => {
    api.settings().then(setSettings).catch(() => undefined)
    api
      .zones()
      .then((list) => {
        setZones(list)
        setDeliveryState((current) => current || list.find((z) => z.is_active)?.state || '')
      })
      .catch(() => undefined)
  }, [])

  const liveZones = zones.filter((z) => z.is_active)
  const selectedZone = zones.find((z) => z.state === deliveryState) ?? null
  const zoneFee =
    selectedZone?.is_active ? selectedZone.fee_kobo : (settings?.delivery_fee_kobo ?? 200000)

  const deliveryFee = orderType === 'delivery' ? zoneFee : 0
  const total = subtotalKobo + deliveryFee
  const fromFee = liveZones.length
    ? Math.min(...liveZones.map((z) => z.fee_kobo))
    : (settings?.delivery_fee_kobo ?? 200000)

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (count === 0) {
      setError('Your basket is empty.')
      return
    }
    if (orderType === 'delivery' && !selectedZone?.is_active) {
      setError('Please choose the state we are delivering to.')
      return
    }
    if (orderType === 'delivery' && form.delivery_address.trim().length < 8) {
      setError('Please enter a full delivery address.')
      return
    }

    setSubmitting(true)
    try {
      const order = await api.createOrder({
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        customer_email: form.customer_email.trim(),
        order_type: orderType,
        delivery_address: orderType === 'delivery' ? form.delivery_address.trim() : null,
        delivery_state: orderType === 'delivery' ? deliveryState : null,
        notes: form.notes.trim() || null,
        payment_method: payment,
        items: lines.map((l) => ({ menu_item_id: l.item.id, qty: l.qty })),
      })
      clear()
      navigate(`/order/${order.reference}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (count === 0) {
    return (
      <div className="container checkout-empty">
        <h1>Your basket is empty</h1>
        <p>Add something delicious first, then come back.</p>
        <Link to="/menu" className="btn btn--primary btn--lg">
          Browse the menu
        </Link>
      </div>
    )
  }

  return (
    <div className="checkout">
      <div className="container">
        <header className="checkout__head">
          <span className="eyebrow">Almost there</span>
          <h1>Checkout</h1>
        </header>

        <form className="checkout__grid" onSubmit={onSubmit}>
          <div className="checkout__form">
            {/* --- Contact --- */}
            <section className="panel">
              <h2>
                <span className="panel__num">1</span> Your details
              </h2>
              <div className="panel__grid">
                <div className="field">
                  <label htmlFor="name">Full name</label>
                  <input
                    id="name"
                    required
                    autoComplete="name"
                    value={form.customer_name}
                    onChange={(e) => update('customer_name', e.target.value)}
                    placeholder="Adaeze Okonkwo"
                  />
                </div>
                <div className="field">
                  <label htmlFor="phone">Phone number</label>
                  <input
                    id="phone"
                    required
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={form.customer_phone}
                    onChange={(e) => update('customer_phone', e.target.value)}
                    placeholder="0803 000 0000"
                  />
                </div>
                <div className="field panel__full">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    required
                    type="email"
                    autoComplete="email"
                    value={form.customer_email}
                    onChange={(e) => update('customer_email', e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
              </div>
            </section>

            {/* --- Fulfilment --- */}
            <section className="panel">
              <h2>
                <span className="panel__num">2</span> Delivery or pickup
              </h2>

              <div className="choices">
                <label className={`choice ${orderType === 'delivery' ? 'is-active' : ''}`}>
                  <input
                    type="radio"
                    name="orderType"
                    value="delivery"
                    checked={orderType === 'delivery'}
                    onChange={() => setOrderType('delivery')}
                  />
                  <strong>Deliver to me</strong>
                  <span>About 45 minutes · from {naira(fromFee)}</span>
                </label>
                <label className={`choice ${orderType === 'pickup' ? 'is-active' : ''}`}>
                  <input
                    type="radio"
                    name="orderType"
                    value="pickup"
                    checked={orderType === 'pickup'}
                    onChange={() => setOrderType('pickup')}
                  />
                  <strong>I'll pick it up</strong>
                  <span>Ready in ~25 min · Free</span>
                </label>
              </div>

              {orderType === 'delivery' && (
                <>
                  <div className="field" style={{ marginTop: 'var(--sp-4)' }}>
                    <label htmlFor="state">Delivery state</label>
                    <select
                      id="state"
                      required
                      value={deliveryState}
                      onChange={(e) => setDeliveryState(e.target.value)}
                    >
                      {zones.map((z) => (
                        <option key={z.id} value={z.state} disabled={!z.is_active}>
                          {z.state}
                          {z.is_active ? ` · ${naira(z.fee_kobo)}` : ' · coming soon'}
                        </option>
                      ))}
                    </select>
                    <span className="field__hint">
                      We cook in Abuja. {liveZones.length} state
                      {liveZones.length === 1 ? '' : 's'} live now, with more coming.
                    </span>
                  </div>

                  <div className="field" style={{ marginTop: 'var(--sp-4)' }}>
                    <label htmlFor="address">Delivery address</label>
                    <textarea
                      id="address"
                      required
                      autoComplete="street-address"
                      value={form.delivery_address}
                      onChange={(e) => update('delivery_address', e.target.value)}
                      placeholder="Flat 3, 12 Ademola Adetokunbo Crescent, Wuse 2, Abuja"
                    />
                  </div>
                </>
              )}

              <div className="field" style={{ marginTop: 'var(--sp-4)' }}>
                <label htmlFor="notes">Notes for the kitchen (optional)</label>
                <textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => update('notes', e.target.value)}
                  placeholder="Extra pepper on the side, no onions…"
                />
              </div>
            </section>

            {/* --- Payment --- */}
            <section className="panel">
              <h2>
                <span className="panel__num">3</span> Payment
              </h2>

              <div className="choices choices--stack">
                <label className={`choice ${payment === 'transfer' ? 'is-active' : ''}`}>
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === 'transfer'}
                    onChange={() => setPayment('transfer')}
                  />
                  <strong>Bank transfer</strong>
                  <span>Upload your receipt after ordering</span>
                </label>
                <label className={`choice ${payment === 'online' ? 'is-active' : ''}`}>
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === 'online'}
                    onChange={() => setPayment('online')}
                  />
                  <strong>Pay online</strong>
                  <span>Card via Paystack (test mode)</span>
                </label>
                <label className={`choice ${payment === 'on_delivery' ? 'is-active' : ''}`}>
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === 'on_delivery'}
                    onChange={() => setPayment('on_delivery')}
                  />
                  <strong>Pay on {orderType === 'delivery' ? 'delivery' : 'pickup'}</strong>
                  <span>Cash or transfer when it arrives</span>
                </label>
              </div>

              {payment === 'transfer' && settings && (
                <div className="bank-box">
                  <span className="bank-box__label">Transfer to</span>
                  <dl>
                    <div>
                      <dt>Bank</dt>
                      <dd>{settings.bank_name}</dd>
                    </div>
                    <div>
                      <dt>Account name</dt>
                      <dd>{settings.bank_account_name}</dd>
                    </div>
                    <div>
                      <dt>Account number</dt>
                      <dd>{settings.bank_account_number}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </section>
          </div>

          {/* --- Summary --- */}
          <aside className="checkout__summary">
            <h2>Order summary</h2>

            <ul className="summary-list">
              {lines.map((l) => (
                <li key={l.item.id}>
                  <img src={l.item.image_url} alt="" />
                  <div>
                    <strong>{l.item.name}</strong>
                    <span>
                      {l.qty} × {naira(l.item.price_kobo)}
                    </span>
                  </div>
                  <em>{naira(l.qty * l.item.price_kobo)}</em>
                </li>
              ))}
            </ul>

            <dl className="summary-totals">
              <div>
                <dt>Subtotal</dt>
                <dd>{naira(subtotalKobo)}</dd>
              </div>
              <div>
                <dt>
                  {orderType === 'delivery'
                    ? deliveryState
                      ? `Delivery · ${deliveryState}`
                      : 'Delivery'
                    : 'Pickup'}
                </dt>
                <dd>{deliveryFee === 0 ? 'Free' : naira(deliveryFee)}</dd>
              </div>
              <div className="summary-totals__grand">
                <dt>Total</dt>
                <dd>{naira(total)}</dd>
              </div>
            </dl>

            {error && <p className="form-error">{error}</p>}

            <button className="btn btn--primary btn--lg" type="submit" disabled={submitting}>
              {submitting ? 'Placing order…' : `Place order · ${naira(total)}`}
            </button>

            <p className="summary-note">
              By ordering you agree that catering deposits are non-refundable. We'll message you on
              WhatsApp to confirm.
            </p>
          </aside>
        </form>
      </div>
    </div>
  )
}
