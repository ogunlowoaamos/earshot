import { Link } from 'react-router-dom'
import logo from '../assets/logo.svg'
import './Footer.css'

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__grid">
          <div className="site-footer__brand">
            <img src={logo} alt="FeastFusion" width={56} height={56} />
            <p>
              A Nigerian kitchen cooking with fire, patience and a lot of pepper. Delivery, pickup
              and full-service catering.
            </p>
          </div>

          <div className="site-footer__col">
            <h4>Shop</h4>
            <Link to="/menu">Full menu</Link>
            <Link to="/menu?category=soups">Soups</Link>
            <Link to="/menu?category=grills">Grills</Link>
            <Link to="/menu?category=desserts">Desserts</Link>
          </div>

          <div className="site-footer__col">
            <h4>Services</h4>
            <Link to="/catering">Event catering</Link>
            <Link to="/#kitchen">Our kitchen</Link>
            <Link to="/track">Track an order</Link>
            <Link to="/admin">Staff login</Link>
          </div>

          <div className="site-footer__col">
            <h4>Reach us</h4>
            <a href="tel:+2348000000000">+234 800 000 0000</a>
            <a href="mailto:hello@feastfusion.ng">hello@feastfusion.ng</a>
            <span>Abuja, FCT, Nigeria</span>
            <span>Mon-Sun, 9am-9pm</span>
          </div>
        </div>

        <div className="site-footer__base">
          <span>© {new Date().getFullYear()} FeastFusion. All rights reserved.</span>
          <span>Catering deposits are non-refundable.</span>
        </div>
      </div>
    </footer>
  )
}
