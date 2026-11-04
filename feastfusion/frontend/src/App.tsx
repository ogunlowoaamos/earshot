import { Route, Routes, useLocation } from 'react-router-dom'
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
import { About } from './pages/About'
import { TrackOrder } from './pages/TrackOrder'
import { Admin } from './pages/Admin'
import { NotFound } from './pages/NotFound'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}

export default function App() {
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
          <Route path="/about" element={<About />} />
          <Route path="/track" element={<TrackOrder />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <CartDrawer />
    </>
  )
}
