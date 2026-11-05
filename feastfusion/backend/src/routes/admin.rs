use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};

use crate::{
    auth::{issue_token, require_admin, verify_password},
    error::{AppError, AppResult},
    models::{
        CateringPricing, CateringRequest, Login, MenuItem, NewMenuItem, Order, PatchMenuItem,
        PatchOrder,
    },
    pricing,
    routes::{catering, menu, orders},
    AppState,
};

const ORDER_STATUSES: &[&str] = &[
    "pending",
    "confirmed",
    "preparing",
    "out_for_delivery",
    "completed",
    "cancelled",
];

const PAYMENT_STATUSES: &[&str] = &["pending", "proof_uploaded", "paid", "failed", "refunded"];

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<Login>,
) -> AppResult<Json<Value>> {
    let username = payload.username.trim();

    let record: Option<(i64, String)> =
        sqlx::query_as("SELECT id, password_hash FROM admin_users WHERE username = ?")
            .bind(username)
            .fetch_optional(&state.pool)
            .await?;

    let Some((_, hash)) = record else {
        return Err(AppError::Unauthorized);
    };

    if !verify_password(&payload.password, &hash) {
        return Err(AppError::Unauthorized);
    }

    let token = issue_token(username)?;
    Ok(Json(json!({ "token": token })))
}

pub async fn list_orders(
    headers: HeaderMap,
    State(state): State<AppState>,
) -> AppResult<Json<Vec<Order>>> {
    require_admin(&headers)?;
    Ok(Json(orders::fetch_all(&state.pool).await?))
}

