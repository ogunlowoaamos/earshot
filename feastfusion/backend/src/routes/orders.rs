use std::path::Path as FsPath;

use axum::{
    extract::{Multipart, Path, State},
    http::StatusCode,
    Json,
};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::{NewOrder, Order, OrderLine, OrderRow},
    notify, AppState,
};

const ORDER_COLUMNS: &str = "
    id, reference, customer_name, customer_phone, customer_email, order_type,
    delivery_address, delivery_state, notes, subtotal_kobo, delivery_fee_kobo, total_kobo,
    payment_method, payment_status, proof_url, status, created_at
";

pub(crate) fn new_reference(prefix: &str) -> String {
    let tail = Uuid::new_v4().simple().to_string()[..6].to_uppercase();
    format!("{prefix}-{tail}")
}

pub(crate) async fn lines_for(pool: &SqlitePool, order_id: i64) -> AppResult<Vec<OrderLine>> {
    let rows = sqlx::query_as::<_, (String, i64, i64)>(
        "SELECT name, quantity, unit_price_kobo FROM order_items WHERE order_id = ? ORDER BY id",
    )
    .bind(order_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|(name, qty, unit_price_kobo)| OrderLine {
            name,
            qty,
            unit_price_kobo,
        })
        .collect())
}

pub(crate) async fn fetch_by_reference(pool: &SqlitePool, reference: &str) -> AppResult<Order> {
    let sql = format!("SELECT {ORDER_COLUMNS} FROM orders WHERE reference = ?");
    let row = sqlx::query_as::<_, OrderRow>(&sql)
        .bind(reference)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("We couldn't find an order with that reference.".into()))?;

    let items = lines_for(pool, row.id).await?;
    Ok(Order { row, items })
}

pub(crate) async fn fetch_by_id(pool: &SqlitePool, id: i64) -> AppResult<Order> {
    let sql = format!("SELECT {ORDER_COLUMNS} FROM orders WHERE id = ?");
    let row = sqlx::query_as::<_, OrderRow>(&sql)
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("That order no longer exists.".into()))?;

    let items = lines_for(pool, row.id).await?;
    Ok(Order { row, items })
}

pub(crate) async fn fetch_all(pool: &SqlitePool) -> AppResult<Vec<Order>> {
    let sql = format!("SELECT {ORDER_COLUMNS} FROM orders ORDER BY created_at DESC, id DESC");
    let rows = sqlx::query_as::<_, OrderRow>(&sql).fetch_all(pool).await?;

    let mut orders = Vec::with_capacity(rows.len());
    for row in rows {
        let items = lines_for(pool, row.id).await?;
        orders.push(Order { row, items });
    }

    Ok(orders)
}

