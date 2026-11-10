export type Category = {
  id: number
  slug: string
  name: string
  description: string | null
  sort_order: number
  is_approved: boolean
}

export type MediaItem = {
  url: string
  /** "image", "video" or "link" — a pasted link is not guessed from its ending. */
  kind: 'image' | 'video' | 'link'
}

export type MenuItem = {
  id: number
  category_id: number
  category_slug: string
  name: string
  description: string
  price_kobo: number
  image_url: string
  /** Empty when the dish has no video. */
  video_url: string
  /** Everything attached to the dish, in the caterer's own order. */
  media?: MediaItem[]
  is_available: boolean
  is_featured: boolean
  tags: string[]
  ingredients: string[]
  /** Sent by the menu endpoint, absent on items loaded from the basket. */
  option_groups?: OptionGroup[]
}

export type DishOption = {
  id: number
  label: string
  price_delta_kobo: number
  is_default: boolean
  is_available: boolean
  sort_order: number
}

export type OptionGroup = {
  id: number
  name: string
  kind: 'single' | 'multi'
  help: string
  is_required: boolean
  /** True when the group counts pieces, so each choice gets its own how-many stepper. */
  allows_quantity: boolean
  /**
   * Set when the choices are filled in from a category rather than typed by
   * hand. The dashboard shows these as read-only.
   */
  source_category_slug: string
  /**
   * True when the group also asks the customer to type their own answer, for
   * example "Custom" on a portion. The words ride along with the pick.
   */
  free_text: boolean
  sort_order: number
  options: DishOption[]
}

/** One choice the customer made, and how many of it they want. */
export type OptionPick = {
  option_id: number
  qty: number
  /** The customer's own words, when the group asked them to type an answer. */
  text?: string
}

export type CatalogueItem = MenuItem & {
  sort_order: number
  option_groups: OptionGroup[]
}

export type Catalogue = {
  categories: Category[]
  items: CatalogueItem[]
}

/** One "what goes with what" rule, set by the caterer in the admin page. */
export type Pairing = {
  category_slug: string
  accompanies_slug: string
}

export type OptionIn = {
  label: string
  price_delta_kobo: number
  is_default: boolean
  is_available: boolean
}

export type OptionGroupIn = {
  name: string
  kind: 'single' | 'multi'
  help: string
  is_required: boolean
  allows_quantity: boolean
  /** Fill this group from a category instead of the list below. */
  source_category_slug: string
  /** Let the customer type their own answer as well as picking a choice. */
  free_text: boolean
  options: OptionIn[]
}

export type CartLine = {
  item: MenuItem
  qty: number
  /** What was picked on the dish page. Empty for a plain dish. */
  picks: OptionPick[]
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
  items: { menu_item_id: number; qty: number; options: OptionPick[] }[]
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
  event_time: string
  guest_count: number
  event_type: string
  location: string
  budget_kobo: number | null
  details: string | null
  deposit_kobo: number
  deposit_status: string
  proof_url: string | null
  status: string
  created_at: string
  state: string
  lga: string
  street_address: string
  dishes: string
  other_dishes: string
  allergies: string
  picked_dishes: string
  contact_channel: string
  contact_handle: string
  job_kind: string
  deposit_reason: string
}

export type CateringRate = {
  id: number
  event_type: string
  rate_kobo: number
  note: string
  is_active: boolean
  sort_order: number
}

export type DishRate = {
  id: number
  category_slug: string
  uplift_kobo: number
  note: string
}

export type CookRate = {
  id: number
  category_slug: string
  rate_kobo: number
  note: string
}

export type CateringPricing = {
  rates: CateringRate[]
  dish_rates: DishRate[]
  cook_rates: CookRate[]
}

export type QuoteLine = {
  label: string
  amount_kobo: number
}

export type Quote = {
  deposit_kobo: number
  reason: string
  lines: QuoteLine[]
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
  pairings: () => request<Pairing[]>('/pairings'),
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

  quote: (payload: Record<string, unknown>) =>
    request<Quote>('/catering/quote', { method: 'POST', body: JSON.stringify(payload) }),

  adminPricing: (token: string) =>
    request<CateringPricing>('/admin/pricing', { headers: { Authorization: `Bearer ${token}` } }),

  adminSaveRate: (token: string, kind: string, payload: Record<string, unknown>) =>
    request<CateringPricing>(`/admin/pricing/${kind}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    }),

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

  adminCatalogue: (token: string) =>
    request<Catalogue>('/admin/catalogue', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  /** The shelf of ready-made groups the dashboard offers as on/off switches. */
  adminGroupLibrary: (token: string) =>
    request<{ groups: OptionGroupIn[] }>('/admin/group-library', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  /** Every tag already in use, so the tag box can suggest them. */
  adminTags: (token: string) =>
    request<{ tags: string[] }>('/admin/tags', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  /** Adds a shelf the caterer typed into the Add item form. */
  adminCreateCategory: (token: string, name: string, description = '') =>
    request<Category>('/admin/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, description }),
    }),

  /** Sends a photo or video file and gets back the address to store. */
  adminUpload: (token: string, file: File) => {
    const body = new FormData()
    body.append('file', file)
    return request<{ url: string; kind: 'image' | 'video' }>('/admin/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
    })
  },

  /** Sends several files, one request each, and keeps the order. */
  adminUploadMany: async (token: string, files: File[]) => {
    const saved: { url: string; kind: 'image' | 'video' }[] = []
    for (const file of files) {
      saved.push(await api.adminUpload(token, file))
    }
    return saved
  },

  adminSaveOptions: (token: string, id: number, groups: OptionGroupIn[]) =>
    request<Catalogue>(`/admin/menu/${id}/options`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ groups }),
    }),

  adminSaveIngredients: (token: string, id: number, ingredients: string[]) =>
    request<MenuItem>(`/admin/menu/${id}/ingredients`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ingredients }),
    }),

  adminSetAvailability: (
    token: string,
    payload: { item_ids?: number[]; category_slug?: string; is_available: boolean },
  ) =>
    request<Catalogue>('/admin/availability', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    }),

  adminSetCategoryApproval: (token: string, slug: string, is_approved: boolean) =>
    request<Catalogue>(`/admin/categories/${slug}/approval`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ is_approved }),
    }),

  adminSavePairings: (token: string, categorySlug: string, accompanies: string[]) =>
    request<{ ok: boolean }>('/admin/pairings', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ category_slug: categorySlug, accompanies }),
    }),
}

export function naira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`
}
