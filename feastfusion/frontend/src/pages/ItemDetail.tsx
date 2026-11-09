import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, naira, type MenuItem } from '../lib/api'
import { useCart } from '../lib/cart'
import './ItemDetail.css'

type PairGroup = { slug: string; name: string; items: MenuItem[] }

export function ItemDetail() {
  const { id } = useParams()
  const [item, setItem] = useState<MenuItem | null>(null)
  const [groups, setGroups] = useState<PairGroup[]>([])
  const [qty, setQty] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [peek, setPeek] = useState<{ id: number; x: number; y: number; below: boolean } | null>(null)
  const { add, open, lines, setQty: setLineQty } = useCart()
  const navigate = useNavigate()

  // How many of a pairing are already in the basket. Zero means the card shows
  // no stepper at all, so an untouched card stays as small as it was.
  const qtyOf = (id: number) => lines.find((l) => l.item.id === id)?.qty ?? 0

  // The pairings rail scrolls, so the hover panel is positioned against the
  // viewport instead of the card. That keeps it from being clipped.
  function showPeek(el: HTMLElement, id: number) {
    const r = el.getBoundingClientRect()
    const below = r.top < 300
    const half = 100
    const x = Math.min(Math.max(r.left + r.width / 2, half + 8), window.innerWidth - half - 8)
    setPeek({ id, x, y: below ? r.bottom + 6 : r.top - 6, below })
  }

  // A new dish should start at the top, not wherever the last one was scrolled.
  useEffect(() => {
    window.scrollTo(0, 0)
    document.querySelector('.detail__main')?.scrollTo(0, 0)
    document.querySelector('.detail__more')?.scrollTo(0, 0)
  }, [id])

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([
      api.menu(),
      api.pairings().catch(() => []),
      api.categories().catch(() => []),
    ])
      .then(([items, pairs, cats]) => {
        if (!alive) return
        const found = items.find((i) => i.id === Number(id)) ?? null
        setItem(found)
        if (!found) {
          setError('We could not find that dish.')
          return
        }

        const nameOf = (slug: string) =>
          cats.find((c) => c.slug === slug)?.name ?? slug

        // The caterer decides what goes with what, so we read the pairings
        // rather than guessing. Each paired category becomes its own row, in
        // the order the caterer set, so a swallow shows soups, then drinks.
        const paired = pairs
          .filter((p) => p.category_slug === found.category_slug)
          .map((p) => p.accompanies_slug)

        const fromPairs: PairGroup[] = paired
          .map((slug) => ({
            slug,
            name: nameOf(slug),
            items: items
              .filter((i) => i.id !== found.id && i.category_slug === slug)
              .slice(0, 6),
          }))
          .filter((g) => g.items.length > 0)

        if (fromPairs.length > 0) {
          setGroups(fromPairs)
          return
        }

        // Nothing paired yet, so fall back to the rest of the same category.
        const sameCat = items
          .filter((i) => i.id !== found.id && i.category_slug === found.category_slug)
          .slice(0, 6)
        setGroups(
          sameCat.length > 0
            ? [{ slug: found.category_slug, name: nameOf(found.category_slug), items: sameCat }]
            : [],
        )
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [id])

  if (loading) {
    return (
      <div className="container detail-detail">
        <div className="skeleton-card" style={{ height: 460, borderRadius: 16 }} />
      </div>
    )
  }

  if (!item || error) {
    return (
      <div className="container menu-empty" style={{ paddingBlock: '6rem' }}>
        <h1>Dish not found</h1>
        <p>{error ?? 'That item may have been removed from the menu.'}</p>
        <Link to="/menu" className="btn btn--primary">
          Back to menu
        </Link>
      </div>
    )
  }

  return (
    <div className="detail">
      <div className="container">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to="/menu">Menu</Link>
          <span aria-hidden="true">/</span>
          <span>{item.name}</span>
        </nav>

        <div className="detail__layout">
          <div className="detail__main" onScroll={() => setPeek(null)}>
            <div className="detail__grid">
              <div className="detail__media">
                <img src={item.image_url} alt={item.name} />
              </div>

              <div className="detail__info">
                <div className="detail__tags">
                  {item.tags.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>

                <h1>{item.name}</h1>
                <p className="detail__price">{naira(item.price_kobo)}</p>
                <p className="detail__desc">{item.description}</p>

                {item.ingredients.length > 0 && (
                  <section className="detail__ingredients" aria-labelledby="ingredients-heading">
                    <h2 id="ingredients-heading">What is in it</h2>
                    <ul>
                      {item.ingredients.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    <p className="detail__ingredients-note">
                      Tell us about allergies when you check out and the kitchen will adjust.
                    </p>
                  </section>
                )}

                <div className="detail__qty">
                  <span>Quantity</span>
                  <div className="qty qty--lg">
                    <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease">
                      −
                    </button>
                    <span aria-live="polite">{qty}</span>
                    <button onClick={() => setQty((q) => Math.min(20, q + 1))} aria-label="Increase">
                      +
                    </button>
                  </div>
                  <p className="detail__total">
                    Total <strong>{naira(item.price_kobo * qty)}</strong>
                  </p>
                </div>

                <div className="detail__actions">
                  <button
                    className="btn btn--primary"
                    disabled={!item.is_available}
                    onClick={() => {
                      add(item, qty)
                      open()
                    }}
                  >
                    {item.is_available ? `Add ${qty} to basket` : 'Sold out today'}
                  </button>
                  <button
                    className="btn btn--ghost"
                    disabled={!item.is_available}
                    onClick={() => {
                      add(item, qty)
                      navigate('/checkout')
                    }}
                  >
                    Buy now
                  </button>
                </div>

                <ul className="detail__facts">
                  <li>Cooked fresh after you order</li>
                  <li>Delivery in ~45 minutes</li>
                  <li>Pickup available in Wuse 2, Abuja</li>
                </ul>
              </div>
            </div>
          </div>

          {groups.length > 0 && (
            <aside className="detail__more" aria-label="Goes well with" onScroll={() => setPeek(null)}>
              <h2>Goes well with</h2>
              {groups.map((g) => (
                <div key={g.slug} className="detail__more-group">
                  <h3>{g.name}</h3>
                  <div className="detail__more-grid">
                    {g.items.map((o) => {
                      const picked = qtyOf(o.id)
                      return (
                        <div
                          key={o.id}
                          className={'related' + (picked > 0 ? ' is-picked' : '')}
                          onMouseEnter={(e) => showPeek(e.currentTarget, o.id)}
                          onMouseLeave={() => setPeek(null)}
                          onFocus={(e) => showPeek(e.currentTarget, o.id)}
                          onBlur={() => setPeek(null)}
                        >
                          {/* The card body adds one. Once something is in the
                              basket a stepper appears underneath, so a second
                              or third helping is one tap away. */}
                          <button
                            type="button"
                            className="related__add"
                            disabled={!o.is_available}
                            onClick={() => add(o, 1)}
                            aria-label={
                              o.is_available
                                ? `Add ${o.name} to basket, ${naira(o.price_kobo)}`
                                : `${o.name} is sold out today`
                            }
                          >
                            <span className="related__text">
                              <strong>{o.name}</strong>
                              <span>{naira(o.price_kobo)}</span>
                            </span>
                          </button>

                          <Link
                            to={`/menu/${o.id}`}
                            className="related__go"
                            aria-label={`See details for ${o.name}`}
                            title="See details"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path
                                d="M9 6l6 6-6 6"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </Link>

                          {picked > 0 && (
                            <div className="related__qty">
                              <button
                                type="button"
                                onClick={() => setLineQty(o.id, picked - 1)}
                                aria-label={`One less ${o.name}`}
                              >
                                −
                              </button>
                              <span aria-live="polite">{picked}</span>
                              <button
                                type="button"
                                onClick={() => setLineQty(o.id, Math.min(20, picked + 1))}
                                aria-label={`One more ${o.name}`}
                              >
                                +
                              </button>
                            </div>
                          )}

                          {/* Hidden until hover on desktop, shown inline on touch
                              where there is no hover to reveal it. */}
                          <div
                            className={
                              'related__peek' +
                              (peek?.id === o.id ? ' is-open' : '') +
                              (peek?.id === o.id && peek.below ? ' is-below' : '')
                            }
                            style={peek?.id === o.id ? { left: peek.x, top: peek.y } : undefined}
                            aria-hidden="true"
                          >
                            <img src={o.image_url} alt="" />
                            {o.ingredients.length > 0 && (
                              <ul>
                                {o.ingredients.slice(0, 6).map((ing) => (
                                  <li key={ing}>{ing}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
