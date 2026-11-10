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
        BulkAvailability, Catalogue, CategoryApproval, CateringPricing, CateringRequest, Login,
        MenuItem, NewMenuItem, OptionGroupIn, Order, PatchMenuItem, PatchOrder, SaveIngredients,
        SaveOptions, SavePairings,
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

pub async fn list_catalogue(
    headers: HeaderMap,
    State(state): State<AppState>,
) -> AppResult<Json<Catalogue>> {
    require_admin(&headers)?;

    let categories = sqlx::query_as::<_, crate::models::Category>(
        "SELECT id, name, slug, description, sort_order, is_approved
         FROM categories ORDER BY sort_order, name",
    )
    .fetch_all(&state.pool)
    .await?;

    let items = menu::fetch_catalogue(&state.pool).await?;

    Ok(Json(Catalogue { categories, items }))
}

/// Replaces the companion list for one category. The caterer owns this, so the
/// whole list is swapped in one go rather than patched row by row.
pub async fn save_pairings(
    headers: HeaderMap,
    State(state): State<AppState>,
    Json(body): Json<SavePairings>,
) -> AppResult<Json<Value>> {
    require_admin(&headers)?;

    let category_id: Option<i64> =
        sqlx::query_scalar("SELECT id FROM categories WHERE slug = ?")
            .bind(&body.category_slug)
            .fetch_optional(&state.pool)
            .await?;

    let Some(category_id) = category_id else {
        return Err(AppError::BadRequest("Unknown category".into()));
    };

    let mut tx = state.pool.begin().await?;

    sqlx::query("DELETE FROM category_pairings WHERE category_id = ?")
        .bind(category_id)
        .execute(&mut *tx)
        .await?;

    for (index, slug) in body.accompanies.iter().enumerate() {
        // A category cannot accompany itself, and an unknown slug is skipped
        // rather than failing the whole save.
        if slug == &body.category_slug {
            continue;
        }

        sqlx::query(
            "INSERT OR IGNORE INTO category_pairings
                (category_id, accompanies_id, sort_order)
             SELECT ?, id, ? FROM categories WHERE slug = ?",
        )
        .bind(category_id)
        .bind(index as i64)
        .bind(slug)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(Json(json!({ "ok": true })))
}

/// Replaces the ingredient list on one dish. The list is stored one item per
/// line, which is how the dish page reads it back.
pub async fn save_ingredients(
    headers: HeaderMap,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(payload): Json<SaveIngredients>,
) -> AppResult<Json<MenuItem>> {
    require_admin(&headers)?;
    menu::fetch_item(&state.pool, id).await?;

    let lines: Vec<&str> = payload
        .ingredients
        .iter()
        .map(|line| line.trim())
        .filter(|line| !line.is_empty())
        .collect();

    sqlx::query("UPDATE menu_items SET ingredients = ? WHERE id = ?")
        .bind(lines.join("\n"))
        .bind(id)
        .execute(&state.pool)
        .await?;

    Ok(Json(menu::fetch_item(&state.pool, id).await?))
}

/// Replaces every choice group on one dish. Children are deleted by hand
/// because SQLite only cascades when foreign keys are switched on.
pub async fn save_options(
    headers: HeaderMap,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(payload): Json<SaveOptions>,
) -> AppResult<Json<MenuItem>> {
    require_admin(&headers)?;
    menu::fetch_item(&state.pool, id).await?;

    write_groups(&state.pool, id, &payload.groups).await?;

    // A group that reads its choices from a category is filled in here, so the
    // dashboard gets the real list back rather than an empty one.
    menu::sync_derived_groups(&state.pool).await?;

    Ok(Json(menu::fetch_item(&state.pool, id).await?))
}

/// Writes a dish's whole set of choice groups, replacing whatever was there.
/// Shared by the options editor and the add-dish form so a dish created with
/// its questions already chosen is stored exactly like one edited later.
pub async fn write_groups(
    pool: &sqlx::SqlitePool,
    id: i64,
    groups: &[OptionGroupIn],
) -> AppResult<()> {
    let mut tx = pool.begin().await?;

    sqlx::query(
        "DELETE FROM item_options WHERE group_id IN
            (SELECT id FROM item_option_groups WHERE menu_item_id = ?)",
    )
    .bind(id)
    .execute(&mut *tx)
    .await?;

    sqlx::query("DELETE FROM item_option_groups WHERE menu_item_id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    for (group_index, group) in groups.iter().enumerate() {
        let name = group.name.trim();
        if name.is_empty() {
            continue;
        }

        let kind = if group.kind.trim() == "multi" {
            "multi"
        } else {
            "single"
        };

        let group_id: i64 = sqlx::query_scalar(
            "INSERT INTO item_option_groups
                (menu_item_id, name, kind, help, is_required, allows_quantity,
                 source_category_slug, free_text, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             RETURNING id",
        )
        .bind(id)
        .bind(name)
        .bind(kind)
        .bind(group.help.trim())
        .bind(if group.is_required { 1 } else { 0 })
        .bind(if group.allows_quantity { 1 } else { 0 })
        .bind(group.source_category_slug.trim())
        .bind(if group.free_text { 1 } else { 0 })
        .bind(group_index as i64)
        .fetch_one(&mut *tx)
        .await?;

        // A group filled from a category has no list of its own to save; the
        // refresh after this writes its choices from the catalogue.
        if !group.source_category_slug.trim().is_empty() {
            continue;
        }

        for (option_index, option) in group.options.iter().enumerate() {
            let label = option.label.trim();
            if label.is_empty() {
                continue;
            }
            if option.price_delta_kobo < 0 {
                return Err(AppError::BadRequest(
                    "A choice cannot cost less than zero.".into(),
                ));
            }

            sqlx::query(
                "INSERT INTO item_options
                    (group_id, label, price_delta_kobo, is_default, is_available, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?)",
            )
            .bind(group_id)
            .bind(label)
            .bind(option.price_delta_kobo)
            .bind(if option.is_default { 1 } else { 0 })
            .bind(if option.is_available { 1 } else { 0 })
            .bind(option_index as i64)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;
    Ok(())
}

/// The shelf of ready-made groups the dashboard offers as on/off switches.
/// Served from the same templates the catalogue seeds from, so a group the
/// caterer switches on is identical to the one a fresh dish would get.
pub async fn group_library(headers: HeaderMap) -> AppResult<Json<Value>> {
    require_admin(&headers)?;

    let groups: Vec<Value> = crate::catalogue::LIBRARY
        .iter()
        .map(|(key, spec)| {
            json!({
                "key": key,
                "name": spec.name,
                "kind": spec.kind,
                "help": spec.help,
                "is_required": spec.required,
                "allows_quantity": spec.allows_quantity,
                "source_category_slug": spec.source_category,
                "free_text": spec.free_text,
                "options": spec
                    .options
                    .iter()
                    .map(|label| {
                        json!({
                            "label": label,
                            "price_delta_kobo": 0,
                            "is_default": false,
                            "is_available": true,
                        })
                    })
                    .collect::<Vec<Value>>(),
            })
        })
        .collect();

    Ok(Json(json!({ "groups": groups })))
}

/// Puts one category on or off the customer menu. The catalogue comes back so
/// the dashboard can redraw without a second round trip.
pub async fn set_category_approval(
    headers: HeaderMap,
    State(state): State<AppState>,
    Path(slug): Path<String>,
    Json(payload): Json<CategoryApproval>,
) -> AppResult<Json<Catalogue>> {
    require_admin(&headers)?;

    let flag = if payload.is_approved { 1 } else { 0 };

    let result = sqlx::query("UPDATE categories SET is_approved = ? WHERE slug = ?")
        .bind(flag)
        .bind(&slug)
        .execute(&state.pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::BadRequest("Unknown category".into()));
    }

    list_catalogue(headers, State(state)).await
}

/// Switches a whole category, or a shortlist of dishes, on or off at once.
pub async fn set_availability(
    headers: HeaderMap,
    State(state): State<AppState>,
    Json(payload): Json<BulkAvailability>,
) -> AppResult<Json<Catalogue>> {
    require_admin(&headers)?;

    let flag = if payload.is_available { 1 } else { 0 };

    if let Some(slug) = payload
        .category_slug
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        sqlx::query(
            "UPDATE menu_items SET is_available = ?
             WHERE category_id = (SELECT id FROM categories WHERE slug = ?)",
        )
        .bind(flag)
        .bind(slug)
        .execute(&state.pool)
        .await?;
    }

    for id in &payload.item_ids {
        sqlx::query("UPDATE menu_items SET is_available = ? WHERE id = ?")
            .bind(flag)
            .bind(id)
            .execute(&state.pool)
            .await?;
    }

    list_catalogue(headers, State(state)).await
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

    let category_id: Option<i64> = sqlx::query_scalar("SELECT id FROM categories WHERE slug = ?")
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

    let item_id = inserted.last_insert_rowid();

    // The add form can pick the dish's questions up front, so a new dish lands
    // complete. Without them it starts plain and the caterer adds groups later.
    if !payload.groups.is_empty() {
        write_groups(&state.pool, item_id, &payload.groups).await?;
        menu::sync_derived_groups(&state.pool).await?;
    }

    let item = menu::fetch_item(&state.pool, item_id).await?;
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

    let category_id = match patch
        .category_slug
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(slug) => {
            let found: Option<i64> = sqlx::query_scalar("SELECT id FROM categories WHERE slug = ?")
                .bind(slug)
                .fetch_optional(&state.pool)
                .await?;
            match found {
                Some(id) => id,
                None => return Err(AppError::BadRequest("Pick a valid category.".into())),
            }
        }
        None => existing.category_id,
    };

    sqlx::query(
        "UPDATE menu_items
         SET category_id = ?, name = ?, description = ?, price_kobo = ?, image_url = ?, tags = ?,
             ingredients = ?, is_available = ?, is_featured = ?
         WHERE id = ?",
    )
    .bind(category_id)
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
        other => return Err(AppError::BadRequest(format!("Unknown rate kind: {other}"))),
    }

    Ok(Json(pricing::load_pricing(&state.pool).await?))
}
