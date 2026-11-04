import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, naira, type Settings } from '../lib/api'
import { useEffect } from 'react'
import './Catering.css'

export function Catering() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    event_date: '',
    guest_count: '',
    event_type: 'Wedding',
    location: '',
    budget: '',
    details: '',
  })

  useEffect(() => {
    api.settings().then(setSettings).catch(() => undefined)
  }, [])

  function update(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await api.createCatering({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        event_date: form.event_date,
        guest_count: Number(form.guest_count),
        event_type: form.event_type,
        location: form.location.trim(),
        budget_kobo: form.budget ? Math.round(Number(form.budget) * 100) : null,
        details: form.details.trim() || null,
      })
      setSent(res.reference)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="catering-page">
      <header className="catering-page__head">
        <div className="container catering-page__head-inner">
          <div>
            <span className="eyebrow">Full-service catering</span>
            <h1>Let us cook for your people.</h1>
            <p className="lede">
              Weddings, naming ceremonies, birthdays, office lunches, burials, church events. Tell
              us the date and headcount. We will send a menu and a quote within 24 hours.
            </p>
          </div>
          <div className="catering-page__aside">
            <span className="catering-page__aside-label">Starting deposit</span>
            <strong>{naira(settings?.catering_deposit_kobo ?? 10000000)}</strong>
            <p>Secures your date. Non-refundable, and deducted from your final bill.</p>
          </div>
        </div>
      </header>

      <div className="container catering-page__body">
        <div className="catering-page__steps">
          {[
            ['Tell us the details', 'Date, guests, location and the kind of food you want.'],
            ['We send a menu + quote', 'Within 24 hours, with portion guidance per guest.'],
            ['Pay the deposit', 'Your date is locked once the non-refundable deposit clears.'],
            ['We cook and serve', 'On-site cooking or delivery in chafing trays, your choice.'],
          ].map(([t, b], i) => (
            <div key={t} className="catering-step">
              <span>{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h3>{t}</h3>
                <p>{b}</p>
              </div>
            </div>
          ))}
        </div>

        {sent ? (
          <div className="catering-done">
            <div className="order-hero__icon" aria-hidden="true">
              ✓
            </div>
            <h2>Request received</h2>
            <p>
              Your reference is <strong>{sent}</strong>. We'll reach out on WhatsApp and email
              within 24 hours.
            </p>
          </div>
        ) : (
          <form className="catering-form" onSubmit={onSubmit}>
            <h2>Request a quote</h2>

            <div className="panel__grid">
              <div className="field">
                <label htmlFor="c-name">Your name</label>
                <input
                  id="c-name"
                  required
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="c-phone">Phone</label>
                <input
                  id="c-phone"
                  required
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                />
              </div>
              <div className="field panel__full">
                <label htmlFor="c-email">Email</label>
                <input
                  id="c-email"
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="c-date">Event date</label>
                <input
                  id="c-date"
                  required
                  type="date"
                  value={form.event_date}
                  onChange={(e) => update('event_date', e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="c-guests">Guests</label>
                <input
                  id="c-guests"
                  required
                  type="number"
                  min={10}
                  value={form.guest_count}
                  onChange={(e) => update('guest_count', e.target.value)}
                  placeholder="120"
                />
              </div>
              <div className="field">
                <label htmlFor="c-type">Event type</label>
                <select
                  id="c-type"
                  value={form.event_type}
                  onChange={(e) => update('event_type', e.target.value)}
                >
                  {['Wedding', 'Naming ceremony', 'Birthday', 'Corporate lunch', 'Church event', 'Burial', 'Other'].map(
                    (t) => (
                      <option key={t}>{t}</option>
                    ),
                  )}
                </select>
              </div>
              <div className="field">
                <label htmlFor="c-budget">Budget (₦, optional)</label>
                <input
                  id="c-budget"
                  type="number"
                  min={0}
                  value={form.budget}
                  onChange={(e) => update('budget', e.target.value)}
                  placeholder="500000"
                />
              </div>
              <div className="field panel__full">
                <label htmlFor="c-location">Event location</label>
                <input
                  id="c-location"
                  required
                  value={form.location}
                  onChange={(e) => update('location', e.target.value)}
                  placeholder="Venue name, area, city"
                />
              </div>
              <div className="field panel__full">
                <label htmlFor="c-details">What are you thinking?</label>
                <textarea
                  id="c-details"
                  value={form.details}
                  onChange={(e) => update('details', e.target.value)}
                  placeholder="Jollof rice, fried rice, peppered chicken, small chops, zobo…"
                />
              </div>
            </div>

            {error && <p className="form-error">{error}</p>}

            <button className="btn btn--primary btn--lg" type="submit" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send request'}
            </button>

            <p className="catering-form__note">
              Deposits are non-refundable. Final headcount is due 5 days before the event.{' '}
              <Link to="/catering/agreement" className="catering-form__link">
                Read the full agreement
              </Link>
              .
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
