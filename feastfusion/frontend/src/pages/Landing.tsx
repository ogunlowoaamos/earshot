import { lazy, Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, naira, type MenuItem } from '../lib/api'
import { MenuCard } from '../components/MenuCard'
import { Reveal } from '../components/Reveal'
import logo from '../assets/logo.svg'
import './Landing.css'

// three.js is a big download, so the 3D map arrives after the page is usable.
const CoverageMap = lazy(() =>
  import('../components/CoverageMap').then((m) => ({ default: m.CoverageMap })),
)

const HERO_IMG =
  'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?auto=format&fit=crop&w=1100&q=80'
const HERO_IMG_2 =
  'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=700&q=80'

const marquee = [
  'Party Jollof',
  'Egusi & Pounded Yam',
  'Peppered Goat Meat',
  'Seafood Okra',
  'Puff Puff',
  'Coconut Rice',
  'Grilled Tilapia',
  'Chin Chin',
]

export function Landing() {
  const [featured, setFeatured] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    api
      .menu()
      .then((items) => {
        if (!alive) return
        const picked = items.filter((i) => i.is_featured).slice(0, 6)
        setFeatured(picked.length ? picked : items.slice(0, 6))
      })
      .catch(() => undefined)
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="landing">
      {/* ---------------- Hero ---------------- */}
      <section className="hero">
        <div className="container hero__inner">
          <div className="hero__copy">
            <span className="eyebrow">Abuja · Nigerian kitchen</span>

            <h1 className="hero__title">
              Food that tastes like
              <span className="hero__accent"> somebody's mother</span> is showing off.
            </h1>

            <p className="lede hero__lede">
              Party jollof, slow-braised soups, peppered grills and warm desserts, cooked fresh
              every morning in small batches. Delivered hot across Abuja and nearby states, or
              ready for pickup.
            </p>

            <div className="hero__actions">
              <Link to="/menu" className="btn btn--primary btn--lg">
                Order food
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M5 12h14m-6-6 6 6-6 6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              <Link to="/catering" className="btn btn--ghost btn--lg">
                Cater an event
              </Link>
            </div>

            <dl className="hero__stats">
              <div>
                <dt>Avg. delivery</dt>
                <dd>45 min</dd>
              </div>
              <div>
                <dt>Dishes on menu</dt>
                <dd>40+</dd>
              </div>
              <div>
                <dt>Events catered</dt>
                <dd>300+</dd>
              </div>
            </dl>
          </div>

          <div className="hero__media">
            <div className="hero__frame hero__frame--main">
              <img src={HERO_IMG} alt="A bowl of Nigerian party jollof rice" />
            </div>
            <div className="hero__frame hero__frame--small">
              <img src={HERO_IMG_2} alt="A steaming bowl of soup" />
            </div>
            <div className="hero__badge">
              <img src={logo} alt="" width={40} height={40} />
              <div>
                <strong>Cooked today</strong>
                <span>Never frozen</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Marquee ---------------- */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee__track">
          {[...marquee, ...marquee].map((w, i) => (
            <span key={i} className="marquee__item">
              {w}
              <em>✦</em>
            </span>
          ))}
        </div>
      </div>

      {/* ---------------- Three ways ---------------- */}
      <section className="section ways">
        <div className="container">
          <Reveal>
            <div className="ways__head">
              <span className="eyebrow">Three ways to eat</span>
              <h2 className="ways__title">
                Pick whatever fits your day. We handle the fire.
              </h2>
            </div>
          </Reveal>

          <div className="ways__grid">
            <Reveal className="way way--tall">
              <div className="way__num">01</div>
              <h3>Delivered hot</h3>
              <p>
                Order before 7pm and we ride it straight to your door anywhere in Abuja, and out to
                our live neighbouring states. Insulated packs keep it at serving temperature.
              </p>
              <Link to="/menu" className="way__link">
                Browse the menu →
              </Link>
            </Reveal>

            <Reveal className="way" delay={80}>
              <div className="way__num">02</div>
              <h3>Pickup</h3>
              <p>Skip the fee. Collect from our kitchen in Wuse 2, Abuja. Ready in about 25 minutes.</p>
              <Link to="/menu" className="way__link">
                Order for pickup →
              </Link>
            </Reveal>

            <Reveal className="way way--dark" delay={140}>
              <div className="way__num">03</div>
              <h3>We cook for your occasion</h3>
              <p>
                Weddings, naming ceremonies, office lunches, birthdays. We bring the pots, the
                servers and the whole spread.
              </p>
              <Link to="/catering" className="way__link">
                Plan an event →
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------- Featured ---------------- */}
      <section className="section featured">
        <div className="container">
          <Reveal>
            <div className="featured__head">
              <div>
                <span className="eyebrow">From the kitchen</span>
                <h2 className="featured__title">What people keep re-ordering</h2>
              </div>
              <Link to="/menu" className="btn btn--ghost">
                See all 40+ dishes
              </Link>
            </div>
          </Reveal>

          {loading ? (
            <div className="featured__grid">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton-card" />
              ))}
            </div>
          ) : featured.length === 0 ? (
            <p className="featured__empty">
              Our menu is being updated. Please check back shortly.
            </p>
          ) : (
            <div className="featured__grid">
              {featured.map((item, i) => (
                <Reveal key={item.id} delay={i * 60}>
                  <MenuCard item={item} />
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ---------------- Coverage map ---------------- */}
      <section className="section coverage">
        <div className="container">
          <Reveal>
            <div className="coverage__head">
              <div>
                <span className="eyebrow">Where we deliver</span>
                <h2 className="coverage__title">
                  Cooked in Abuja. Reaching further every month.
                </h2>
                <p className="lede coverage__lede">
                  Our kitchen is in Wuse 2. Everywhere inside a gold ring gets to you hot. The
                  dashed states are next in line. We switch them on the moment our riders are
                  ready.
                </p>
              </div>
              <Link to="/menu" className="btn btn--ghost">
                See delivery fees
              </Link>
            </div>
          </Reveal>

          <Reveal>
            <Suspense fallback={<div className="coverage-map__skeleton" aria-hidden="true" />}>
              <CoverageMap />
            </Suspense>
          </Reveal>
        </div>
      </section>

      {/* ---------------- Catering band ---------------- */}
      <section className="catering-band">
        <div className="container catering-band__inner">
          <Reveal className="catering-band__copy">
            <span className="eyebrow eyebrow--light">Full-service catering</span>
            <h2>Your guests will talk about the food for years.</h2>
            <p>
              From 30 to 500 guests. We plan the menu with you, cook on site or deliver in chafing
              trays, and handle serving so you can actually enjoy your own party.
            </p>
            <ul className="catering-band__list">
              <li>Free menu consultation</li>
              <li>Live cooking stations available</li>
              <li>Deposit secures your date. Non-refundable.</li>
            </ul>
            <Link to="/catering" className="btn btn--gold btn--lg">
              Request a quote
            </Link>
          </Reveal>

          <Reveal className="catering-band__media" delay={100}>
            <img
              src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=80"
              alt="A long catering table set for a celebration"
            />
          </Reveal>
        </div>
      </section>

      {/* ---------------- Promise ---------------- */}
      <section className="section promise">
        <div className="container promise__inner">
          <div className="promise__sticky">
            <span className="eyebrow">The FeastFusion promise</span>
            <h2>No shortcuts you can taste.</h2>
            <p className="lede">
              We cook the way a good kitchen should: fresh stock, real pepper, and enough time for
              the flavours to come together.
            </p>
          </div>

          <ol className="promise__list">
            {[
              [
                'Cooked the same day',
                'Nothing sits overnight. Your order starts cooking after you place it.',
              ],
              [
                'Real ingredients, no powders',
                'Fresh tomatoes, scotch bonnet, locust beans and palm oil. No seasoning shortcuts.',
              ],
              [
                'Portions that actually feed you',
                'Generous servings built for sharing, or for one very happy person.',
              ],
              [
                'You always know where your order is',
                'Track it from the kitchen to your door with a reference number.',
              ],
            ].map(([title, body], i) => (
              <Reveal as="li" key={title} delay={i * 70} className="promise__item">
                <span className="promise__index">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------- Testimonials ---------------- */}
      <section className="section voices">
        <div className="container">
          <Reveal>
            <span className="eyebrow">Word of mouth</span>
            <h2 className="voices__title">Abuja has opinions. Here they are.</h2>
          </Reveal>

          <div className="voices__grid">
            {[
              {
                quote:
                  'The jollof was so smoky I had to call and ask if they cooked it on firewood. They did.',
                name: 'Adaeze O.',
                place: 'Maitama',
              },
              {
                quote:
                  'We used them for my mum’s 60th. 180 guests, nobody queued, and the egusi finished before the rice.',
                name: 'Tunde A.',
                place: 'Gwarinpa',
              },
              {
                quote:
                  'I order lunch here three times a week. My bank account is upset but my stomach is thrilled.',
                name: 'Chiamaka N.',
                place: 'Wuse 2',
              },
            ].map((t, i) => (
              <Reveal key={t.name} delay={i * 80} className="voice">
                <span className="voice__mark" aria-hidden="true">
                  “
                </span>
                <p>{t.quote}</p>
                <footer>
                  <strong>{t.name}</strong>
                  <span>{t.place}</span>
                </footer>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Final CTA ---------------- */}
      <section className="final-cta">
        <div className="container final-cta__inner">
          <img src={logo} alt="" width={72} height={72} className="final-cta__logo" />
          <h2>Hungry yet?</h2>
          <p>Order in under two minutes. Pay online, transfer, or on delivery.</p>
          <div className="final-cta__actions">
            <Link to="/menu" className="btn btn--primary btn--lg">
              Start your order
            </Link>
            <a href="tel:+2348000000000" className="btn btn--ghost btn--lg">
              Call the kitchen
            </a>
          </div>
          <p className="final-cta__tiny">
            Free delivery on orders above {naira(5000000)} within Abuja.
          </p>
        </div>
      </section>
    </div>
  )
}
