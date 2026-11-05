use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub sort_order: i64,
}

#[derive(Debug, sqlx::FromRow)]
pub struct MenuRow {
    pub id: i64,
    pub category_id: i64,
    pub category_slug: String,
    pub name: String,
    pub description: String,
    pub price_kobo: i64,
    pub image_url: String,
    pub tags: String,
    pub ingredients: String,
    pub is_available: i64,
    pub is_featured: i64,
}

#[derive(Debug, Serialize)]
pub struct MenuItem {
    pub id: i64,
    pub category_id: i64,
    pub category_slug: String,
    pub name: String,
    pub description: String,
    pub price_kobo: i64,
    pub image_url: String,
    pub tags: Vec<String>,
    pub ingredients: Vec<String>,
    pub is_available: bool,
    pub is_featured: bool,
}

impl From<MenuRow> for MenuItem {
    fn from(r: MenuRow) -> Self {
        MenuItem {
            id: r.id,
            category_id: r.category_id,
            category_slug: r.category_slug,
            name: r.name,
            description: r.description,
            price_kobo: r.price_kobo,
            image_url: r.image_url,
            tags: split_tags(&r.tags),
            ingredients: split_lines(&r.ingredients),
            is_available: r.is_available != 0,
            is_featured: r.is_featured != 0,
        }
    }
}

pub fn split_tags(raw: &str) -> Vec<String> {
    raw.split(',')
        .map(str::trim)
        .filter(|t| !t.is_empty())
        .map(str::to_string)
        .collect()
}

/// Ingredients are stored one per line so the caterer can type them naturally
/// in a textarea. Blank lines are dropped rather than shown as empty bullets.
pub fn split_lines(raw: &str) -> Vec<String> {
    raw.lines()
        .map(str::trim)
        .filter(|t| !t.is_empty())
        .map(str::to_string)
        .collect()
}

