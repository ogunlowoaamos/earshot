-- FeastFusion schema
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    slug        TEXT NOT NULL UNIQUE,
    description TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    price_kobo   INTEGER NOT NULL CHECK (price_kobo >= 0),
    image_url    TEXT NOT NULL DEFAULT '',
    tags         TEXT NOT NULL DEFAULT '',
    is_available INTEGER NOT NULL DEFAULT 1,
    is_featured  INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    reference         TEXT NOT NULL UNIQUE,
    customer_name     TEXT NOT NULL,
    customer_phone    TEXT NOT NULL,
    customer_email    TEXT NOT NULL DEFAULT '',
    order_type        TEXT NOT NULL CHECK (order_type IN ('delivery','pickup')),
    delivery_address  TEXT,
    delivery_state    TEXT,
    notes             TEXT,
    subtotal_kobo     INTEGER NOT NULL,
    delivery_fee_kobo INTEGER NOT NULL DEFAULT 0,
    total_kobo        INTEGER NOT NULL,
    payment_method    TEXT NOT NULL CHECK (payment_method IN ('online','transfer','on_delivery')),
    payment_status    TEXT NOT NULL DEFAULT 'pending'
                      CHECK (payment_status IN ('pending','proof_uploaded','paid','failed','refunded')),
    proof_url         TEXT,
    status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','confirmed','preparing','out_for_delivery','completed','cancelled')),
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id    INTEGER NOT NULL,
    name            TEXT NOT NULL,
    unit_price_kobo INTEGER NOT NULL,
    quantity        INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE TABLE IF NOT EXISTS catering_requests (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    reference      TEXT NOT NULL UNIQUE,
    customer_name  TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT NOT NULL DEFAULT '',
    event_type     TEXT NOT NULL,
    event_date     TEXT NOT NULL,
    guest_count    INTEGER NOT NULL CHECK (guest_count > 0),
    location       TEXT NOT NULL,
    budget_kobo    INTEGER,
    details        TEXT,
    deposit_kobo   INTEGER NOT NULL DEFAULT 0,
    deposit_status TEXT NOT NULL DEFAULT 'pending'
                   CHECK (deposit_status IN ('pending','proof_uploaded','paid')),
    proof_url      TEXT,
    status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','contacted','confirmed','completed','cancelled')),
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS delivery_zones (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    state      TEXT NOT NULL UNIQUE,
    fee_kobo   INTEGER NOT NULL CHECK (fee_kobo >= 0),
    lat        REAL NOT NULL,
    lng        REAL NOT NULL,
    radius_km  REAL NOT NULL DEFAULT 60,
    is_active  INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_menu_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_zones_active ON delivery_zones(is_active, sort_order);
