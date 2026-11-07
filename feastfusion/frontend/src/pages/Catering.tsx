import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, naira, type CateringRequest, type Pairing, type Quote } from '../lib/api'
import { STATES, areasFor } from '../lib/states'
import './Catering.css'

/** The three kinds of job a caterer takes. The deposit maths differs for each. */
const JOB_KINDS = [
  {
    value: 'event',
    label: 'Full event catering',
    blurb: 'We cook, serve and clear up at your venue.',
  },
  {
    value: 'cook_only',
    label: 'Cook only',
    blurb: 'We cook the dishes and you handle serving.',
  },
  {
    value: 'custom',
    label: 'Something else',
    blurb: 'Tell us what you need and we will price it by hand.',
  },
] as const

/** Event types the caterer has set a per-guest rate for. */
const EVENT_TYPES = [
  { value: 'birthday', label: 'Birthday party' },
  { value: 'naming', label: 'Naming ceremony' },
  { value: 'wedding', label: 'Wedding' },
  { value: 'corporate', label: 'Corporate event' },
  { value: 'burial', label: 'Burial' },
  { value: 'anniversary', label: 'Anniversary' },
] as const

/** Dish categories, matching the slugs the backend prices against. */
// Same names and same order as CATEGORIES in backend/src/catalogue.rs, so the
// catering picker always reads like the menu chips. Slugs are what the deposit
// engine keys on, so they must not change.
const DISH_CATEGORIES = [
  { slug: 'breakfast', label: 'Breakfast' },
  { slug: 'rice-grains', label: 'Rice Dishes' },
  { slug: 'soups-swallow', label: 'Soups & Stews' },
  { slug: 'swallows', label: 'Swallows' },
  { slug: 'grills', label: 'Grills' },
  { slug: 'small-chops', label: 'Small Chops' },
  { slug: 'pasta-noodles', label: 'Pasta & Noodles' },
  { slug: 'fast-food', label: 'Fast Food' },
  { slug: 'proteins', label: 'Proteins' },
  { slug: 'sides', label: 'Sides & Extras' },
  { slug: 'sauces', label: 'Sauces & Dips' },
  { slug: 'salads', label: 'Salads' },
  { slug: 'pastries', label: 'Pastries' },
  { slug: 'puddings', label: 'Puddings & Porridges' },
  { slug: 'desserts', label: 'Desserts & Sweets' },
  { slug: 'cakes', label: 'Cakes' },
  { slug: 'drinks', label: 'Drinks' },
] as const

const CONTACT_CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp', hint: 'Your WhatsApp number' },
  { value: 'phone', label: 'Phone call', hint: 'The number to call' },
  { value: 'telegram', label: 'Telegram', hint: 'Your Telegram username' },
  { value: 'snapchat', label: 'Snapchat', hint: 'Your Snapchat username' },
] as const

type JobKind = (typeof JOB_KINDS)[number]['value']
type ContactChannel = (typeof CONTACT_CHANNELS)[number]['value']