#[derive(Debug, Serialize)]
pub struct OrderLine {
    pub name: String,
    pub qty: i64,
    pub unit_price_kobo: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct OrderRow {
    pub id: i64,
    pub reference: String,
    pub customer_name: String,
    pub customer_phone: String,
    pub customer_email: String,
    pub order_type: String,
    pub delivery_address: Option<String>,
    pub delivery_state: Option<String>,
    pub notes: Option<String>,
    pub payment_method: String,
    pub payment_status: String,
    pub status: String,
    pub subtotal_kobo: i64,
    pub delivery_fee_kobo: i64,
    pub total_kobo: i64,
    pub proof_url: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct Order {
    #[serde(flatten)]
    pub row: OrderRow,
    pub items: Vec<OrderLine>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CateringRequest {
    pub id: i64,
    pub reference: String,
    #[sqlx(rename = "customer_name")]
    #[serde(rename = "name")]
    pub name: String,
    #[sqlx(rename = "customer_phone")]
    #[serde(rename = "phone")]
    pub phone: String,
    #[sqlx(rename = "customer_email")]
    #[serde(rename = "email")]
    pub email: String,
    pub event_date: String,
    pub guest_count: i64,
    pub event_type: String,
    pub location: String,
    pub budget_kobo: Option<i64>,
    pub details: Option<String>,
    pub deposit_kobo: i64,
    pub deposit_status: String,
    pub proof_url: Option<String>,
    pub status: String,
    pub created_at: String,
    pub state: String,
    pub lga: String,
    pub street_address: String,
    pub dishes: String,
    pub other_dishes: String,
    pub contact_channel: String,
    pub contact_handle: String,
    pub job_kind: String,
    pub deposit_reason: String,
}

/// One row of the caterer's price list: what a guest costs for this kind of job.
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct CateringRate {
    pub id: i64,
    pub event_type: String,
    pub rate_kobo: i64,
    pub note: String,
    pub is_active: bool,
    pub sort_order: i64,
}

/// How much a dish category adds to the per-guest rate.
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct DishRate {
    pub id: i64,
    pub category_slug: String,
    pub uplift_kobo: i64,
    pub note: String,
}

/// What a cook-only job costs for one dish of this category.
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct CookRate {
    pub id: i64,
    pub category_slug: String,
    pub rate_kobo: i64,
    pub note: String,
}

/// The whole price list, sent to the dashboard and used to quote customers.
#[derive(Debug, Serialize)]
pub struct CateringPricing {
    pub rates: Vec<CateringRate>,
    pub dish_rates: Vec<DishRate>,
    pub cook_rates: Vec<CookRate>,
}

/// What the customer asked for, before any money is worked out.
#[derive(Debug, Deserialize)]
pub struct QuoteRequest {
    pub job_kind: String,
    pub event_type: String,
    #[serde(default)]
    pub guest_count: i64,
    #[serde(default)]
    pub dishes: Vec<String>,
}

/// The deposit figure plus a plain-language reason the customer can read.
#[derive(Debug, Serialize)]
pub struct Quote {
    pub deposit_kobo: i64,
    pub reason: String,
    pub lines: Vec<QuoteLine>,
}

#[derive(Debug, Serialize)]
pub struct QuoteLine {
    pub label: String,
    pub amount_kobo: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DeliveryZone {
    pub id: i64,
    pub state: String,
    pub fee_kobo: i64,
    pub lat: f64,
    pub lng: f64,
    pub radius_km: f64,
    pub is_active: bool,
}

#[derive(Debug, Serialize)]
pub struct Settings {
    pub delivery_fee_kobo: i64,
    pub catering_deposit_kobo: i64,
    pub whatsapp_number: String,
    pub bank_name: String,
    pub bank_account_name: String,
    pub bank_account_number: String,
}

#[derive(Debug, Deserialize)]
pub struct OrderLineIn {
    pub menu_item_id: i64,
    pub qty: i64,
}

#[derive(Debug, Deserialize)]
pub struct NewOrder {
    pub customer_name: String,
    pub customer_phone: String,
    #[serde(default)]
    pub customer_email: String,
    pub order_type: String,
    #[serde(default)]
    pub delivery_address: Option<String>,
    #[serde(default)]
    pub delivery_state: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    pub payment_method: String,
    pub items: Vec<OrderLineIn>,
}

#[derive(Debug, Deserialize)]
pub struct NewCatering {
    pub name: String,
    pub phone: String,
    #[serde(default)]
    pub email: String,
    pub event_date: String,
    pub guest_count: i64,
    pub event_type: String,
    pub location: String,
    #[serde(default)]
    pub budget_kobo: Option<i64>,
    #[serde(default)]
    pub details: Option<String>,
    #[serde(default)]
    pub state: String,
    #[serde(default)]
    pub lga: String,
    #[serde(default)]
    pub street_address: String,
    #[serde(default)]
    pub dishes: Vec<String>,
    #[serde(default)]
    pub other_dishes: String,
    #[serde(default)]
    pub contact_channel: String,
    #[serde(default)]
    pub contact_handle: String,
    #[serde(default = "event_kind")]
    pub job_kind: String,
}

fn event_kind() -> String {
    "event".to_string()
}

#[derive(Debug, Deserialize)]
pub struct Login {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct NewMenuItem {
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub price_kobo: i64,
    pub category_slug: String,
    #[serde(default)]
    pub image_url: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub ingredients: Vec<String>,
    #[serde(default = "yes")]
    pub is_available: bool,
    #[serde(default)]
    pub is_featured: bool,
}

fn yes() -> bool {
    true
}

#[derive(Debug, Deserialize)]
pub struct PatchMenuItem {
    pub name: Option<String>,
    pub description: Option<String>,
    pub price_kobo: Option<i64>,
    pub image_url: Option<String>,
    pub tags: Option<Vec<String>>,
    pub ingredients: Option<Vec<String>>,
    pub is_available: Option<bool>,
    pub is_featured: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct PatchOrder {
    pub status: Option<String>,
    pub payment_status: Option<String>,
}
