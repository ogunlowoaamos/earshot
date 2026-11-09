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

/**
 * The two services that sit under "Something else". Both are priced by hand,
 * so they only change what the caterer is told, not the deposit maths.
 */
const CUSTOM_SERVICES = [
  {
    value: 'chef_at_home',
    label: 'Chef-at-home service',
    blurb: 'A chef comes to your home to cook and prepare the meals on-site.',
  },
  {
    value: 'meal_delivery',
    label: 'Custom chef-prepared meal delivery',
    blurb:
      'The chef buys the ingredients, cooks the finished meal in their own kitchen, and delivers it to you.',
  },
] as const

/** Who is providing the food for a chef-at-home job. */
const INGREDIENT_SOURCES = [
  {
    value: 'supplied',
    label: 'Ingredients are supplied',
    blurb: 'You already have them, or you will buy them before the chef arrives.',
  },
  {
    value: 'chef_buys',
    label: 'The chef buys the ingredients',
    blurb: 'The chef shops for everything and adds the cost to your quote.',
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
type CustomService = (typeof CUSTOM_SERVICES)[number]['value']
type IngredientSource = (typeof INGREDIENT_SOURCES)[number]['value']
type ContactChannel = (typeof CONTACT_CHANNELS)[number]['value']

const ALL_STEPS = ['catering-job', 'catering-dishes', 'catering-where', 'catering-contact']

/** "2026-03-14" reads as "14 Mar 2026" in the summary. */
function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "14:30" reads as "2:30 pm" so the summary matches how people speak. */
function formatTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value
  const date = new Date(2000, 0, 1, hours, minutes)
  return date.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1))
const MINUTES = Array.from({ length: 59 }, (_, i) => String(i + 1).padStart(2, '0'))

/** Turns the three dropdowns into the "14:30" the server stores. */
function to24Hour(hour: string, minute: string, meridiem: string) {
  if (!hour || !minute || !meridiem) return ''
  const h = Number(hour) % 12 + (meridiem === 'pm' ? 12 : 0)
  return `${String(h).padStart(2, '0')}:${minute}`
}

