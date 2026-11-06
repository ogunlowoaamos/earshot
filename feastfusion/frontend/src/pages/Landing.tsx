import { lazy, Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, naira } from '../lib/api'
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

/* ---------------- Kitchen wall ----------------
   A moving wall of food photos and cooking clips. The menu itself lives at
   /menu, so this section is purely visual: it shows the food, it does not
   list or price it. */

type WallTile =
  | { kind: 'photo'; src: string; alt: string }
  | { kind: 'video'; src: string; poster: string; alt: string }

const photo = (id: string, alt: string): WallTile => ({
  kind: 'photo',
  src: `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=600&q=70`,
  alt,
})

const clip = (src: string, posterId: string, alt: string): WallTile => ({
  kind: 'video',
  src,
  poster: `https://images.unsplash.com/photo-${posterId}?auto=format&fit=crop&w=600&q=70`,
  alt,
})

const WALL_COLUMNS: WallTile[][] = [
  [
    photo('1631515243349-e0cb75fb8d3a', 'A pot of smoky party jollof rice'),
    clip(
      'https://upload.wikimedia.org/wikipedia/commons/7/78/Hot_Rice_and_fried_Dodo_with_a_plate_of_fish_stew_and_boiled_egg.webm',
      '1604329760661-e71dc83f8f26',
      'Rice, fried plantain, fish stew and a boiled egg being plated',
    ),
    photo('1544025162-d76694265947', 'Suya skewers dusted with yaji spice'),
    photo('1601050690597-df0568f70950', 'A platter of small chops'),
    photo('1544145945-f90425340c7e', 'A glass of chilled zobo'),
  ],
  [
    photo('1547592180-85f173990554', 'A bowl of egusi soup'),
    photo('1519708227418-c8fd9a32b7a2', 'Charcoal grilled chicken'),
    clip(
      'https://upload.wikimedia.org/wikipedia/commons/9/9a/Cooking_Squilla_mantis_with_tomato_sauce.webm',
      '1476718406336-bb5a9690ee2a',
      'Seafood simmering in a fresh tomato sauce',
    ),
    photo('1509440159596-0249088772ff', 'A smooth mound of pounded yam'),
    photo('1555507036-ab1f4038808a', 'Golden meat pies cooling on a tray'),
  ],
  [
    photo('1504674900247-0877df9cc836', 'Peppered goat meat in a dark bowl'),
    photo('1606491956689-2ea866880c84', 'Coconut fried rice'),
    photo('1467003909585-2f8a72700288', 'A whole grilled tilapia'),
    clip(
      'https://upload.wikimedia.org/wikipedia/commons/2/26/Cooking_Pilaf.webm',
      '1512058564366-18510be2db19',
      'Rice being stirred through in a wide pan',
    ),
    photo('1516684732162-798a0062be99', 'A bowl of crunchy chin chin'),
  ],
]

// On a metered connection we show the still frame instead of the clip.
const SAVE_DATA =
  typeof navigator !== 'undefined' &&
  (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true

function WallTileView({ tile, dup }: { tile: WallTile; dup?: boolean }) {
  const className = `wall__tile${dup ? ' wall__tile--dup' : ''}`
  const hidden = dup ? { 'aria-hidden': true as const } : {}

  if (tile.kind === 'video' && !dup && !SAVE_DATA) {
    return (
      <figure className={className} {...hidden}>
        <video
          src={tile.src}
          poster={tile.poster}
          muted
          loop
          playsInline
          autoPlay
          preload="none"
          aria-label={tile.alt}
        />
      </figure>
    )
  }

  return (
    <figure className={className} {...hidden}>
      <img
        src={tile.kind === 'video' ? tile.poster : tile.src}
        alt={dup ? '' : tile.alt}
        loading="lazy"
      />
    </figure>
  )
}

export function Landing() {
  const [menuCount, setMenuCount] = useState(0)

  useEffect(() => {
    let alive = true
    api
      .menu()
      .then((items) => {
        if (alive) setMenuCount(items.length)
      })
      .catch(() => undefined)
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
              Party jollof, slow-braised soups, peppered grills and warm desserts. Cooked fresh
              each morning, delivered hot across Abuja.
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

      {/* ---------------- Proof strip ---------------- */}
      <section className="stats-band">
        <div className="container stats-band__inner">
          <dl className="stats-band__list">
            <div>
              <dt>Avg. delivery</dt>
              <dd>45 min</dd>
            </div>
            <div>
              <dt>Dishes on menu</dt>
              <dd>{menuCount > 0 ? menuCount : '24'}</dd>
            </div>
            <div>
              <dt>Events catered</dt>
              <dd>300+</dd>
            </div>
          </dl>
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

      {/* ---------------- Kitchen wall ---------------- */}
      <section className="wall" aria-label="Food and cooking at FeastFusion">
        <div className="wall__cols">
          {WALL_COLUMNS.map((col, ci) => (
            <div key={ci} className={`wall__col${ci % 2 === 1 ? ' wall__col--down' : ''}`}>
              <div className="wall__track">
                {[...col, ...col].map((tile, i) => (
                  <WallTileView key={i} tile={tile} dup={i >= col.length} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Coverage map ---------------- */}
      <section className="section coverage">
        <div className="container">
          <Reveal>
            <div className="coverage__head">
              <div>
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

      {/* ---------------- Our kitchen ---------------- */}
      <section className="section story" id="kitchen">
        <div className="container">
          <div className="story__inner">
            <Reveal className="story__media">
              <img
                src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=80"
                alt="A cook working in a busy kitchen"
              />
            </Reveal>

            <Reveal className="story__copy" delay={80}>
              <span className="eyebrow">Our kitchen</span>
              <h2>One pot, one family, a lot of pepper.</h2>
              <p>
                FeastFusion started as a Sunday ritual. One auntie, one very large pot of jollof,
                and a queue of neighbours. We simply built a website around it.
              </p>
              <p>
                Every base still starts from scratch. Tomatoes are blended and fried down until the
                raw taste disappears. Stock simmers for hours. Pepper is measured by feel, not by
                spoon.
              </p>
              <p>
                We cook in small batches each morning, so what reaches you has not been sitting
                under a heat lamp since yesterday. If something runs out, it runs out. We would
                rather sell out than serve you a shadow of the real thing.
              </p>
            </Reveal>
          </div>

          <div className="story__values">
            {[
              ['Small batches', 'We cook to the number of orders, not to a forecast.'],
              ['Real fire', 'Grills over open flame. Smoke is a flavour, not an accident.'],
              ['Honest portions', 'If you order for two, two people eat well.'],
              ['You can follow it', 'Track your order from the kitchen to your door.'],
            ].map(([title, body], i) => (
              <Reveal key={title} delay={i * 70}>
                <h3>{title}</h3>
                <p>{body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Testimonials ---------------- */}
      <section className="section voices">
        <div className="container">
          <Reveal>
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
