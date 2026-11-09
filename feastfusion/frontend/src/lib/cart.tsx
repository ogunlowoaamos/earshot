import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CartLine, MenuItem, OptionPick } from './api'
import { picksExtraKobo, picksKey } from './options'

type CartContextValue = {
  lines: CartLine[]
  count: number
  subtotalKobo: number
  add: (item: MenuItem, qty?: number, picks?: OptionPick[]) => void
  /** How many of one exact dish-and-choices are in the basket. */
  qtyOf: (item: MenuItem, picks: OptionPick[]) => number
  setQty: (key: string, qty: number) => void
  remove: (key: string) => void
  clear: () => void
  isOpen: boolean
  open: () => void
  close: () => void
}

const CartContext = createContext<CartContextValue | null>(null)
const STORAGE_KEY = 'feastfusion.cart.v1'

/** Baskets saved before choices existed have no `picks` field. */
function readStored(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CartLine[]
    return Array.isArray(parsed)
      ? parsed
          .filter((l) => l && l.item && typeof l.item.id === 'number')
          .map((l) => ({ ...l, qty: Math.max(1, l.qty || 1), picks: l.picks ?? [] }))
      : []
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(readStored)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
  }, [lines])

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((n, l) => n + l.qty, 0)
    const subtotalKobo = lines.reduce(
      (n, l) => n + l.qty * (l.item.price_kobo + picksExtraKobo(l.item, l.picks)),
      0,
    )

    return {
      lines,
      count,
      subtotalKobo,
      add: (item, qty = 1, picks = []) =>
        setLines((prev) => {
          const key = picksKey(item.id, picks)
          const found = prev.find((l) => picksKey(l.item.id, l.picks) === key)
          if (found) {
            return prev.map((l) =>
              picksKey(l.item.id, l.picks) === key ? { ...l, qty: l.qty + qty } : l,
            )
          }
          return [...prev, { item, qty, picks }]
        }),
      qtyOf: (item, picks) => {
        const key = picksKey(item.id, picks)
        return lines.find((l) => picksKey(l.item.id, l.picks) === key)?.qty ?? 0
      },
      setQty: (key, qty) =>
        setLines((prev) =>
          qty <= 0
            ? prev.filter((l) => picksKey(l.item.id, l.picks) !== key)
            : prev.map((l) => (picksKey(l.item.id, l.picks) === key ? { ...l, qty } : l)),
        ),
      remove: (key) => setLines((prev) => prev.filter((l) => picksKey(l.item.id, l.picks) !== key)),
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
