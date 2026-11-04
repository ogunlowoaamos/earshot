import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CartLine, MenuItem } from './api'

type CartContextValue = {
  lines: CartLine[]
  count: number
  subtotalKobo: number
  add: (item: MenuItem, qty?: number) => void
  setQty: (id: number, qty: number) => void
  remove: (id: number) => void
  clear: () => void
  isOpen: boolean
  open: () => void
  close: () => void
}

const CartContext = createContext<CartContextValue | null>(null)
const STORAGE_KEY = 'feastfusion.cart.v1'

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as CartLine[]) : []
    } catch {
      return []
    }
  })
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
  }, [lines])

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((n, l) => n + l.qty, 0)
    const subtotalKobo = lines.reduce((n, l) => n + l.qty * l.item.price_kobo, 0)

    return {
      lines,
      count,
      subtotalKobo,
      add: (item, qty = 1) =>
        setLines((prev) => {
          const found = prev.find((l) => l.item.id === item.id)
          if (found) {
            return prev.map((l) => (l.item.id === item.id ? { ...l, qty: l.qty + qty } : l))
          }
          return [...prev, { item, qty }]
        }),
      setQty: (id, qty) =>
        setLines((prev) =>
          qty <= 0
            ? prev.filter((l) => l.item.id !== id)
            : prev.map((l) => (l.item.id === id ? { ...l, qty } : l)),
        ),
      remove: (id) => setLines((prev) => prev.filter((l) => l.item.id !== id)),
      clear: () => setLines([]),
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
    }
  }, [lines, isOpen])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
