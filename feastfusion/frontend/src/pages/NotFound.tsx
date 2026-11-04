import { Link } from 'react-router-dom'
import './StaticPages.css'

export function NotFound() {
  return (
    <div className="static-page">
      <div className="container static-page__body not-found">
        <span className="not-found__code">404</span>
        <h1>This plate is empty</h1>
        <p>The page you're looking for isn't on the menu.</p>
        <div className="static-page__cta-actions">
          <Link to="/" className="btn btn--primary btn--lg">
            Back home
          </Link>
          <Link to="/menu" className="btn btn--ghost btn--lg">
            See the menu
          </Link>
        </div>
      </div>
    </div>
  )
}
