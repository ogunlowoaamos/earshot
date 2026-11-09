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
    models::{NewOrder, Order, OrderLine, OrderRow, PickedOptionIn},
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

/// Options are stored on one line so a printed receipt stays readable, and read
/// back as a list so the app can show them as chips.
pub(crate) const OPTION_SEP: &str = " | ";

pub(crate) fn split_options(text: &str) -> Vec<String> {
    text.split(OPTION_SEP)
        .map(|part| part.trim().to_string())
        .filter(|part| !part.is_empty())
        .collect()
}

/// One choice with how many of it were asked for. Groups that count pieces can
/// hold more than one; everything else stays at one. `text` holds the customer's
/// own words when the group asked them to type an answer.
#[derive(Debug, Clone)]
pub(crate) struct Pick {
    pub option_id: i64,
    pub qty: i64,
    pub text: String,
}

/// The order form sends ids for a plain choice and `{option_id, qty}` when the
/// group counts pieces. Both are folded into one list here so the rest of the
/// pricing does not care which shape arrived.
pub(crate) fn merge_picks(ids: &[i64], counted: &[PickedOptionIn]) -> Vec<Pick> {
    let mut merged: Vec<Pick> = Vec::new();

    for id in ids {
        if !merged.iter().any(|pick| pick.option_id == *id) {
            merged.push(Pick {
                option_id: *id,
                qty: 1,
                text: String::new(),
            });
        }
    }

    for pick in counted {
        let qty = pick.qty.max(1);
        let text = pick.text.trim().to_string();
        match merged
            .iter_mut()
            .find(|existing| existing.option_id == pick.option_id)
        {
            Some(slot) => {
                slot.qty = slot.qty.max(qty);
                if !text.is_empty() {
                    slot.text = text;
                }
            }
            None => merged.push(Pick {
                option_id: pick.option_id,
                qty,
                text,
            }),
        }
    }

    merged
}

/// Checks the choices a customer picked against what the caterer actually
/// offers, and returns the extra cost plus the labels for the receipt.
async fn price_options(
    conn: &mut sqlx::SqliteConnection,
    item_id: i64,
    item_name: &str,
    picks: &[Pick],
) -> AppResult<(i64, String)> {
    let groups = sqlx::query_as::<_, (i64, String, String, bool, bool, bool)>(
        "SELECT id, name, kind, is_required, allows_quantity, free_text
         FROM item_option_groups
         WHERE menu_item_id = ? ORDER BY sort_order, id",
    )
    .bind(item_id)
    .fetch_all(&mut *conn)
    .await?;
    if groups.is_empty() {
        if picks.is_empty() {
            return Ok((0, String::new()));
        }
        return Err(AppError::BadRequest(format!(
            "{item_name} does not come with choices to pick."
        )));
    }

    let mut extra_kobo = 0i64;
    let mut labels: Vec<String> = Vec::new();
    let mut used: Vec<i64> = Vec::new();

    for (group_id, group_name, kind, is_required, allows_quantity, free_text) in &groups {
        let options = sqlx::query_as::<_, (i64, String, i64, bool)>(
            "SELECT id, label, price_delta_kobo, is_available FROM item_options
             WHERE group_id = ? ORDER BY sort_order, id",
        )
        .bind(group_id)
        .fetch_all(&mut *conn)
        .await?;

        let mut in_group = 0;
        for (option_id, label, price_delta_kobo, is_available) in options {
            let Some(pick) = picks.iter().find(|pick| pick.option_id == option_id) else {
                continue;
            };
            if !is_available {
                return Err(AppError::BadRequest(format!(
                    "{label} is not available right now."
                )));
            }
            // A count only means something in a group that counts pieces.
            let qty = if *allows_quantity {
                pick.qty.clamp(1, 99)
            } else {
                1
            };
            in_group += 1;
            used.push(option_id);
            extra_kobo += price_delta_kobo * qty;

            // The customer's own words go on the receipt next to the choice, so
            // the kitchen reads "Custom (a big bowl for four)".
            let mut shown = if qty > 1 {
                format!("{qty} × {label}")
            } else {
                label
            };
            if *free_text && !pick.text.is_empty() {
                shown = format!("{shown} ({})", pick.text);
            }
            labels.push(shown);
        }

        if kind.as_str() == "single" && in_group > 1 {
            return Err(AppError::BadRequest(format!(
                "Pick only one {group_name} for {item_name}."
            )));
        }
        if *is_required && in_group == 0 {
            return Err(AppError::BadRequest(format!(
                "Choose a {group_name} for {item_name}."
            )));
        }
    }

    if used.len() != picks.len() {
        return Err(AppError::BadRequest(format!(
            "One of the choices for {item_name} is no longer offered."
        )));
    }

    Ok((extra_kobo, labels.join(OPTION_SEP)))
}

pub(crate) async fn lines_for(pool: &SqlitePool, order_id: i64) -> AppResult<Vec<OrderLine>> {
    let rows = sqlx::query_as::<_, (String, i64, i64, String, String)>(
        "SELECT name, quantity, unit_price_kobo, options_text, note FROM order_items \
         WHERE order_id = ? ORDER BY id",
    )
    .bind(order_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(
            |(name, qty, unit_price_kobo, options_text, note)| OrderLine {
                name,
                qty,
                unit_price_kobo,
                options: split_options(&options_text),
                note,
            },
        )
        .collect())
}

pub(crate) async fn fetch_by_reference(pool: &SqlitePool, reference: &str) -> AppResult<Order> {
    let sql = format!("SELECT {ORDER_COLUMNS} FROM orders WHERE reference = ?");
    let row = sqlx::query_as::<_, OrderRow>(&sql)
        .bind(reference)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| {
            AppError::NotFound("We couldn't find an order with that reference.".into())
        })?;

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

    // A chop list that reads from the catalogue is refreshed before pricing, so
    // a chop the caterer switched off after the basket was filled is caught
    // here rather than sold.
    super::menu::sync_derived_groups(&state.pool).await?;
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
        let active: Option<i64> =
            sqlx::query_scalar("SELECT 1 FROM delivery_zones WHERE state = ? AND is_active = 1")
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
    let mut lines: Vec<(i64, String, i64, i64, String, String)> = Vec::new();

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

        if price_kobo <= 0 {
            return Err(AppError::BadRequest(format!(
                "{item_name} is not priced yet, so we cannot take the order."
            )));
        }

        let picks = merge_picks(&line.option_ids, &line.options);
        let (extra_kobo, options_text) =
            price_options(&mut tx, id, &item_name, &picks).await?;

        let unit_price_kobo = price_kobo + extra_kobo;
        let note = line
            .note
            .as_deref()
            .map(str::trim)
            .unwrap_or_default()
            .to_string();

        subtotal_kobo += unit_price_kobo * line.qty;
        lines.push((id, item_name, unit_price_kobo, line.qty, options_text, note));
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

    for (menu_item_id, item_name, unit_price_kobo, qty, options_text, note) in &lines {
        sqlx::query(
            "INSERT INTO order_items
                (order_id, menu_item_id, name, unit_price_kobo, quantity, options_text, note)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(order_id)
        .bind(menu_item_id)
        .bind(item_name)
        .bind(unit_price_kobo)
        .bind(qty)
        .bind(options_text)
        .bind(note)
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
