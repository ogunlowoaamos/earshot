import { Link } from 'react-router-dom'
import { useCart } from '../lib/cart'
import { naira, type MenuItem } from '../lib/api'
import './MenuCard.css'

export function MenuCard({ item }: { item: MenuItem }) {
  const { add, open } = useCart()

  return (
    <article className="menu-card">
      {/*
        One invisible link stretched over the whole card, so a tap anywhere
        opens the dish. The Add button sits above it on the z-axis, which keeps
        the two actions separate without nesting a button inside a link.
      */}
      <Link
        to={`/menu/${item.id}`}
        className="menu-card__stretch"
        aria-label={`View ${item.name}`}
      />

      <div className="menu-card__media">
        <img src={item.image_url} alt={item.name} loading="lazy" />
        {item.is_featured && <span className="menu-card__flag">Chef's pick</span>}
        {!item.is_available && <span className="menu-card__sold">Sold out</span>}
      </div>

      <div className="menu-card__body">
        <div className="menu-card__head">
          <h3>{item.name}</h3>
          <span className="menu-card__price">{naira(item.price_kobo)}</span>
        </div>

        <p className="menu-card__desc">{item.description}</p>

        <div className="menu-card__foot">
          <div className="menu-card__tags">
            {item.tags.slice(0, 2).map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>

          <button
            className="btn btn--gold btn--sm"
            disabled={!item.is_available}
            onClick={() => {
              add(item)
              open()
            }}
          >
            Add
          </button>
        </div>
      </div>
    </article>
  )
}