export function Catering() {
  const [jobKind, setJobKind] = useState<JobKind>('event')
  const [eventType, setEventType] = useState<string>('birthday')
  const [guestCount, setGuestCount] = useState('50')
  const [dishes, setDishes] = useState<string[]>(['rice-grains', 'grills'])
  const [otherDishes, setOtherDishes] = useState('')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [stateName, setStateName] = useState('FCT Abuja')
  const [lga, setLga] = useState('')
  const [street, setStreet] = useState('')
  const [contactChannel, setContactChannel] = useState<ContactChannel>('whatsapp')
  const [contactHandle, setContactHandle] = useState('')
  const [details, setDetails] = useState('')

  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<CateringRequest | null>(null)

  const areas = useMemo(() => areasFor(stateName), [stateName])

  // The deposit is worked out by the caterer's own rates, so we ask the server
  // rather than guessing here. Debounced so typing a guest count does not fire
  // a request on every keystroke.
  const quoteSeq = useRef(0)
  useEffect(() => {
    const guests = Number(guestCount) || 0
    const seq = ++quoteSeq.current
    setQuoting(true)

    const timer = window.setTimeout(() => {
      api
        .quote({
          job_kind: jobKind,
          event_type: jobKind === 'cook_only' ? 'cook_only' : eventType,
          guest_count: guests,
          dishes,
        })
        .then((q) => {
          if (seq === quoteSeq.current) setQuote(q)
        })
        .catch(() => {
          if (seq === quoteSeq.current) setQuote(null)
        })
        .finally(() => {
          if (seq === quoteSeq.current) setQuoting(false)
        })
    }, 350)

    return () => window.clearTimeout(timer)
  }, [jobKind, eventType, guestCount, dishes])

  function toggleDish(slug: string) {
    setDishes((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    )
  }

  // The caterer decides what goes with what in the admin page, so this list is
  // read from the server rather than written here. Nothing is hardcoded.
  const [pairings, setPairings] = useState<Pairing[]>([])
  useEffect(() => {
    api
      .pairings()
      .then(setPairings)
      .catch(() => setPairings([]))
  }, [])

  const suggestions = useMemo(() => {
    const chosen = new Set(dishes)
    const seen = new Set<string>()
    const out: { slug: string; label: string }[] = []

    for (const p of pairings) {
      if (!chosen.has(p.category_slug)) continue
      if (chosen.has(p.accompanies_slug)) continue
      if (seen.has(p.accompanies_slug)) continue
      const match = DISH_CATEGORIES.find((c) => c.slug === p.accompanies_slug)
      if (!match) continue
      seen.add(p.accompanies_slug)
      out.push({ slug: match.slug, label: match.label })
    }

    return out
  }, [pairings, dishes])

  function onStateChange(next: string) {
    setStateName(next)
    setLga('')
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const created = await api.createCatering({
        name,
        phone,
        email,
        event_date: eventDate,
        guest_count: Number(guestCount) || 0,
        event_type: jobKind === 'cook_only' ? 'cook_only' : eventType,
        location: `${street}, ${lga}, ${stateName}`,
        details: details || null,
        state: stateName,
        lga,
        street_address: street,
        dishes,
        other_dishes: otherDishes,
        contact_channel: contactChannel,
        contact_handle: contactHandle,
        job_kind: jobKind,
      })
      setDone(created)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="catering-page">
        <div className="container">
          <div className="catering-done">
            <h2>We have your request</h2>
            <p>
              Your reference is <strong>{done.reference}</strong>. A caterer will call you on{' '}
              {done.contact_channel === 'phone' ? 'the number you gave' : done.contact_channel} to
              confirm the menu and the date.
            </p>
            <p>
              Starting deposit: <strong>{naira(done.deposit_kobo)}</strong>
            </p>
            <p className="catering-form__note">{done.deposit_reason}</p>
            <Link to="/catering/agreement" className="btn btn--primary">
              Read the agreement
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const showGuests = jobKind === 'event'
  const showEventType = jobKind !== 'cook_only'

  return (
    <div className="catering-page">
      <header className="catering-page__head">
        <div className="container catering-page__head-inner">
          <div>
            <span className="eyebrow">Catering</span>
            <h1>Let us cook for your people</h1>
            <p className="lede">
              Tell us the date, the crowd and the dishes. Your starting deposit is worked out from
              the caterer's own rates, so you see the number before you commit.
            </p>
          </div>

          <aside className="catering-page__aside">
           <div className="catering-page__aside-top">
             <span className="catering-page__aside-label">Starting deposit</span>
             <strong>{quoting ? 'Working it out' : quote ? naira(quote.deposit_kobo) : 'Ask us'}</strong>
           </div>
           <p>
             {quote?.reason ??
               'Pick your event and dishes and the deposit appears here with the reason behind it.'}
           </p>
          </aside>
        </div>
      </header>

      <div className="container catering-page__body">
        <div className="catering-page__steps">
          <div className="catering-step">
            <span>1</span>
            <div>
              <h3>Tell us the job</h3>
              <p>Event catering, cook only, or something we price by hand.</p>
            </div>
          </div>
          <div className="catering-step">
            <span>2</span>
            <div>
              <h3>Pick the dishes</h3>
              <p>Choose the categories you want. Add anything unusual in the box.</p>
            </div>
          </div>
          <div className="catering-step">
            <span>3</span>
            <div>
              <h3>Say where and when</h3>
              <p>State, area and a landmark so the team can find the venue.</p>
            </div>
          </div>
          <div className="catering-step">
            <span>4</span>
            <div>
              <h3>Choose how we reach you</h3>
              <p>WhatsApp, a phone call, Telegram or Snapchat. Whichever suits you.</p>
            </div>
          </div>
        </div>

        <form className="catering-form" onSubmit={onSubmit}>
          <h2>Your request</h2>

          <div className="field">
            <label>What kind of job is it?</label>
            <div className="choices choices--stack">
              {JOB_KINDS.map((k) => (
                <label
                  key={k.value}
                  className={`choice ${jobKind === k.value ? 'is-active' : ''}`}
                >
                  <input
                    type="radio"
                    name="job_kind"
                    value={k.value}
                    checked={jobKind === k.value}
                    onChange={() => setJobKind(k.value)}
                    className="sr-only"
                  />
                  <strong>{k.label}</strong>
                  <span className="field__hint">{k.blurb}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="panel__grid">
            {showEventType && (
              <div className="field">
                <label htmlFor="event_type">What is the occasion?</label>
                <select
                  id="event_type"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {showGuests && (
              <div className="field">
                <label htmlFor="guests">How many guests?</label>
                <input
                  id="guests"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                />
                <span className="field__hint">A rough number is fine for now.</span>
              </div>
            )}

            <div className="field">
              <label htmlFor="event_date">When do you need us?</label>
              <input
                id="event_date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="field">
            <span className="field__label" id="dishes-label">
              Which dishes?
            </span>
            <ul className="dish-list" aria-labelledby="dishes-label">
              {DISH_CATEGORIES.map((c) => {
                const on = dishes.includes(c.slug);
                return (
                  <li key={c.slug}>
                    <label className={`dish-row ${on ? 'is-active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleDish(c.slug)}
                        className="sr-only"
                      />
                      <span className="dish-row__tick" aria-hidden="true">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                          <path
                            d="m5 13 4 4L19 7"
                            stroke="currentColor"
                            strokeWidth="3.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <span className="dish-row__name">{c.label}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {suggestions.length > 0 && (
              <div className="dish-suggest">
                <span className="dish-suggest__label">Goes well with</span>
                <div className="dish-suggest__chips">
                  {suggestions.map((s) => (
                    <button
                      key={s.slug}
                      type="button"
                      className="dish-suggest__chip"
                      onClick={() => toggleDish(s.slug)}
                    >
                      <span aria-hidden="true">+</span>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <span className="field__hint">Switch on as many as you need.</span>
          </div>

          <div className="field">
            <label htmlFor="other_dishes">Anything else on the menu?</label>
            <textarea
              id="other_dishes"
              rows={3}
              placeholder="e.g. pounded yam, ofada sauce, a small chops platter"
              value={otherDishes}
              onChange={(e) => setOtherDishes(e.target.value)}
            />
            <span className="field__hint">
              Optional. Write in anything that is not in the list above.
            </span>
          </div>

          <div className="panel__grid">
            <div className="field">
              <label htmlFor="state">State</label>
              <select id="state" value={stateName} onChange={(e) => onStateChange(e.target.value)}>
                {STATES.map((s) => (
                  <option key={s.state} value={s.state}>
                    {s.state}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="lga">Area or LGA</label>
              <select id="lga" value={lga} onChange={(e) => setLga(e.target.value)} required>
                <option value="">Choose an area</option>
                {areas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div className="field panel__full">
              <label htmlFor="street">Street or landmark</label>
              <input
                id="street"
                type="text"
                placeholder="e.g. 14 Aminu Kano Crescent, beside Sahad Stores"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                required
              />
              <span className="field__hint">
                A landmark helps the team find the venue on the day.
              </span>
            </div>
          </div>

          <div className="field">
            <label>How should we reach you?</label>
            <div className="choices">
              {CONTACT_CHANNELS.map((c) => (
                <label
                  key={c.value}
                  className={`choice ${contactChannel === c.value ? 'is-active' : ''}`}
                >
                  <input
                    type="radio"
                    name="contact_channel"
                    value={c.value}
                    checked={contactChannel === c.value}
                    onChange={() => setContactChannel(c.value)}
                    className="sr-only"
                  />
                  <strong>{c.label}</strong>
                </label>
              ))}
            </div>
          </div>

          <div className="panel__grid">
            <div className="field">
              <label htmlFor="contact_handle">
                {CONTACT_CHANNELS.find((c) => c.value === contactChannel)?.hint}
              </label>
              <input
                id="contact_handle"
                type="text"
                value={contactHandle}
                onChange={(e) => setContactHandle(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="name">Your name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="phone">Phone number</label>
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <span className="field__hint">Optional, for the written quote.</span>
            </div>

            <div className="field panel__full">
              <label htmlFor="details">Anything we should know?</label>
              <textarea
                id="details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Allergies, a colour theme, serving time, parking notes"
              />
            </div>
          </div>

          {quote && quote.lines.length > 0 && (
            <div className="quote-breakdown">
              <h3>How the deposit is worked out</h3>
              <ul>
                {quote.lines.map((line) => (
                  <li key={line.label}>
                    <span>{line.label}</span>
                    <span>{naira(line.amount_kobo)}</span>
                  </li>
                ))}
              </ul>
              <p className="quote-breakdown__total">
                <span>Starting deposit</span>
                <strong>{naira(quote.deposit_kobo)}</strong>
              </p>
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn btn--primary btn--lg" disabled={submitting}>
            {submitting ? 'Sending' : 'Send my request'}
          </button>

          <p className="catering-form__note">
            The deposit is non-refundable once we hold your date. Read the{' '}
            <Link to="/catering/agreement" className="catering-form__link">
              catering agreement
            </Link>{' '}
            before you send.
          </p>
        </form>
      </div>
    </div>
  )
}
