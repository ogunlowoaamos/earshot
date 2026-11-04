use axum::{extract::State, Json};
use sqlx::SqlitePool;

use crate::{
    db,
    error::{AppError, AppResult},
    models::{Category, DeliveryZone, MenuItem, MenuRow, Settings},
    AppState,
};

pub(crate) const MENU_SELECT: &str = "
    SELECT m.id, m.category_id, c.slug AS category_slug, m.name, m.description,
           m.price_kobo, m.image_url, m.tags, m.is_available, m.is_featured
    FROM menu_items m
    JOIN categories c ON c.id = m.category_id
";

pub async fn list_categories(State(state): State<AppState>) -> AppResult<Json<Vec<Category>>> {
    let rows = sqlx::query_as::<_, Category>(
        "SELECT id, name, slug, description, sort_order FROM categories ORDER BY sort_order, name",
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(rows))
}

pub async fn list_menu(State(state): State<AppState>) -> AppResult<Json<Vec<MenuItem>>> {
    let sql = format!("{MENU_SELECT} ORDER BY c.sort_order, m.name");
    let rows = sqlx::query_as::<_, MenuRow>(&sql)
        .fetch_all(&state.pool)
        .await?;

    Ok(Json(rows.into_iter().map(MenuItem::from).collect()))
}

pub async fn get_settings(State(state): State<AppState>) -> AppResult<Json<Settings>> {
    Ok(Json(db::load_settings(&state.pool).await))
}

pub async fn list_zones(State(state): State<AppState>) -> AppResult<Json<Vec<DeliveryZone>>> {
    let rows = sqlx::query_as::<_, DeliveryZone>(
        "SELECT id, state, fee_kobo, lat, lng, radius_km, is_active
         FROM delivery_zones ORDER BY sort_order, state",
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(rows))
}

/// Fee for a delivery state. Falls back to the configured base fee when the
/// state has no active zone, so adding a state is only ever a data change.
pub(crate) async fn zone_fee(pool: &SqlitePool, state_name: &str) -> AppResult<i64> {
    let fee: Option<i64> = sqlx::query_scalar(
        "SELECT fee_kobo FROM delivery_zones WHERE state = ? AND is_active = 1",
    )
    .bind(state_name)
    .fetch_optional(pool)
    .await?;

    match fee {
        Some(fee) => Ok(fee),
        None => Ok(db::load_settings(pool).await.delivery_fee_kobo),
    }
}

pub(crate) async fn fetch_item(pool: &SqlitePool, id: i64) -> AppResult<MenuItem> {
    let sql = format!("{MENU_SELECT} WHERE m.id = ?");
    let row = sqlx::query_as::<_, MenuRow>(&sql)
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("That dish is no longer on the menu.".to_string()))?;

    Ok(MenuItem::from(row))
}