pub async fn create_order(
    State(state): State<AppState>,
    Json(payload): Json<NewOrder>,
) -> AppResult<(StatusCode, Json<Order>)> {
    let name = payload.customer_name.trim();
    let phone = payload.customer_phone.trim();

    if name.len() < 2 {
        return Err(AppError::BadRequest("Please enter your full name.".into()));
    }
    if phone.chars().filter(|c| c.is_ascii_digit()).count() < 7 {
        return Err(AppError::BadRequest(
            "Please enter a phone number we can reach you on.".into(),
        ));
    }
    if payload.items.is_empty() {
        return Err(AppError::BadRequest("Your basket is empty.".into()));
    }
    if !matches!(payload.order_type.as_str(), "delivery" | "pickup") {
        return Err(AppError::BadRequest("Choose delivery or pickup.".into()));
    }
    if !matches!(
        payload.payment_method.as_str(),
        "online" | "transfer" | "on_delivery"
    ) {
        return Err(AppError::BadRequest("Choose a payment method.".into()));
    }

    let delivery_state = payload
        .delivery_state
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);

    let delivery_fee_kobo = if payload.order_type == "delivery" {
        let address = payload.delivery_address.clone().unwrap_or_default();
        if address.trim().len() < 6 {
            return Err(AppError::BadRequest(
                "Please give us a delivery address with a landmark.".into(),
            ));
        }
        let Some(state_name) = delivery_state.as_deref() else {
            return Err(AppError::BadRequest(
                "Choose the state we are delivering to.".into(),
            ));
        };
        let active: Option<i64> = sqlx::query_scalar(
            "SELECT 1 FROM delivery_zones WHERE state = ? AND is_active = 1",
        )
        .bind(state_name)
        .fetch_optional(&state.pool)
        .await?;
        if active.is_none() {
            return Err(AppError::BadRequest(
                "We do not deliver to that state yet. Pick one of the live states.".into(),
            ));
        }
        super::menu::zone_fee(&state.pool, state_name).await?
    } else {
        0
    };

    let mut tx = state.pool.begin().await?;
    let mut subtotal_kobo: i64 = 0;
    let mut lines: Vec<(i64, String, i64, i64)> = Vec::new();

    for line in &payload.items {
        if line.qty <= 0 || line.qty > 99 {
            return Err(AppError::BadRequest("That quantity isn't valid.".into()));
        }

        let found = sqlx::query_as::<_, (i64, String, i64, i64)>(
            "SELECT id, name, price_kobo, is_available FROM menu_items WHERE id = ?",
        )
        .bind(line.menu_item_id)
        .fetch_optional(&mut *tx)
        .await?;

        let Some((id, item_name, price_kobo, is_available)) = found else {
            return Err(AppError::BadRequest(
                "One of the dishes is no longer on the menu.".into(),
            ));
        };

        if is_available == 0 {
            return Err(AppError::BadRequest(format!(
                "{item_name} is sold out right now."
            )));
        }

        subtotal_kobo += price_kobo * line.qty;
        lines.push((id, item_name, price_kobo, line.qty));
    }

    let total_kobo = subtotal_kobo + delivery_fee_kobo;
    let reference = new_reference("FF");
    let email = payload.customer_email.trim().to_string();
    let notes = payload
        .notes
        .as_ref()
        .map(|n| n.trim().to_string())
        .filter(|n| !n.is_empty());
    let address = payload
        .delivery_address
        .as_ref()
        .map(|a| a.trim().to_string())
        .filter(|a| !a.is_empty());

    let inserted = sqlx::query(
        "INSERT INTO orders
            (reference, customer_name, customer_phone, customer_email, order_type,
             delivery_address, delivery_state, notes, subtotal_kobo, delivery_fee_kobo, total_kobo,
             payment_method, payment_status, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending')",
    )
    .bind(&reference)
    .bind(name)
    .bind(phone)
    .bind(&email)
    .bind(&payload.order_type)
    .bind(&address)
    .bind(&delivery_state)
    .bind(&notes)
    .bind(subtotal_kobo)
    .bind(delivery_fee_kobo)
    .bind(total_kobo)
    .bind(&payload.payment_method)
    .execute(&mut *tx)
    .await?;

    let order_id = inserted.last_insert_rowid();

    for (menu_item_id, item_name, unit_price_kobo, qty) in &lines {
        sqlx::query(
            "INSERT INTO order_items (order_id, menu_item_id, name, unit_price_kobo, quantity)
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind(order_id)
        .bind(menu_item_id)
        .bind(item_name)
        .bind(unit_price_kobo)
        .bind(qty)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    let order = fetch_by_id(&state.pool, order_id).await?;
    notify::dispatch(
        format!("New FeastFusion order {}", order.row.reference),
        notify::order_text(&order),
    );

    Ok((StatusCode::CREATED, Json(order)))
}

pub async fn get_order(
    State(state): State<AppState>,
    Path(reference): Path<String>,
) -> AppResult<Json<Order>> {
    Ok(Json(fetch_by_reference(&state.pool, &reference).await?))
}

pub async fn upload_proof(
    State(state): State<AppState>,
    Path(reference): Path<String>,
    mut multipart: Multipart,
) -> AppResult<Json<Order>> {
    let existing = fetch_by_reference(&state.pool, &reference).await?;

    let mut saved_url: Option<String> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("Upload failed: {e}")))?
    {
        if field.name() != Some("proof") {
            continue;
        }

        let filename = field.file_name().unwrap_or("proof.jpg").to_string();
        let extension = FsPath::new(&filename)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("jpg")
            .to_lowercase();

        if !["jpg", "jpeg", "png", "webp", "gif", "pdf", "heic"].contains(&extension.as_str()) {
            return Err(AppError::BadRequest(
                "Please upload a JPG, PNG, WEBP or PDF file.".into(),
            ));
        }

        let bytes = field
            .bytes()
            .await
            .map_err(|e| AppError::BadRequest(format!("Upload failed: {e}")))?;

        if bytes.is_empty() {
            return Err(AppError::BadRequest("That file looks empty.".into()));
        }
        if bytes.len() > 8 * 1024 * 1024 {
            return Err(AppError::BadRequest(
                "Please keep the receipt under 8MB.".into(),
            ));
        }

        let stored_name = format!("{}.{}", Uuid::new_v4().simple(), extension);
        tokio::fs::write(state.uploads.join(&stored_name), &bytes).await?;
        saved_url = Some(format!("/uploads/{stored_name}"));
    }

    let Some(proof_url) = saved_url else {
        return Err(AppError::BadRequest("No file was attached.".into()));
    };

    sqlx::query(
        "UPDATE orders
         SET proof_url = ?, payment_status = 'proof_uploaded', updated_at = datetime('now')
         WHERE id = ?",
    )
    .bind(&proof_url)
    .bind(existing.row.id)
    .execute(&state.pool)
    .await?;

    let order = fetch_by_id(&state.pool, existing.row.id).await?;
    notify::dispatch(
        format!("Payment proof uploaded for {}", order.row.reference),
        notify::order_text(&order),
    );

    Ok(Json(order))
}
