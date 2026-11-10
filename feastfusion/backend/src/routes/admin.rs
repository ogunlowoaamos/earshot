use std::path::Path as FsPath;

use axum::{
    extract::{Multipart, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    auth::{issue_token, require_admin, verify_password},
    error::{AppError, AppResult},
    models::{
        self, BulkAvailability, Catalogue, Category, CategoryApproval, CateringPricing,
        CateringRequest, Login, MenuItem, NewCategory, NewMenuItem, OptionGroupIn, Order,
        PatchMenuItem, PatchOrder, SaveIngredients, SaveOptions, SavePairings,
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

/// Adds a shelf the caterer just typed into the Add item form. It goes live
/// straight away, because they asked for it on purpose.
pub async fn create_category(
    headers: HeaderMap,
    State(state): State<AppState>,
    Json(payload): Json<NewCategory>,
) -> AppResult<Json<Category>> {
    require_admin(&headers)?;

    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("Give the category a name.".into()));
    }

    let base = crate::catalogue::slugify(name);
    if base.is_empty() {
        return Err(AppError::BadRequest(
            "Please use letters or numbers in the name.".into(),
        ));
    }

    let taken: Option<(i64,)> = sqlx::query_as("SELECT id FROM categories WHERE name = ?")
        .bind(name)
        .fetch_optional(&state.pool)
        .await?;
    if taken.is_some() {
        return Err(AppError::BadRequest(
            "There is already a category with that name.".into(),
        ));
    }

    // Two different names can slugify the same way, so walk until one is free.
    let mut slug = base.clone();
    let mut attempt = 2;
    loop {
        let clash: Option<(i64,)> = sqlx::query_as("SELECT id FROM categories WHERE slug = ?")
            .bind(&slug)
            .fetch_optional(&state.pool)
            .await?;
        if clash.is_none() {
            break;
        }
        slug = format!("{base}-{attempt}");
        attempt += 1;
    }

    let next_order: (i64,) =
        sqlx::query_as("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories")
            .fetch_one(&state.pool)
            .await?;

    let description = payload.description.trim();
    let description = if description.is_empty() {
        None
    } else {
        Some(description.to_string())
    };

    let id: i64 = sqlx::query_scalar(
        "INSERT INTO categories (name, slug, description, sort_order, is_approved)
         VALUES (?, ?, ?, ?, 1)
         RETURNING id",
    )
    .bind(name)
    .bind(&slug)
    .bind(&description)
    .bind(next_order.0)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(Category {
        id,
        name: name.to_string(),
        slug,
        description,
        sort_order: next_order.0,
        is_approved: true,
    }))
}

/// Every tag already in use, so the tag box can suggest them. Grows by itself
/// as the caterer types new ones.
pub async fn list_tags(
    headers: HeaderMap,
    State(state): State<AppState>,
) -> AppResult<Json<Value>> {
    require_admin(&headers)?;

    let rows: Vec<(String,)> = sqlx::query_as("SELECT tags FROM menu_items")
        .fetch_all(&state.pool)
        .await?;

    let mut seen: Vec<String> = Vec::new();
    for (blob,) in rows {
        for tag in blob.split(',') {
            let tag = tag.trim().to_lowercase();
            if !tag.is_empty() && !seen.contains(&tag) {
                seen.push(tag);
            }
        }
    }
    seen.sort();

    Ok(Json(json!({ "tags": seen })))
}

