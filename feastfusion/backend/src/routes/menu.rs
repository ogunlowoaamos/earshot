use std::collections::HashMap;

use axum::{extract::State, Json};
use sqlx::SqlitePool;

use crate::{
    db,
    error::{AppError, AppResult},
    models::{Category, DeliveryZone, DishOption, MenuItem, MenuRow, OptionGroup, Settings},
    AppState,
};

pub(crate) const MENU_SELECT: &str = "
    SELECT m.id, m.category_id, c.slug AS category_slug, m.name, m.description,
           m.price_kobo, m.image_url, m.tags, m.ingredients, m.is_available, m.is_featured
    FROM menu_items m
    JOIN categories c ON c.id = m.category_id
";

/// A dish reaches the customer only when the caterer switched it on AND put a
/// price on it. A switched-on dish with no price would otherwise sell for zero.
pub(crate) const VISIBLE: &str = "m.is_available = 1 AND m.price_kobo > 0";

pub async fn list_categories(State(state): State<AppState>) -> AppResult<Json<Vec<Category>>> {
    // Only categories that actually hold something orderable, so the customer
    // never sees a filter that leads to an empty shelf.
    let rows = sqlx::query_as::<_, Category>(
        "SELECT c.id, c.name, c.slug, c.description, c.sort_order
         FROM categories c
         WHERE EXISTS (
            SELECT 1 FROM menu_items m
            WHERE m.category_id = c.id AND m.is_available = 1 AND m.price_kobo > 0
         )
         ORDER BY c.sort_order, c.name",
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(rows))
}

pub async fn list_menu(State(state): State<AppState>) -> AppResult<Json<Vec<MenuItem>>> {
    let sql = format!("{MENU_SELECT} WHERE {VISIBLE} ORDER BY c.sort_order, m.sort_order, m.name");
    let rows = sqlx::query_as::<_, MenuRow>(&sql)
        .fetch_all(&state.pool)
        .await?;

    Ok(Json(with_options(&state.pool, rows).await?))
}

/// The whole shelf, including dishes that are switched off or still unpriced.
/// The dashboard curates from this view; customers never see it.
pub(crate) async fn fetch_catalogue(pool: &SqlitePool) -> AppResult<Vec<MenuItem>> {
    let sql = format!("{MENU_SELECT} ORDER BY c.sort_order, m.sort_order, m.name");
    let rows = sqlx::query_as::<_, MenuRow>(&sql).fetch_all(pool).await?;

    with_options(pool, rows).await
}

async fn with_options(pool: &SqlitePool, rows: Vec<MenuRow>) -> AppResult<Vec<MenuItem>> {
    let ids: Vec<i64> = rows.iter().map(|row| row.id).collect();
    let mut groups = options_by_item(pool, &ids).await?;

    Ok(rows
        .into_iter()
        .map(|row| {
            let found = groups.remove(&row.id).unwrap_or_default();
            MenuItem::from(row).with_options(found)
        })
        .collect())
}

/// Loads the choices for many dishes in two queries rather than two per dish.
pub(crate) async fn options_by_item(
    pool: &SqlitePool,
    item_ids: &[i64],
) -> AppResult<HashMap<i64, Vec<OptionGroup>>> {
    let mut grouped: HashMap<i64, Vec<OptionGroup>> = HashMap::new();
    if item_ids.is_empty() {
        return Ok(grouped);
    }

    let marks = vec!["?"; item_ids.len()].join(",");

    let group_sql = format!(
        "SELECT id, menu_item_id, name, kind, help, is_required
         FROM item_option_groups
         WHERE menu_item_id IN ({marks})
         ORDER BY sort_order, id"
    );
    let mut query = sqlx::query_as::<_, (i64, i64, String, String, String, bool)>(&group_sql);
    for id in item_ids {
        query = query.bind(id);
    }
    let group_rows = query.fetch_all(pool).await?;

    if group_rows.is_empty() {
        return Ok(grouped);
    }

    let group_ids: Vec<i64> = group_rows.iter().map(|row| row.0).collect();
    let marks = vec!["?"; group_ids.len()].join(",");

    let option_sql = format!(
        "SELECT group_id, id, label, price_delta_kobo, is_default, is_available
         FROM item_options
         WHERE group_id IN ({marks})
         ORDER BY sort_order, id"
    );
    let mut query = sqlx::query_as::<_, (i64, i64, String, i64, bool, bool)>(&option_sql);
    for id in &group_ids {
        query = query.bind(id);
    }
    let option_rows = query.fetch_all(pool).await?;

    let mut by_group: HashMap<i64, Vec<DishOption>> = HashMap::new();
    for (group_id, id, label, price_delta_kobo, is_default, is_available) in option_rows {
        by_group.entry(group_id).or_default().push(DishOption {
            id,
            label,
            price_delta_kobo,
            is_default,
            is_available,
        });
    }

    for (id, menu_item_id, name, kind, help, is_required) in group_rows {
        grouped.entry(menu_item_id).or_default().push(OptionGroup {
            id,
            name,
            kind,
            help,
            is_required,
            options: by_group.remove(&id).unwrap_or_default(),
        });
    }

    Ok(grouped)
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
    let fee: Option<i64> =
        sqlx::query_scalar("SELECT fee_kobo FROM delivery_zones WHERE state = ? AND is_active = 1")
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

    let mut groups = options_by_item(pool, &[id]).await?;
    Ok(MenuItem::from(row).with_options(groups.remove(&id).unwrap_or_default()))
}
