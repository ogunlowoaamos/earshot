import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, type Category, type MenuItem } from '../lib/api'
import { MenuCard } from '../components/MenuCard'
import { Reveal } from '../components/Reveal'
import './MenuPage.css'

export function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()

  const active = params.get('category') ?? 'all'
  const query = params.get('q') ?? ''

  useEffect(() => {
    let alive = true
    Promise.all([api.menu(), api.categories()])
      .then(([m, c]) => {
        if (!alive) return
        setItems(m)
        setCategories(c)
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((i) => {
      const catOk = active === 'all' || i.category_slug === active
      const qOk =
        !q ||
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.tags.some((t) => t.toLowerCase().includes(q))
      return catOk && qOk
    })
  }, [items, active, query])

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  return (
    <div className="menu-page">
      <header className="menu-page__head">
        <div className="container">
          <span className="eyebrow">The kitchen menu</span>
          <h1>Everything we cook</h1>
          <p className="lede">
            Fresh daily. Prices in Naira. Add to your basket and check out in under two minutes.
          </p>
        </div>
      </header>

      <div className="container">
        <div className="menu-toolbar">
          <div className="chips" role="tablist" aria-label="Filter by category">
            <button
              role="tab"
              aria-selected={active === 'all'}
              className={`chip ${active === 'all' ? 'is-active' : ''}`}
              onClick={() => setParam('category', 'all')}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.slug}
                role="tab"
                aria-selected={active === c.slug}
                className={`chip ${active === c.slug ? 'is-active' : ''}`}
                onClick={() => setParam('category', c.slug)}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="menu-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
              <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              placeholder="Search dishes…"
              value={query}
              onChange={(e) => setParam('q', e.target.value)}
              aria-label="Search dishes"
            />
          </div>
        </div>

        {loading ? (
          <div className="menu-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-card" style={{ height: 380 }} />
            ))}
          </div>
        ) : error ? (
          <div className="menu-empty">
            <h2>We couldn't load the menu</h2>
            <p>{error}</p>
            <p className="menu-empty__hint">
              Make sure the backend is running on port 8080, then reload.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="menu-empty">
            <h2>Nothing matches that</h2>
            <p>Try a different category or clear your search.</p>
            <button
              className="btn btn--ghost"
              onClick={() => setParams(new URLSearchParams(), { replace: true })}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <p className="menu-count">
              {filtered.length} {filtered.length === 1 ? 'dish' : 'dishes'}
            </p>
            <div className="menu-grid">
              {filtered.map((item, i) => (
                <Reveal key={item.id} delay={Math.min(i, 6) * 50}>
                  <MenuCard item={item} />
                </Reveal>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
