import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../lib/cart'
import { naira } from '../lib/api'
import { pickLabels, picksExtraKobo, picksKey } from '../lib/options'
import './CartDrawer.css'

export function CartDrawer() {
  const { lines, isOpen, close, setQty, remove, subtotalKobo, count } = useCart()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, close])

  return (
    <>
      <div
        className={`cart-scrim ${isOpen ? 'is-open' : ''}`}
        onClick={close}
        aria-hidden="true"
      />
      <aside
        className={`cart-drawer ${isOpen ? 'is-open' : ''}`}
        aria-hidden={!isOpen}
        aria-label="Your cart"
      >
        <header className="cart-drawer__head">
          <h2>Your basket</h2>
          <button className="cart-drawer__close" onClick={close} aria-label="Close cart">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        {count === 0 ? (
          <div className="cart-drawer__empty">
            <p>Your basket is empty.</p>
            <Link to="/menu" className="btn btn--primary" onClick={close}>
              Browse the menu
            </Link>
          </div>
        ) : (
          <>
            <ul className="cart-drawer__list">
              {lines.map((line) => {
                const key = picksKey(line.item.id, line.picks)
                const choices = pickLabels(line.item, line.picks)
                const extra = picksExtraKobo(line.item, line.picks)
                return (
                  <li key={key} className="cart-line">
                    <img src={line.item.image_url} alt="" className="cart-line__img" />
                    <div className="cart-line__info">
                      <Link to={`/menu/${line.item.id}`} onClick={close}>
                        {line.item.name}
                      </Link>
                      {choices.length > 0 && (
                        <span className="cart-line__picks">{choices.join(' · ')}</span>
                      )}
                      <span className="cart-line__price">
                        {extra > 0
                          ? `${naira(line.item.price_kobo)} + ${naira(extra)} of choices`
                          : naira(line.item.price_kobo)}
                      </span>
                      <div className="qty">
                        <button
                          onClick={() => setQty(key, line.qty - 1)}
                          aria-label={`Decrease ${line.item.name}`}
                        >
                          −
                        </button>
                        <span aria-live="polite">{line.qty}</span>
                        <button
                          onClick={() => setQty(key, line.qty + 1)}
                          aria-label={`Increase ${line.item.name}`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <button
                      className="cart-line__remove"
                      onClick={() => remove(key)}
                      aria-label={`Remove ${line.item.name}`}
                    >
                      Remove
                    </button>
                  </li>
                )
              })}
            </ul>

            <footer className="cart-drawer__foot">
              <div className="cart-drawer__total">
                <span>Subtotal</span>
                <strong>{naira(subtotalKobo)}</strong>
              </div>
              <p className="cart-drawer__note">Delivery fee is added at checkout.</p>
              <button
                className="btn btn--primary"
                onClick={() => {
                  close()
                  navigate('/checkout')
                }}
              >
                Checkout
              </button>
            </footer>
          </>
        )}
      </aside>
    </>
  )
}
