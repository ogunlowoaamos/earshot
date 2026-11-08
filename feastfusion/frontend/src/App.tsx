import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { CartDrawer } from './components/CartDrawer'
import { Landing } from './pages/Landing'
import { MenuPage } from './pages/MenuPage'
import { ItemDetail } from './pages/ItemDetail'
import { Checkout } from './pages/Checkout'
import { OrderConfirmation } from './pages/OrderConfirmation'
import { Catering } from './pages/Catering'
import { CateringAgreement } from './pages/CateringAgreement'
import { TrackOrder } from './pages/TrackOrder'
import { Admin } from './pages/Admin'
import { NotFound } from './pages/NotFound'

function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    const jump = () => {
      if (hash) {
        const target = document.querySelector(hash)
        if (target) {
          target.scrollIntoView({ behavior: 'instant' as ScrollBehavior })
          return true
        }
      }
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
      return false
    }
    if (jump()) return
    // A cross-page hash link can land before the target section has mounted.
    const timer = window.setTimeout(jump, 80)
    return () => window.clearTimeout(timer)
  }, [pathname, hash])
  return null
}

export default function App() {
  const { pathname } = useLocation()
  // Only the landing page is a scrolling marketing page. Every other page is an
  // app screen, so a footer there would just add scroll for no reason.
  const isLandingPage = pathname === '/'

  return (
    <>
      <ScrollToTop />
      <Header />
      <main id="main">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/menu/:id" element={<ItemDetail />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order/:reference" element={<OrderConfirmation />} />
          <Route path="/catering" element={<Catering />} />
          <Route path="/catering/agreement" element={<CateringAgreement />} />
          <Route path="/about" element={<Navigate to="/#kitchen" replace />} />
          <Route path="/track" element={<TrackOrder />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {isLandingPage && <Footer />}
      <CartDrawer />
    </>
  )
}
