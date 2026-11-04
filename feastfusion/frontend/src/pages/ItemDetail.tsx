import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, naira, type MenuItem } from '../lib/api'
import { useCart } from '../lib/cart'
import './ItemDetail.css'

export function ItemDetail() {
  const { id } = useParams()
  const [item, setItem] = useState<MenuItem | null>(null)
  const [others, setOthers] = useState<MenuItem[]>([])
  const [qty, setQty] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { add, open } = useCart()
  const navigate = useNavigate()

  useEffect(() => {
    let alive = true
    setLoading(true)
    api
      .menu()
      .then((items) => {
        if (!alive) return
        const found = items.find((i) => i.id === Number(id)) ?? null
        setItem(found)
        setOthers(
          items.filter((i) => i.id !== Number(id) && i.category_slug === found?.category_slug).slice(0, 3),
        )
        if (!found) setError('We could not find that dish.')
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
        <div className="skeleton-card" style={{ height: 460, borderRadius: 24 }} />
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
            </div>

            <div className="detail__actions">
              <button
                className="btn btn--primary btn--lg"
                disabled={!item.is_available}
                onClick={() => {
                  add(item, qty)
                  open()
                }}
              >
                {item.is_available ? `Add ${qty} to basket` : 'Sold out today'}
              </button>
              <button
                className="btn btn--ghost btn--lg"
                disabled={!item.is_available}
                onClick={() => {
                  add(item, qty)
                  navigate('/checkout')
                }}
              >
                Buy now
              </button>
            </div>

            <p className="detail__total">
              Total <strong>{naira(item.price_kobo * qty)}</strong>
            </p>

            <ul className="detail__facts">
              <li>Cooked fresh after you order</li>
              <li>Delivery in ~45 minutes</li>
              <li>Pickup available in Wuse 2, Abuja</li>
            </ul>
          </div>
        </div>

        {others.length > 0 && (
          <section className="detail__more">
            <h2>Goes well with</h2>
            <div className="detail__more-grid">
              {others.map((o) => (
                <Link key={o.id} to={`/menu/${o.id}`} className="related">
                  <img src={o.image_url} alt="" />
                  <div>
                    <strong>{o.name}</strong>
                    <span>{naira(o.price_kobo)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
