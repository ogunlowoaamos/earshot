import { useEffect, useState } from 'react'
import { api, naira, type Category, type CateringPricing, type CateringRequest, type MenuItem, type Order } from '../lib/api'
import './Admin.css'

type Tab = 'orders' | 'menu' | 'catering' | 'pricing'

const TOKEN_KEY = 'feastfusion.admin.token'

export function Admin() {
  const [token, setToken] = useState<string | null>(localStorage.getItem(TOKEN_KEY))
  const [tab, setTab] = useState<Tab>('orders')

  if (!token) {
    return <Login onDone={setToken} />
  }

  return (
    <div className="admin">
      <div className="container">
        <header className="admin__head">
          <div>
            <span className="eyebrow">Staff area</span>
            <h1>Kitchen dashboard</h1>
          </div>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => {
              localStorage.removeItem(TOKEN_KEY)
              setToken(null)
            }}
          >
            Sign out
          </button>
        </header>

        <nav className="admin-tabs" role="tablist">
          {(['orders', 'menu', 'catering', 'pricing'] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`admin-tab ${tab === t ? 'is-active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'orders'
                ? 'Orders'
                : t === 'menu'
                  ? 'Menu items'
                  : t === 'catering'
                    ? 'Catering requests'
                    : 'Deposit calculator'}
            </button>
          ))}
        </nav>

        {tab === 'orders' && <OrdersPanel token={token} />}
        {tab === 'menu' && <MenuPanel token={token} />}
        {tab === 'catering' && <CateringPanel token={token} />}
        {tab === 'pricing' && <PricingPanel token={token} />}
      </div>
    </div>
  )
}

/* ---------------- login ---------------- */

function Login({ onDone }: { onDone: (t: string) => void }) {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await api.adminLogin(username, password)
      localStorage.setItem(TOKEN_KEY, res.token)
      onDone(res.token)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-login">
      <form className="admin-login__card" onSubmit={submit}>
        <span className="eyebrow">Staff only</span>
        <h1>Sign in</h1>
        <p>Manage orders, menu and catering requests.</p>

        <div className="field">
          <label htmlFor="u">Username</label>
          <input id="u" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="p">Password</label>
          <input
            id="p"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <button className="btn btn--primary" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="admin-login__hint">Default: admin / feastfusion123</p>
      </form>
    </div>
  )
}

/* ---------------- orders ---------------- */

function OrdersPanel({ token }: { token: string }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    api
      .adminOrders(token)
      .then(setOrders)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [token])

  async function patch(id: number, body: Record<string, unknown>) {
    try {
      const updated = await api.adminUpdateOrder(token, id, body)
      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (loading) return <p className="admin-loading">Loading orders…</p>
  if (error) return <p className="form-error">{error}</p>
  if (orders.length === 0) return <p className="admin-loading">No orders yet.</p>

  return (
    <div className="admin-orders">
      <div className="admin-orders__bar">
        <span>{orders.length} orders</span>
        <button className="btn btn--ghost btn--sm" onClick={load}>
          Refresh
        </button>
      </div>

      {orders.map((o) => (
        <article key={o.id} className="admin-order">
          <div className="admin-order__top">
            <div>
              <strong>{o.reference}</strong>
              <span>{new Date(o.created_at).toLocaleString('en-NG')}</span>
            </div>
            <div className="admin-order__total">{naira(o.total_kobo)}</div>
          </div>

          <div className="admin-order__grid">
            <div>
              <span className="admin-label">Customer</span>
              <p>
                {o.customer_name}
                <br />
                {o.customer_phone}
                <br />
                {o.customer_email}
              </p>
            </div>
            <div>
              <span className="admin-label">
                {o.order_type === 'delivery' ? 'Delivery to' : 'Pickup'}
              </span>
              <p>{o.delivery_address ?? 'Kitchen pickup, Wuse 2, Abuja'}</p>
              {o.notes && <p className="admin-order__notes">Note: {o.notes}</p>}
            </div>
            <div>
              <span className="admin-label">Items</span>
              <ul>
                {o.items.map((it, i) => (
                  <li key={i}>
                    {it.qty} × {it.name}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <span className="admin-label">Payment</span>
              <p>{o.payment_method.replace(/_/g, ' ')}</p>
              <div className="admin-order__pays">
                <select
                  value={o.payment_status}
                  onChange={(e) => patch(o.id, { payment_status: e.target.value })}
                >
                  {['unpaid', 'pending', 'paid', 'refunded'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {o.proof_url && (
                  <a href={o.proof_url} target="_blank" rel="noreferrer">
                    View proof
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="admin-order__actions">
            <span className="admin-label">Status</span>
            <div className="admin-status-row">
              {['pending', 'confirmed', 'preparing', 'out_for_delivery', 'completed', 'cancelled'].map(
                (s) => (
                  <button
                    key={s}
                    className={`status-btn ${o.status === s ? 'is-active' : ''}`}
                    onClick={() => patch(o.id, { status: s })}
                  >
                    {s.replace(/_/g, ' ')}
                  </button>
                ),
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

/* ---------------- menu ---------------- */

function MenuPanel({ token }: { token: string }) {
  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  function load() {
    setLoading(true)
    api
      .menu()
      .then(setItems)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  useEffect(() => {
    api
      .categories()
      .then(setCategories)
      .catch(() => {
        /* the form falls back to the first category it receives */
      })
  }, [])

  async function toggle(item: MenuItem) {
    try {
      const updated = await api.adminUpdateItem(token, item.id, {
        is_available: !item.is_available,
      })
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function remove(item: MenuItem) {
    if (!confirm(`Delete "${item.name}"?`)) return
    try {
      await api.adminDeleteItem(token, item.id)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="admin-menu">
      <div className="admin-orders__bar">
        <span>{items.length} items</span>
        <button className="btn btn--primary btn--sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Add item'}
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      {showForm && (
        <NewItemForm
          token={token}
          categories={categories}
          onCreated={(item) => {
            setItems((prev) => [...prev, item])
            setShowForm(false)
          }}
        />
      )}

      {loading ? (
        <p className="admin-loading">Loading menu…</p>
      ) : (
        <div className="admin-menu__list">
          {items.map((it) => (
            <div key={it.id} className="admin-menu__row">
              <img src={it.image_url} alt="" />
              <div className="admin-menu__info">
                <strong>{it.name}</strong>
                <span>
                  {it.category_slug} · {naira(it.price_kobo)}
                </span>
              </div>
              <div className="admin-menu__actions">
                <button
                  className={`status-btn ${it.is_available ? 'is-active' : ''}`}
                  onClick={() => toggle(it)}
                >
                  {it.is_available ? 'available' : 'hidden'}
                </button>
                <button className="admin-menu__del" onClick={() => remove(it)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NewItemForm({
  token,
  categories,
  onCreated,
}: {
  token: string
  categories: Category[]
  onCreated: (item: MenuItem) => void
}) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    category_slug: categories[0]?.slug ?? '',
    image_url: '',
    tags: '',
    ingredients: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const item = await api.adminCreateItem(token, {
        name: form.name.trim(),
        description: form.description.trim(),
        price_kobo: Math.round(Number(form.price) * 100),
        category_slug: form.category_slug,
        image_url: form.image_url.trim(),
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        is_available: true,
        is_featured: false,
        ingredients: form.ingredients
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      })
      onCreated(item)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="admin-new" onSubmit={submit}>
      <div className="panel__grid">
        <div className="field">
          <label>Name</label>
          <input required value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="field">
          <label>Price (₦)</label>
          <input
            required
            type="number"
            min={0}
            value={form.price}
            onChange={(e) => set('price', e.target.value)}
          />
        </div>
        <div className="field">
          <label>Category</label>
          <select value={form.category_slug} onChange={(e) => set('category_slug', e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Tags (comma separated)</label>
          <input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="spicy, popular" />
        </div>
        <div className="field panel__full">
          <label>Image URL</label>
          <input
            required
            value={form.image_url}
            onChange={(e) => set('image_url', e.target.value)}
            placeholder="https://…"
          />
        </div>
        <div className="field panel__full">
          <label>Description</label>
          <textarea
            required
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </div>
        <div className="field panel__full">
          <label>Ingredients (one per line)</label>
          <textarea
            value={form.ingredients}
            onChange={(e) => set('ingredients', e.target.value)}
            placeholder={'Long grain rice\nTomato and pepper base\nChicken stock'}
          />
          <span className="field__hint">
            Customers see this when they open the dish. Leave it blank if you would rather not list
            them.
          </span>
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
      <button className="btn btn--primary" type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save item'}
      </button>
    </form>
  )
}

/* ---------------- catering ---------------- */

function CateringPanel({ token }: { token: string }) {
  const [requests, setRequests] = useState<CateringRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .adminCatering(token)
      .then(setRequests)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return <p className="admin-loading">Loading requests…</p>
  if (error) return <p className="form-error">{error}</p>
  if (requests.length === 0) return <p className="admin-loading">No catering requests yet.</p>

  return (
    <div className="admin-catering">
      {requests.map((r) => (
        <article key={r.id} className="admin-order">
          <div className="admin-order__top">
            <div>
              <strong>{r.reference}</strong>
              <span>{r.event_type} · {new Date(r.event_date).toLocaleDateString('en-NG')}</span>
            </div>
            <div className="admin-order__total">{r.guest_count} guests</div>
          </div>
          <div className="admin-order__grid">
            <div>
              <span className="admin-label">Client</span>
              <p>
                {r.name}
                <br />
                {r.phone}
                <br />
                {r.email}
              </p>
            </div>
            <div>
              <span className="admin-label">Location</span>
              <p>{r.location}</p>
            </div>
            <div>
              <span className="admin-label">Budget</span>
              <p>{r.budget_kobo ? naira(r.budget_kobo) : 'Not stated'}</p>
            </div>
            <div>
              <span className="admin-label">Notes</span>
              <p>{r.details ?? '-'}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

/* ---------------- deposit calculator ---------------- */

const EVENT_LABELS: Record<string, string> = {
  birthday: 'Birthday party',
  naming: 'Naming ceremony',
  wedding: 'Wedding',
  corporate: 'Corporate event',
  burial: 'Burial',
  anniversary: 'Anniversary',
}

const CATEGORY_LABELS: Record<string, string> = {
  'rice-grains': 'Rice and grains',
  'soups-swallow': 'Soups and swallow',
  grills: 'Grills',
  'small-chops': 'Small chops',
  breakfast: 'Breakfast',
  desserts: 'Desserts',
  drinks: 'Drinks',
}

function PricingPanel({ token }: { token: string }) {
  const [pricing, setPricing] = useState<CateringPricing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  function load() {
    setLoading(true)
    api
      .adminPricing(token)
      .then(setPricing)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [token])

  async function save(kind: string, key: string, nairaValue: string, note: string) {
    const amount = Math.round(Number(nairaValue) * 100)
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Enter a valid amount in naira.')
      return
    }
    setSaving(`${kind}:${key}`)
    setError(null)
    try {
      const next = await api.adminSaveRate(token, kind, {
        key,
        amount_kobo: amount,
        note,
      })
      setPricing(next)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <p className="admin-empty">Loading your rates</p>
  if (!pricing) return <p className="admin-empty">{error ?? 'Could not load your rates.'}</p>

  return (
    <div className="pricing-panel">
      <p className="pricing-panel__intro">
        These numbers decide the starting deposit a customer sees. Change a rate and the form
        updates straight away. The note is shown to the customer as the reason.
      </p>

      {error && <p className="form-error">{error}</p>}

      <section className="pricing-group">
        <h2>Per guest, by occasion</h2>
        <p className="pricing-group__hint">
          Used when you cater a full event. The deposit is this rate multiplied by the guest count.
        </p>
        {pricing.rates
          .filter((r) => r.event_type !== 'cook_only')
          .map((r) => (
            <RateRow
              key={r.event_type}
              label={EVENT_LABELS[r.event_type] ?? r.event_type}
              amountKobo={r.rate_kobo}
              note={r.note}
              busy={saving === `event:${r.event_type}`}
              onSave={(amount, note) => save('event', r.event_type, amount, note)}
            />
          ))}
      </section>

      <section className="pricing-group">
        <h2>Extra per guest, by dish type</h2>
        <p className="pricing-group__hint">
          Added on top of the occasion rate for each dish category the customer picks. Grills cost
          more to serve than rice, so they carry a higher uplift.
        </p>
        {pricing.dish_rates.map((r) => (
          <RateRow
            key={r.category_slug}
            label={CATEGORY_LABELS[r.category_slug] ?? r.category_slug}
            amountKobo={r.uplift_kobo}
            note={r.note}
            busy={saving === `dish:${r.category_slug}`}
            onSave={(amount, note) => save('dish', r.category_slug, amount, note)}
          />
        ))}
      </section>

      <section className="pricing-group">
        <h2>Cook only, per dish</h2>
        <p className="pricing-group__hint">
          Used when the customer only wants you to cook. No guest count is involved, so the deposit
          is the sum of these rates for the categories they pick.
        </p>
        {pricing.cook_rates.map((r) => (
          <RateRow
            key={r.category_slug}
            label={CATEGORY_LABELS[r.category_slug] ?? r.category_slug}
            amountKobo={r.rate_kobo}
            note={r.note}
            busy={saving === `cook:${r.category_slug}`}
            onSave={(amount, note) => save('cook', r.category_slug, amount, note)}
          />
        ))}
      </section>
    </div>
  )
}

function RateRow({
  label,
  amountKobo,
  note,
  busy,
  onSave,
}: {
  label: string
  amountKobo: number
  note: string
  busy: boolean
  onSave: (amount: string, note: string) => void
}) {
  const [amount, setAmount] = useState(String(amountKobo / 100))
  const [reason, setReason] = useState(note)

  return (
    <div className="rate-row">
      <div className="rate-row__head">
        <strong>{label}</strong>
        <span className="rate-row__now">{naira(amountKobo)}</span>
      </div>
      <div className="rate-row__fields">
        <div className="field">
          <label>Amount (naira)</label>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="field rate-row__note">
          <label>Why this rate</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Shown to the customer as the reason"
          />
        </div>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={busy}
          onClick={() => onSave(amount, reason)}
        >
          {busy ? 'Saving' : 'Save'}
        </button>
      </div>
    </div>
  )
}