export function Catering() {
  const [jobKind, setJobKind] = useState<JobKind>('event')
  const [customService, setCustomService] = useState<CustomService | ''>('')
  const [ingredientSource, setIngredientSource] = useState<IngredientSource | ''>('')
  const [eventType, setEventType] = useState<string>('birthday')
  const [guestCount, setGuestCount] = useState('50')
  const [dishes, setDishes] = useState<string[]>(['rice-grains', 'grills'])
  const [otherDishes, setOtherDishes] = useState('')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [eventDate, setEventDate] = useState('')
  // The time is picked as three short dropdowns instead of the browser's
  // spinner, which scrolls forever and is hard to use on a phone.
  const [timeHour, setTimeHour] = useState('')
  const [timeMinute, setTimeMinute] = useState('')
  const [timeMeridiem, setTimeMeridiem] = useState<'am' | 'pm'>('am')
  const [stateName, setStateName] = useState('FCT Abuja')
  const [lga, setLga] = useState('')
  const [street, setStreet] = useState('')
  const [contactChannel, setContactChannel] = useState<ContactChannel>('whatsapp')
  const [contactHandle, setContactHandle] = useState('')
  const [details, setDetails] = useState('')

  const [quote, setQuote] = useState<Quote | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<CateringRequest | null>(null)

  // Only one card is open at a time so the page stays short.
  const [openSteps, setOpenSteps] = useState<string[]>(['catering-job'])
  const formRef = useRef<HTMLFormElement>(null)

  function goToStep(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function toggleStep(id: string) {
    const willOpen = !openSteps.includes(id)
    setOpenSteps(willOpen ? [id] : [])
    if (willOpen) requestAnimationFrame(() => goToStep(id))
  }

  // Closed cards hide their fields, so open them all before the browser
  // checks the form. requestAnimationFrame waits for React to paint first.
  function submitAll() {
    setOpenSteps(ALL_STEPS)
    requestAnimationFrame(() => formRef.current?.requestSubmit())
  }

  const areas = useMemo(() => areasFor(stateName), [stateName])

  // The deposit is worked out by the caterer's own rates, so we ask the server
  // rather than guessing here. Debounced so typing a guest count does not fire
  // a request on every keystroke.
  const quoteSeq = useRef(0)
  useEffect(() => {
    const guests = Number(guestCount) || 0
    const seq = ++quoteSeq.current

    const timer = window.setTimeout(() => {
      api
        .quote({
          job_kind: jobKind,
          event_type: eventType,
          guest_count: guests,
          dishes,
        })
        .then((q) => {
          if (seq === quoteSeq.current) setQuote(q)
        })
        .catch(() => {
          if (seq === quoteSeq.current) setQuote(null)
        })
    }, 350)

    return () => window.clearTimeout(timer)
  }, [jobKind, eventType, guestCount, dishes])

  function toggleDish(slug: string) {
    setDishes((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    )
  }

  /** Leaving "Something else" drops the two follow-up answers with it. */
  function pickJobKind(next: JobKind) {
    setJobKind(next)
    if (next !== 'custom') {
      setCustomService('')
      setIngredientSource('')
    }
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
    // The backend only knows the three job kinds, so the "Something else"
    // follow-up answers travel in the notes where the caterer will read them.
    const serviceNote = [
      customServiceLabel && `Service: ${customServiceLabel}.`,
      ingredientSourceLabel && `Food: ${ingredientSourceLabel}.`,
    ]
      .filter(Boolean)
      .join(' ')
    const fullDetails = [serviceNote, details.trim()].filter(Boolean).join('\n\n') || null
    try {
      const created = await api.createCatering({
        name,
        phone,
        email,
        event_date: eventDate,
        event_time: eventTime,
        guest_count: Number(guestCount) || 0,
        event_type: eventType,
        location: `${street}, ${lga}, ${stateName}`,
        details: fullDetails,
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

  const jobKindLabel = JOB_KINDS.find((k) => k.value === jobKind)?.label ?? jobKind
  const customServiceLabel =
    CUSTOM_SERVICES.find((s) => s.value === customService)?.label ?? ''
  const ingredientSourceLabel =
    INGREDIENT_SOURCES.find((i) => i.value === ingredientSource)?.label ?? ''
  const eventTypeLabel = EVENT_TYPES.find((t) => t.value === eventType)?.label ?? eventType
  const dishLabels = dishes.map(
    (slug) => DISH_CATEGORIES.find((c) => c.slug === slug)?.label ?? slug,
  )
  const venueLine =
    [street, lga, stateName].filter((part) => part.trim()).join(', ') || 'Not given yet'
  const contactLine = contactHandle.trim()
    ? `${CONTACT_CHANNELS.find((c) => c.value === contactChannel)?.label ?? contactChannel} · ${contactHandle.trim()}`
    : 'Not given yet'
  const eventTime = to24Hour(timeHour, timeMinute, timeMeridiem)

  return (
    <div className="catering-page">
      <header className="catering-page__head">
        <div className="container catering-page__head-inner">
          <span className="eyebrow">Catering</span>
          <h1>Let us cook for your people</h1>
          <p className="lede">
            Tell us the date, the crowd and the dishes. Your starting deposit is worked out from
            the caterer's own rates, so you see the number before you commit.
          </p>
        </div>
      </header>

      <form className="container catering-page__body" onSubmit={onSubmit} ref={formRef}>
        <div className="catering-page__rail">
          <div className="catering-page__steps">
            <section className="catering-step" id="catering-job">
              <button
                type="button"
                className="catering-step__head"
                onClick={() => toggleStep('catering-job')}
                aria-expanded={openSteps.includes('catering-job')}
                aria-controls="catering-job-card"
              >
                <span className="catering-step__num">1</span>
                <h3>Tell us the job</h3>
                <span className="catering-step__chev" aria-hidden="true" />
              </button>
              <div
                id="catering-job-card"
                className={`catering-step__card${openSteps.includes('catering-job') ? '' : ' is-closed'}`}
              >
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
                          onChange={() => pickJobKind(k.value)}
                          className="sr-only"
                        />
                        <strong>{k.label}</strong>
                        <span className="field__hint">{k.blurb}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="catering-subchoices catering-dark">
                  {jobKind === 'custom' && (
                    <>
                      <div className="catering-subchoices__head">
                        <p className="catering-subchoices__label">Which service do you need?</p>
                        {!customService && (
                          <span className="catering-subchoices__flag">Needs your answer</span>
                            )}
                          </div>
                          <div className="catering-toggles">
                            {CUSTOM_SERVICES.map((s) => {
                              const on = customService === s.value
                              return (
                                <button
                                  key={s.value}
                                  type="button"
                                  className={`catering-toggle${on ? ' is-on' : ''}`}
                                  aria-pressed={on}
                                  onClick={() => {
                                    setCustomService(s.value)
                                    if (s.value !== 'chef_at_home') setIngredientSource('')
                                  }}
                                >
                                  <span className="catering-toggle__tick" aria-hidden="true">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                                      <path
                                        d="M4 12.5 9.5 18 20 6.5"
                                        stroke="currentColor"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  </span>
                                  <span className="catering-toggle__text">
                                    <strong>{s.label}</strong>
                                    <span>{s.blurb}</span>
                                  </span>
                                </button>
                              )
                            })}
                          </div>

                          {customService === 'chef_at_home' && (
                            <div className="catering-subchoices__nested">
                              <div className="catering-subchoices__head">
                                <p className="catering-subchoices__label">
                                  Who is providing the food?
                                </p>
                                {!ingredientSource && (
                                  <span className="catering-subchoices__flag">
                                    Needs your answer
                                  </span>
                                )}
                              </div>
                              <div className="catering-toggles">
                                {INGREDIENT_SOURCES.map((i) => {
                                  const on = ingredientSource === i.value
                                  return (
                                    <button
                                      key={i.value}
                                      type="button"
                                      className={`catering-toggle${on ? ' is-on' : ''}`}
                                      aria-pressed={on}
                                      onClick={() => setIngredientSource(i.value)}
                                    >
                                      <span className="catering-toggle__tick" aria-hidden="true">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                                          <path
                                            d="M4 12.5 9.5 18 20 6.5"
                                            stroke="currentColor"
                                            strokeWidth="3"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                      </span>
                                      <span className="catering-toggle__text">
                                        <strong>{i.label}</strong>
                                        <span>{i.blurb}</span>
                                      </span>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </>
                  )}

                  <div className="panel__grid">
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

                    <div className="field">
                      <label htmlFor="event_time_hour">What time?</label>
                      <div className="time-pick">
                        <select
                          id="event_time_hour"
                          aria-label="Hour"
                          value={timeHour}
                          onChange={(e) => setTimeHour(e.target.value)}
                          required
                        >
                          <option value="">Hour</option>
                          {HOURS.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                        <select
                          id="event_time_minute"
                          aria-label="Minutes"
                          value={timeMinute}
                          onChange={(e) => setTimeMinute(e.target.value)}
                          required
                        >
                          <option value="">Min</option>
                          {MINUTES.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <select
                          id="event_time_meridiem"
                          aria-label="am or pm"
                          value={timeMeridiem}
                          onChange={(e) => setTimeMeridiem(e.target.value as 'am' | 'pm')}
                        >
                          <option value="am">am</option>
                          <option value="pm">pm</option>
                        </select>
                      </div>
                      <span className="field__hint">The time the food should be ready.</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="catering-step" id="catering-dishes">
              <button
                type="button"
                className="catering-step__head"
                onClick={() => toggleStep('catering-dishes')}
                aria-expanded={openSteps.includes('catering-dishes')}
                aria-controls="catering-dishes-card"
              >
                <span className="catering-step__num">2</span>
                <h3>Pick the dishes</h3>
                <span className="catering-step__chev" aria-hidden="true" />
              </button>
              <div
                id="catering-dishes-card"
                className={`catering-step__card catering-dark${openSteps.includes('catering-dishes') ? '' : ' is-closed'}`}
              >
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
              </div>
            </section>

            <section className="catering-step" id="catering-where">
              <button
                type="button"
                className="catering-step__head"
                onClick={() => toggleStep('catering-where')}
                aria-expanded={openSteps.includes('catering-where')}
                aria-controls="catering-where-card"
              >
                <span className="catering-step__num">3</span>
                <h3>Say where and when</h3>
                <span className="catering-step__chev" aria-hidden="true" />
              </button>
              <div
                id="catering-where-card"
                className={`catering-step__card catering-dark${openSteps.includes('catering-where') ? '' : ' is-closed'}`}
              >
                <div className="panel__grid">
                  <div className="field">
                    <label htmlFor="state">State</label>
                    <select
                      id="state"
                      value={stateName}
                      onChange={(e) => onStateChange(e.target.value)}
                    >
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
              </div>
            </section>

            <section className="catering-step" id="catering-contact">
              <button
                type="button"
                className="catering-step__head"
                onClick={() => toggleStep('catering-contact')}
                aria-expanded={openSteps.includes('catering-contact')}
                aria-controls="catering-contact-card"
              >
                <span className="catering-step__num">4</span>
                <h3>Choose how we reach you</h3>
                <span className="catering-step__chev" aria-hidden="true" />
              </button>
              <div
                id="catering-contact-card"
                className={`catering-step__card catering-dark${openSteps.includes('catering-contact') ? '' : ' is-closed'}`}
              >
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
              </div>
            </section>
          </div>
        </div>

        <div className="catering-page__side">
          <div className="catering-summary">
            <h3>Your request so far</h3>
            <dl>
              <div>
                <dt>Job</dt>
                <dd>{jobKindLabel}</dd>
              </div>
              {customServiceLabel && (
                <div>
                  <dt>Service</dt>
                  <dd>{customServiceLabel}</dd>
                </div>
              )}
              {ingredientSourceLabel && (
                <div>
                  <dt>Food</dt>
                  <dd>{ingredientSourceLabel}</dd>
                </div>
              )}
              <div>
                <dt>Occasion</dt>
                <dd>{eventTypeLabel}</dd>
              </div>
              <div>
                <dt>Guests</dt>
                <dd>{guestCount ? `${guestCount} people` : 'Not given yet'}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{eventDate ? formatDate(eventDate) : 'Not given yet'}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>{eventTime ? formatTime(eventTime) : 'Not given yet'}</dd>
              </div>
              <div>
                <dt>Dishes</dt>
                <dd>{dishLabels.length > 0 ? dishLabels.join(', ') : 'None picked yet'}</dd>
              </div>
              {otherDishes.trim() && (
                <div>
                  <dt>Also</dt>
                  <dd>{otherDishes.trim()}</dd>
                </div>
              )}
              <div>
                <dt>Venue</dt>
                <dd>{venueLine}</dd>
              </div>
              <div>
                <dt>Reach you</dt>
                <dd>{contactLine}</dd>
              </div>
              {details.trim() && (
                <div>
                  <dt>Notes</dt>
                  <dd>{details.trim()}</dd>
                </div>
              )}
            </dl>
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
              {quote.reason && <p className="quote-breakdown__reason">{quote.reason}</p>}
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={submitAll}
            disabled={submitting}
          >
            {submitting ? 'Sending' : 'Send my request'}
          </button>

          <p className="catering-form__note">
            The deposit is non-refundable once we hold your date. Read the{' '}
            <Link to="/catering/agreement" className="catering-form__link">
              catering agreement
            </Link>{' '}
            before you send.
          </p>
        </div>
      </form>
    </div>
  )
}
