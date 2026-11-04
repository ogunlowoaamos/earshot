import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import logo from '../assets/logo.svg'
import './StaticPages.css'

export function About() {
  return (
    <div className="static-page">
      <header className="static-page__head">
        <div className="container">
          <img src={logo} alt="" width={64} height={64} className="static-page__logo" />
          <span className="eyebrow">Our kitchen</span>
          <h1>One pot, one family, a lot of pepper.</h1>
          <p className="lede">
            FeastFusion started as a Sunday ritual. One auntie, one very large pot of jollof, and a
            queue of neighbours. We simply built a website around it.
          </p>
        </div>
      </header>

      <div className="container static-page__body">
        <div className="static-page__split">
          <Reveal>
            <img
              src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=80"
              alt="A cook working in a busy kitchen"
              className="static-page__img"
            />
          </Reveal>
          <Reveal delay={80}>
            <h2>How we cook</h2>
            <p>
              Every base starts from scratch. Tomatoes are blended and fried down until the raw
              taste disappears. Stock simmers for hours. Pepper is measured by feel, not by spoon.
            </p>
            <p>
              We cook in small batches each morning, so what reaches you hasn't been sitting under a
              heat lamp since yesterday. If something runs out, it runs out. We would rather sell
              out than serve you a shadow of the real thing.
            </p>
          </Reveal>
        </div>

        <div className="static-page__values">
          {[
            ['Small batches', 'We cook to the number of orders, not to a forecast.'],
            ['Real fire', 'Grills over open flame. Smoke is a flavour, not an accident.'],
            ['Honest portions', 'If you order for two, two people eat well.'],
          ].map(([t, b]) => (
            <div key={t}>
              <h3>{t}</h3>
              <p>{b}</p>
            </div>
          ))}
        </div>

        <div className="static-page__cta">
          <h2>Come eat.</h2>
          <div className="static-page__cta-actions">
            <Link to="/menu" className="btn btn--primary btn--lg">
              See the menu
            </Link>
            <Link to="/catering" className="btn btn--ghost btn--lg">
              Book catering
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