/// Stores a photo or a video the caterer picked from their computer and hands
/// back the address to put in the dish.
pub async fn upload_media(
    headers: HeaderMap,
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> AppResult<Json<Value>> {
    require_admin(&headers)?;

    const IMAGE_TYPES: &[&str] = &["jpg", "jpeg", "png", "webp", "gif", "svg", "avif"];
    const VIDEO_TYPES: &[&str] = &["mp4", "webm", "mov", "m4v", "ogv"];

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("Upload failed: {e}")))?
    {
        let filename = field.file_name().unwrap_or("upload").to_string();
        let extension = FsPath::new(&filename)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        let is_image = IMAGE_TYPES.contains(&extension.as_str());
        let is_video = VIDEO_TYPES.contains(&extension.as_str());

        if !is_image && !is_video {
            return Err(AppError::BadRequest(
                "Please pick a JPG, PNG, WEBP, GIF, SVG, MP4, WEBM or MOV file.".into(),
            ));
        }

        let bytes = field
            .bytes()
            .await
            .map_err(|e| AppError::BadRequest(format!("Upload failed: {e}")))?;

        if bytes.is_empty() {
            return Err(AppError::BadRequest("That file looks empty.".into()));
        }

        let cap = if is_video {
            60 * 1024 * 1024
        } else {
            8 * 1024 * 1024
        };
        if bytes.len() > cap {
            return Err(AppError::BadRequest(if is_video {
                "Please keep the video under 60MB.".into()
            } else {
                "Please keep the picture under 8MB.".into()
            }));
        }

        let stored_name = format!("{}.{}", Uuid::new_v4().simple(), extension);
        tokio::fs::write(state.uploads.join(&stored_name), &bytes).await?;

        return Ok(Json(json!({
            "url": format!("/uploads/{stored_name}"),
            "kind": if is_video { "video" } else { "image" },
        })));
    }

    Err(AppError::BadRequest("No file was attached.".into()))
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

    // The gallery wins when the form sends one. Otherwise the two older fields
    // are turned into a one- or two-item gallery so every dish has the same
    // shape going forward.
    let (media_json, image_url, video_url) = if payload.media.is_empty() {
        let list = models::parse_media("", &payload.image_url, &payload.video_url);
        models::store_media(&list)
    } else {
        models::store_media(&payload.media)
    };

    let inserted = sqlx::query(
        "INSERT INTO menu_items
            (category_id, name, description, price_kobo, image_url, video_url, media, tags,
             ingredients, is_available, is_featured)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(category_id)
    .bind(name)
    .bind(payload.description.trim())
    .bind(payload.price_kobo)
    .bind(&image_url)
    .bind(&video_url)
    .bind(&media_json)
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

    // Three ways in, in order of preference: a whole new gallery, a change to
    // just the cover picture or just the clip, or nothing at all. Whichever it
    // is, the gallery and the two old columns are written together so they can
    // never drift apart.
    let (media_json, image_url, video_url) = match patch.media {
        Some(list) => models::store_media(&list),
        None => {
            let mut list = existing.media.clone();
            if let Some(new_image) = patch.image_url.as_deref() {
                let new_image = new_image.trim();
                match list.iter_mut().find(|m| m.kind == "image") {
                    Some(slot) => slot.url = new_image.to_string(),
                    None if !new_image.is_empty() => list.insert(
                        0,
                        models::MediaItem {
                            url: new_image.to_string(),
                            kind: "image".to_string(),
                        },
                    ),
                    None => {}
                }
            }
            if let Some(new_video) = patch.video_url.as_deref() {
                let new_video = new_video.trim();
                match list.iter_mut().find(|m| m.kind == "video") {
                    Some(slot) => slot.url = new_video.to_string(),
                    None if !new_video.is_empty() => list.push(models::MediaItem {
                        url: new_video.to_string(),
                        kind: "video".to_string(),
                    }),
                    None => {}
                }
            }
            models::store_media(&list)
        }
    };

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
         SET category_id = ?, name = ?, description = ?, price_kobo = ?, image_url = ?,
             video_url = ?, media = ?, tags = ?, ingredients = ?, is_available = ?,
             is_featured = ?
         WHERE id = ?",
    )
    .bind(category_id)
    .bind(name.trim())
    .bind(description.trim())
    .bind(price_kobo)
    .bind(&image_url)
    .bind(&video_url)
    .bind(&media_json)
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
