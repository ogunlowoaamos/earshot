import { useEffect, useState } from 'react'
import {
  api,
  naira,
  type Catalogue,
  type CatalogueItem,
  type Category,
  type CateringPricing,
  type CateringRequest,
  type MenuItem,
  type OptionGroupIn,
  type OptionIn,
  type Order,
} from '../lib/api'
import './Admin.css'

type Tab = 'orders' | 'menu' | 'pairings' | 'catering' | 'pricing'

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
          {(['orders', 'menu', 'pairings', 'catering', 'pricing'] as Tab[]).map((t) => (
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
                  ? 'Catalogue'
                  : t === 'pairings'
                    ? 'Pairings'
                    : t === 'catering'
                      ? 'Catering requests'
                      : 'Deposit calculator'}
            </button>
          ))}
        </nav>

        {tab === 'orders' && <OrdersPanel token={token} />}
        {tab === 'menu' && <MenuPanel token={token} />}
        {tab === 'pairings' && <PairingsPanel token={token} />}
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

/* ---------------- catalogue ---------------- */

function MenuPanel({ token }: { token: string }) {
  const [data, setData] = useState<Catalogue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('all')
  const [openId, setOpenId] = useState<number | null>(null)
  const [openIngId, setOpenIngId] = useState<number | null>(null)

  function load() {
    setLoading(true)
    api
      .adminCatalogue(token)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [token])

  const items = data?.items ?? []
  const categories = data?.categories ?? []

  const needle = query.trim().toLowerCase()
  const shown = items.filter((it) => {
    if (cat !== 'all' && it.category_slug !== cat) return false
    return !needle || it.name.toLowerCase().includes(needle)
  })

  const live = items.filter((it) => it.is_available && it.price_kobo > 0).length
  const unpriced = items.filter((it) => it.price_kobo === 0).length

  function patchItem(updated: MenuItem) {
    setData((d) =>
      d
        ? {
            ...d,
            items: d.items.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)),
          }
        : d,
    )
  }

  async function setPrice(item: CatalogueItem, kobo: number) {
    try {
      patchItem(await api.adminUpdateItem(token, item.id, { price_kobo: kobo }))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function toggle(item: CatalogueItem) {
    try {
      patchItem(await api.adminUpdateItem(token, item.id, { is_available: !item.is_available }))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function bulk(slug: string, is_available: boolean) {
    try {
      setData(await api.adminSetAvailability(token, { category_slug: slug, is_available }))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function approve(slug: string, is_approved: boolean) {
    try {
      setData(await api.adminSetCategoryApproval(token, slug, is_approved))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function remove(item: CatalogueItem) {
    if (!confirm(`Delete "${item.name}"?`)) return
    try {
      await api.adminDeleteItem(token, item.id)
      setData((d) => (d ? { ...d, items: d.items.filter((i) => i.id !== item.id) } : d))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const groups = categories
    .map((c) => ({ cat: c, rows: shown.filter((it) => it.category_slug === c.slug) }))
    // An empty category is only worth a section when the caterer asked for it
    // by name, otherwise the page fills up with headings that have no dishes.
    .filter((g) => g.rows.length > 0 || cat === g.cat.slug)

  const onMenu = categories.filter((c) => c.is_approved).length

  return (
    <div className="admin-menu">
      <div className="admin-orders__bar">
        <span>
          {items.length} dishes · {live} live · {unpriced} need a price ·{' '}
          {onMenu} of {categories.length} categories on the customer menu
        </span>
        <button className="btn btn--primary btn--sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Add dish'}
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      {showForm && (
        <NewItemForm
          token={token}
          categories={categories}
          onCreated={(item) => {
            setData((d) =>
              d
                ? {
                    ...d,
                    items: [...d.items, { ...item, sort_order: 0, option_groups: [] }],
                  }
                : d,
            )
            setShowForm(false)
          }}
        />
      )}

      <div className="cat-bar">
        <input
          className="cat-search"
          type="search"
          placeholder="Search dishes"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          value={cat}
          aria-label="Filter by category"
          onChange={(e) => setCat(e.target.value)}
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
              {c.is_approved ? '' : ' (hidden)'}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="admin-loading">Loading catalogue…</p>
      ) : groups.length === 0 ? (
        <p className="cat-empty">No dishes match that search.</p>
      ) : (
        groups.map(({ cat: c, rows }) => {
          const on = rows.filter((r) => r.is_available).length
          return (
            <section key={c.slug} className="cat-group">
              <div className="cat-group__head">
                <div>
                  <h3>{c.name}</h3>
                  <span>
                    {rows.length} dishes · {on} switched on
                    {c.is_approved ? '' : ' · hidden from customers'}
                  </span>
                </div>
                <div className="cat-group__bulk">
                  <button
                    className={`status-btn status-btn--menu${c.is_approved ? ' is-active' : ''}`}
                    onClick={() => approve(c.slug, !c.is_approved)}
                    title="Customers only see categories that are on the menu"
                  >
                    {c.is_approved ? 'On the customer menu' : 'Hidden from customers'}
                  </button>
                  <button className="status-btn" onClick={() => bulk(c.slug, true)}>
                    Turn all on
                  </button>
                  <button className="status-btn" onClick={() => bulk(c.slug, false)}>
                    Turn all off
                  </button>
                </div>
              </div>

              {rows.length === 0 && (
                <p className="cat-empty">
                  No dishes in this category yet. Add one with “+ Add dish”, or keep the
                  category hidden from customers.
                </p>
              )}

              {rows.map((it) => (
                <div key={it.id} className="cat-row">
                  <div className="cat-row__main">
                    <img src={it.image_url} alt="" />
                    <div className="cat-row__info">
                      <strong>{it.name}</strong>
                      <div className="cat-row__meta">
                        {it.price_kobo === 0 ? (
                          <span className="cat-badge">Needs a price</span>
                        ) : (
                          <span className="cat-badge cat-badge--ok">{naira(it.price_kobo)}</span>
                        )}
                        <span>
                          {it.option_groups.length} option
                          {it.option_groups.length === 1 ? '' : 's'}
                        </span>
                        <span>
                          {it.ingredients.length} ingredient
                          {it.ingredients.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                    <div className="cat-row__actions">
                      <PriceInput value={it.price_kobo} onCommit={(k) => setPrice(it, k)} />
                      <button
                        className={`status-btn ${it.is_available ? 'is-active' : ''}`}
                        onClick={() => toggle(it)}
                      >
                        {it.is_available ? 'on' : 'off'}
                      </button>
                      <button
                        className="status-btn"
                        onClick={() => setOpenId((v) => (v === it.id ? null : it.id))}
                      >
                        {openId === it.id ? 'Close' : 'Options'}
                      </button>
                      <button
                        className="status-btn"
                        onClick={() => setOpenIngId((v) => (v === it.id ? null : it.id))}
                      >
                        {openIngId === it.id ? 'Close' : 'Ingredients'}
                      </button>
                      <button className="admin-menu__del" onClick={() => remove(it)}>
                        Delete
                      </button>
                    </div>
                  </div>

                  {openId === it.id && (
                    <OptionsEditor
                      item={it}
                      token={token}
                      categories={categories}
                      onSaved={setData}
                    />
                  )}

                  {openIngId === it.id && (
                    <IngredientsEditor item={it} token={token} onSaved={patchItem} />
                  )}
                </div>
              ))}
            </section>
          )
        })
      )}
    </div>
  )
}

function PriceInput({ value, onCommit }: { value: number; onCommit: (kobo: number) => void }) {
  const [text, setText] = useState(value ? String(value / 100) : '')

  useEffect(() => {
    setText(value ? String(value / 100) : '')
  }, [value])

  function commit() {
    const n = Number(text.replace(/[^0-9.]/g, ''))
    const kobo = Number.isFinite(n) ? Math.round(n * 100) : 0
    if (kobo !== value) onCommit(kobo)
  }

  return (
    <label className="cat-price">
      <span>₦</span>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        placeholder="0"
        aria-label="Price in naira"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
    </label>
  )
}

function OptionsEditor({
  item,
  token,
  categories,
  onSaved,
}: {
  item: CatalogueItem
  token: string
  categories: Category[]
  onSaved: (next: Catalogue) => void
}) {
  const [groups, setGroups] = useState<OptionGroupIn[]>(() => toDraft(item))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const categoryName = (slug: string) =>
    categories.find((c) => c.slug === slug)?.name ?? slug

  useEffect(() => {
    setGroups(toDraft(item))
    setSaved(false)
  }, [item])

  function patchGroup(gi: number, patch: Partial<OptionGroupIn>) {
    setGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, ...patch } : g)))
    setSaved(false)
  }

  function patchOption(gi: number, oi: number, patch: Partial<OptionIn>) {
    setGroups((gs) =>
      gs.map((g, i) =>
        i === gi
          ? { ...g, options: g.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)) }
          : g,
      ),
    )
    setSaved(false)
  }

  function addGroup() {
    setGroups((gs) => [
      ...gs,
      {
        name: 'New group',
        kind: 'single',
        help: '',
        is_required: false,
        allows_quantity: false,
        source_category_slug: '',
        free_text: false,
        options: [],
      },
    ])
    setSaved(false)
  }

  function removeGroup(gi: number) {
    setGroups((gs) => gs.filter((_, i) => i !== gi))
    setSaved(false)
  }

  function addOption(gi: number) {
    setGroups((gs) =>
      gs.map((g, i) =>
        i === gi
          ? {
              ...g,
              options: [
                ...g.options,
                { label: 'New choice', price_delta_kobo: 0, is_default: false, is_available: true },
              ],
            }
          : g,
      ),
    )
    setSaved(false)
  }

  function removeOption(gi: number, oi: number) {
    setGroups((gs) =>
      gs.map((g, i) => (i === gi ? { ...g, options: g.options.filter((_, j) => j !== oi) } : g)),
    )
    setSaved(false)
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      onSaved(await api.adminSaveOptions(token, item.id, groups))
      setSaved(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cat-opts">
      {groups.map((g, gi) => (
        <div key={gi} className="cat-opt-group">
          <div className="cat-opt-group__head">
            <input
              type="text"
              value={g.name}
              aria-label="Group name"
              onChange={(e) => patchGroup(gi, { name: e.target.value })}
            />
            <select
              value={g.kind}
              aria-label="Pick one or many"
              onChange={(e) => patchGroup(gi, { kind: e.target.value as 'single' | 'multi' })}
            >
              <option value="single">Pick one</option>
              <option value="multi">Pick many</option>
            </select>
            <label className="cat-check">
              <input
                type="checkbox"
                checked={g.is_required}
                onChange={(e) => patchGroup(gi, { is_required: e.target.checked })}
              />
              Required
            </label>
            <label className="cat-check" title="Turns each choice into a how-many stepper">
              <input
                type="checkbox"
                checked={g.allows_quantity}
                onChange={(e) => patchGroup(gi, { allows_quantity: e.target.checked })}
              />
              Ask how many of each
            </label>
            <label
              className="cat-check"
              title="Adds a box so the customer can say what they want in their own words"
            >
              <input
                type="checkbox"
                checked={g.free_text}
                onChange={(e) => patchGroup(gi, { free_text: e.target.checked })}
              />
              Let them type it
            </label>
            <select
              className="cat-opt-source"
              value={g.source_category_slug}
              aria-label="Where the choices come from"
              title="Fill this group from a category instead of typing the choices"
              onChange={(e) => patchGroup(gi, { source_category_slug: e.target.value })}
            >
              <option value="">Type the choices here</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  Use the {c.name} list
                </option>
              ))}
            </select>
            <button className="admin-menu__del" onClick={() => removeGroup(gi)}>
              Remove group
            </button>
          </div>

          {g.allows_quantity && !g.source_category_slug && (
            <p className="cat-opt-note">
              Customers will say how many of each choice they want. Put the price of one
              piece in the price box.
            </p>
          )}

          {g.free_text && (
            <p className="cat-opt-note">
              A box appears under the choices so the customer can say what they want in
              their own words, for example a custom portion. Their words show on the
              order and on the kitchen receipt.
            </p>
          )}

          {g.source_category_slug ? (
            <>
              <p className="cat-opt-note">
                This list is the <strong>{categoryName(g.source_category_slug)}</strong>{' '}
                category, so it always matches the catalogue. Add, rename, price or switch
                off a dish there and it changes here too.
              </p>
              <ul className="cat-opt-derived">
                {g.options.map((o, oi) => (
                  <li key={oi}>
                    <span>{o.label}</span>
                    <span className="cat-opt-derived__cost">
                      {o.price_delta_kobo === 0 ? 'No extra' : `+${naira(o.price_delta_kobo)}`}
                    </span>
                  </li>
                ))}
                {g.options.length === 0 && (
                  <li className="cat-opt-derived__empty">
                    Nothing in that category is switched on yet.
                  </li>
                )}
              </ul>
            </>
          ) : (
            <>
              {g.options.map((o, oi) => (
                <div key={oi} className="cat-opt-row">
                  <input
                    type="text"
                    value={o.label}
                    aria-label="Choice label"
                    onChange={(e) => patchOption(gi, oi, { label: e.target.value })}
                  />
                  <PriceInput
                    value={o.price_delta_kobo}
                    onCommit={(k) => patchOption(gi, oi, { price_delta_kobo: k })}
                  />
                  <label
                    className="cat-check cat-check--avail"
                    title="Untick to hide this choice today"
                  >
                    <input
                      type="checkbox"
                      checked={o.is_available}
                      onChange={(e) => patchOption(gi, oi, { is_available: e.target.checked })}
                    />
                    Available
                  </label>
                  <button className="admin-menu__del" onClick={() => removeOption(gi, oi)}>
                    Remove
                  </button>
                </div>
              ))}

              <div className="cat-opt-foot">
                <button className="status-btn" onClick={() => addOption(gi)}>
                  + Add choice
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      {error && <p className="form-error">{error}</p>}

      <div className="cat-opt-foot">
        <button className="status-btn" onClick={addGroup}>
          + Add group
        </button>
        <button className="btn btn--primary btn--sm" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : saved ? 'Saved' : 'Save options'}
        </button>
      </div>
    </div>
  )
}

function IngredientsEditor({
  item,
  token,
  onSaved,
}: {
  item: CatalogueItem
  token: string
  onSaved: (next: MenuItem) => void
}) {
  const [text, setText] = useState(item.ingredients.join('\n'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setText(item.ingredients.join('\n'))
    setSaved(false)
  }, [item])

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      onSaved(await api.adminSaveIngredients(token, item.id, lines))
      setSaved(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cat-opts">
      <p className="cat-ing__hint">
        One ingredient per line. This is what the customer sees under "What is in it".
      </p>
      <textarea
        className="cat-ing__box"
        value={text}
        rows={Math.min(Math.max(lines.length + 2, 6), 16)}
        aria-label="Ingredients, one per line"
        placeholder={'Long grain rice\nTomato and pepper base\nChicken stock'}
        onChange={(e) => {
          setText(e.target.value)
          setSaved(false)
        }}
      />

      {error && <p className="form-error">{error}</p>}

      <div className="cat-opt-foot">
        <span className="cat-ing__count">
          {lines.length} ingredient{lines.length === 1 ? '' : 's'}
        </span>
        <button className="btn btn--primary btn--sm" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : saved ? 'Saved' : 'Save ingredients'}
        </button>
      </div>
    </div>
  )
}

function toDraft(item: CatalogueItem): OptionGroupIn[] {
  return item.option_groups.map((g) => ({
    name: g.name,
    kind: g.kind,
    help: g.help,
    is_required: g.is_required,
    allows_quantity: g.allows_quantity,
    source_category_slug: g.source_category_slug,
    free_text: g.free_text,
    options: g.options.map((o) => ({
      label: o.label,
      price_delta_kobo: o.price_delta_kobo,
      is_default: o.is_default,
      is_available: o.is_available,
    })),
  }))
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

/* ---------------- pairings ---------------- */

/**
 * The caterer's "what goes with what" board. Each category gets a row of
 * toggles for the other categories. Whatever is saved here is what the
 * customer sees on the catering form and on a dish page, so nothing about
 * pairing is hardcoded in the shop.
 */
function PairingsPanel({ token }: { token: string }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [saved, setSaved] = useState<Record<string, string[]>>({})
  const [draft, setDraft] = useState<Record<string, string[]>>({})
  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([api.adminCatalogue(token), api.pairings()])
      .then(([cat, pairs]) => {
        const list = [...cat.categories].sort((a, b) => a.sort_order - b.sort_order)
        setCategories(list)

        const grouped: Record<string, string[]> = {}
        for (const c of list) grouped[c.slug] = []
        for (const p of pairs) {
          if (!grouped[p.category_slug]) continue
          grouped[p.category_slug].push(p.accompanies_slug)
        }

        setSaved(grouped)
        setDraft(grouped)
        setOpenSlug(list[0]?.slug ?? null)
      })
      .catch((e: Error) => setError(e.message))
  }, [token])

  function toggle(slug: string, other: string) {
    setDraft((d) => {
      const current = d[slug] ?? []
      return {
        ...d,
        [slug]: current.includes(other)
          ? current.filter((s) => s !== other)
          : [...current, other],
      }
    })
    setNote(null)
  }

  async function save(slug: string) {
    setBusy(slug)
    setError(null)
    setNote(null)
    try {
      await api.adminSavePairings(token, slug, draft[slug] ?? [])
      setSaved((s) => ({ ...s, [slug]: draft[slug] ?? [] }))
      setNote('Saved.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const dirty = (slug: string) => {
    const a = [...(saved[slug] ?? [])].sort().join(',')
    const b = [...(draft[slug] ?? [])].sort().join(',')
    return a !== b
  }

  if (error && categories.length === 0) {
    return <p className="form-error">{error}</p>
  }

  return (
    <div className="pairings">
      <p className="pairings__lede">
        Pick what goes with each category. The shop uses this to suggest extras, so
        you never have to edit the website to change a pairing.
      </p>

      {note && <p className="pairings__note">{note}</p>}
      {error && <p className="form-error">{error}</p>}

      <ul className="pairings__list">
        {categories.map((c) => {
          const open = openSlug === c.slug
          const chosen = draft[c.slug] ?? []
          return (
            <li key={c.slug} className={`pairing ${open ? 'is-open' : ''}`}>
              <button
                type="button"
                className="pairing__head"
                aria-expanded={open}
                onClick={() => setOpenSlug(open ? null : c.slug)}
              >
                <span className="pairing__name">{c.name}</span>
                <span className="pairing__count">
                  {chosen.length === 0
                    ? 'Nothing yet'
                    : `${chosen.length} ${chosen.length === 1 ? 'pairing' : 'pairings'}`}
                </span>
                <span className="pairing__chev" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path
                      d="m6 9 6 6 6-6"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>

              {open && (
                <div className="pairing__body">
                  <div className="pairing__chips">
                    {categories
                      .filter((o) => o.slug !== c.slug)
                      .map((o) => {
                        const on = chosen.includes(o.slug)
                        return (
                          <button
                            key={o.slug}
                            type="button"
                            className={`pairing__chip ${on ? 'is-on' : ''}`}
                            aria-pressed={on}
                            onClick={() => toggle(c.slug, o.slug)}
                          >
                            <span className="pairing__tick" aria-hidden="true">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                                <path
                                  d="m5 13 4 4L19 7"
                                  stroke="currentColor"
                                  strokeWidth="3.4"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                            {o.name}
                          </button>
                        )
                      })}
                  </div>

                  <div className="pairing__foot">
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      disabled={busy === c.slug || !dirty(c.slug)}
                      onClick={() => save(c.slug)}
                    >
                      {busy === c.slug ? 'Saving…' : dirty(c.slug) ? 'Save pairings' : 'Saved'}
                    </button>
                    {dirty(c.slug) && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() =>
                          setDraft((d) => ({ ...d, [c.slug]: saved[c.slug] ?? [] }))
                        }
                      >
                        Undo
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
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
              <span>
                {r.event_type} · {new Date(r.event_date).toLocaleDateString('en-NG')}
                {r.event_time ? ` · ${r.event_time}` : ''}
              </span>
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
            <div>
              <span className="admin-label">Allergies</span>
              <p>{r.allergies || 'None given'}</p>
            </div>
            <div>
              <span className="admin-label">Dishes picked</span>
              <p>{r.picked_dishes || 'Category only'}</p>
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