pub async fn update_order(
    headers: HeaderMap,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(patch): Json<PatchOrder>,
) -> AppResult<Json<Order>> {
    require_admin(&headers)?;

    let existing = orders::fetch_by_id(&state.pool, id).await?;

    let status = match patch.status {
        Some(value) => {
            if !ORDER_STATUSES.contains(&value.as_str()) {
                return Err(AppError::BadRequest("Unknown order status.".into()));
            }
            value
        }
        None => existing.row.status.clone(),
    };

    let payment_status = match patch.payment_status {
        Some(value) => {
            if !PAYMENT_STATUSES.contains(&value.as_str()) {
                return Err(AppError::BadRequest("Unknown payment status.".into()));
            }
            value
        }
        None => existing.row.payment_status.clone(),
    };

    sqlx::query(
        "UPDATE orders SET status = ?, payment_status = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(&status)
    .bind(&payment_status)
    .bind(id)
    .execute(&state.pool)
    .await?;

    Ok(Json(orders::fetch_by_id(&state.pool, id).await?))
}

pub async fn list_catering(
    headers: HeaderMap,
    State(state): State<AppState>,
) -> AppResult<Json<Vec<CateringRequest>>> {
    require_admin(&headers)?;
    Ok(Json(catering::fetch_all(&state.pool).await?))
}

pub async fn create_menu_item(
    headers: HeaderMap,
    State(state): State<AppState>,
    Json(payload): Json<NewMenuItem>,
) -> AppResult<(StatusCode, Json<MenuItem>)> {
    require_admin(&headers)?;

    let name = payload.name.trim();
    if name.len() < 2 {
        return Err(AppError::BadRequest("Give the dish a name.".into()));
    }
    if payload.price_kobo <= 0 {
        return Err(AppError::BadRequest("Set a price above zero.".into()));
    }

    let category_id: Option<i64> =
        sqlx::query_scalar("SELECT id FROM categories WHERE slug = ?")
            .bind(payload.category_slug.trim())
            .fetch_optional(&state.pool)
            .await?;

    let Some(category_id) = category_id else {
        return Err(AppError::BadRequest("Pick a valid category.".into()));
    };

    let inserted = sqlx::query(
        "INSERT INTO menu_items
            (category_id, name, description, price_kobo, image_url, tags, ingredients,
             is_available, is_featured)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(category_id)
    .bind(name)
    .bind(payload.description.trim())
    .bind(payload.price_kobo)
    .bind(payload.image_url.trim())
    .bind(payload.tags.join(", "))
    .bind(payload.ingredients.join("\n"))
    .bind(if payload.is_available { 1 } else { 0 })
    .bind(if payload.is_featured { 1 } else { 0 })
    .execute(&state.pool)
    .await?;

    let item = menu::fetch_item(&state.pool, inserted.last_insert_rowid()).await?;
    Ok((StatusCode::CREATED, Json(item)))
}

pub async fn update_menu_item(
    headers: HeaderMap,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(patch): Json<PatchMenuItem>,
) -> AppResult<Json<MenuItem>> {
    require_admin(&headers)?;
    let existing = menu::fetch_item(&state.pool, id).await?;

    let name = patch.name.unwrap_or(existing.name);
    let description = patch.description.unwrap_or(existing.description);
    let price_kobo = patch.price_kobo.unwrap_or(existing.price_kobo);
    let image_url = patch.image_url.unwrap_or(existing.image_url);
    let tags = patch
        .tags
        .map(|t| t.join(", "))
        .unwrap_or_else(|| existing.tags.join(", "));
    let ingredients = patch
        .ingredients
        .map(|i| i.join("\n"))
        .unwrap_or_else(|| existing.ingredients.join("\n"));
    let is_available = patch.is_available.unwrap_or(existing.is_available);
    let is_featured = patch.is_featured.unwrap_or(existing.is_featured);

    if price_kobo < 0 {
        return Err(AppError::BadRequest("Price cannot be negative.".into()));
    }

    sqlx::query(
        "UPDATE menu_items
         SET name = ?, description = ?, price_kobo = ?, image_url = ?, tags = ?,
             ingredients = ?, is_available = ?, is_featured = ?
         WHERE id = ?",
    )
    .bind(name.trim())
    .bind(description.trim())
    .bind(price_kobo)
    .bind(image_url.trim())
    .bind(tags)
    .bind(ingredients)
    .bind(if is_available { 1 } else { 0 })
    .bind(if is_featured { 1 } else { 0 })
    .bind(id)
    .execute(&state.pool)
    .await?;

    Ok(Json(menu::fetch_item(&state.pool, id).await?))
}

pub async fn delete_menu_item(
    headers: HeaderMap,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> AppResult<StatusCode> {
    require_admin(&headers)?;

    let removed = sqlx::query("DELETE FROM menu_items WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await?;

    if removed.rows_affected() == 0 {
        return Err(AppError::NotFound("That dish is already gone.".into()));
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_pricing(
    headers: HeaderMap,
    State(state): State<AppState>,
) -> AppResult<Json<CateringPricing>> {
    require_admin(&headers)?;
    Ok(Json(pricing::load_pricing(&state.pool).await?))
}

/// Saves one row of the price list. The dashboard sends the whole row back, so
/// a single endpoint covers event rates, dish uplifts and cook-only rates.
pub async fn save_rate(
    headers: HeaderMap,
    State(state): State<AppState>,
    Path(kind): Path<String>,
    Json(body): Json<Value>,
) -> AppResult<Json<CateringPricing>> {
    require_admin(&headers)?;

    let key = body
        .get("key")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|k| !k.is_empty())
        .ok_or_else(|| AppError::BadRequest("Which rate is this?".into()))?;

    let amount = body
        .get("amount_kobo")
        .and_then(Value::as_i64)
        .ok_or_else(|| AppError::BadRequest("Enter an amount.".into()))?;

    if amount < 0 {
        return Err(AppError::BadRequest("Amount cannot be negative.".into()));
    }

    let note = body
        .get("note")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();

    match kind.as_str() {
        "event" => {
            sqlx::query(
                "INSERT INTO catering_rates (event_type, rate_kobo, note)
                 VALUES (?, ?, ?)
                 ON CONFLICT(event_type) DO UPDATE SET
                    rate_kobo = excluded.rate_kobo,
                    note = excluded.note",
            )
            .bind(key)
            .bind(amount)
            .bind(&note)
            .execute(&state.pool)
            .await?;
        }
        "dish" => {
            sqlx::query(
                "INSERT INTO catering_dish_rates (category_slug, uplift_kobo, note)
                 VALUES (?, ?, ?)
                 ON CONFLICT(category_slug) DO UPDATE SET
                    uplift_kobo = excluded.uplift_kobo,
                    note = excluded.note",
            )
            .bind(key)
            .bind(amount)
            .bind(&note)
            .execute(&state.pool)
            .await?;
        }
        "cook" => {
            sqlx::query(
                "INSERT INTO catering_cook_rates (category_slug, rate_kobo, note)
                 VALUES (?, ?, ?)
                 ON CONFLICT(category_slug) DO UPDATE SET
                    rate_kobo = excluded.rate_kobo,
                    note = excluded.note",
            )
            .bind(key)
            .bind(amount)
            .bind(&note)
            .execute(&state.pool)
            .await?;
        }
        other => {
            return Err(AppError::BadRequest(format!(
                "Unknown rate kind: {other}"
            )))
        }
    }

    Ok(Json(pricing::load_pricing(&state.pool).await?))
}
