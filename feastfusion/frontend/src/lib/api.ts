export type Category = {
  id: number
  slug: string
  name: string
  description: string | null
  sort_order: number
}

export type MenuItem = {
  id: number
  category_id: number
  category_slug: string
  name: string
  description: string
  price_kobo: number
  image_url: string
  is_available: boolean
  is_featured: boolean
  tags: string[]
}

export type CartLine = {
  item: MenuItem
  qty: number
}

export type OrderType = 'delivery' | 'pickup'

export type PaymentMethod = 'online' | 'transfer' | 'on_delivery'

export type OrderPayload = {
  customer_name: string
  customer_phone: string
  customer_email: string
  order_type: OrderType
  delivery_address: string | null
  delivery_state: string | null
  notes: string | null
  payment_method: PaymentMethod
  items: { menu_item_id: number; qty: number }[]
}

export type Order = {
  id: number
  reference: string
  customer_name: string
  customer_phone: string
  customer_email: string
  order_type: OrderType
  delivery_address: string | null
  delivery_state: string | null
  notes: string | null
  payment_method: PaymentMethod
  payment_status: string
  status: string
  subtotal_kobo: number
  delivery_fee_kobo: number
  total_kobo: number
  proof_url: string | null
  created_at: string
  items: { name: string; qty: number; unit_price_kobo: number }[]
}

export type CateringRequest = {
  id: number
  reference: string
  name: string
  phone: string
  email: string
  event_date: string
  guest_count: number
  event_type: string
  location: string
  budget_kobo: number | null
  details: string | null
  status: string
  created_at: string
}

export type DeliveryZone = {
  id: number
  state: string
  fee_kobo: number
  lat: number
  lng: number
  radius_km: number
  is_active: boolean
}

export type Settings = {
  delivery_fee_kobo: number
  catering_deposit_kobo: number
  whatsapp_number: string
  bank_name: string
  bank_account_name: string
  bank_account_number: string
}

const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {
      /* keep default */
    }
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  categories: () => request<Category[]>('/categories'),
  menu: () => request<MenuItem[]>('/menu'),
  settings: () => request<Settings>('/settings'),
  zones: () => request<DeliveryZone[]>('/zones'),

  createOrder: (payload: OrderPayload) =>
    request<Order>('/orders', { method: 'POST', body: JSON.stringify(payload) }),

  getOrder: (reference: string) => request<Order>(`/orders/${reference}`),

  uploadProof: (reference: string, file: File) => {
    const form = new FormData()
    form.append('proof', file)
    return request<Order>(`/orders/${reference}/proof`, { method: 'POST', body: form })
  },

  createCatering: (payload: Record<string, unknown>) =>
    request<CateringRequest>('/catering', { method: 'POST', body: JSON.stringify(payload) }),

  adminLogin: (username: string, password: string) =>
    request<{ token: string }>('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  adminOrders: (token: string) =>
    request<Order[]>('/admin/orders', { headers: { Authorization: `Bearer ${token}` } }),

  adminUpdateOrder: (token: string, id: number, patch: Record<string, unknown>) =>
    request<Order>(`/admin/orders/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(patch),
    }),

  adminCatering: (token: string) =>
    request<CateringRequest[]>('/admin/catering', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  adminCreateItem: (token: string, payload: Record<string, unknown>) =>
    request<MenuItem>('/admin/menu', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    }),

  adminUpdateItem: (token: string, id: number, patch: Record<string, unknown>) =>
    request<MenuItem>(`/admin/menu/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(patch),
    }),

  adminDeleteItem: (token: string, id: number) =>
    request<void>(`/admin/menu/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),
}

export function naira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`
}
