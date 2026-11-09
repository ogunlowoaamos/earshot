use std::collections::HashMap;

use axum::{extract::State, Json};
use sqlx::SqlitePool;

use crate::{
    db,
    error::{AppError, AppResult},
    models::{Category, DeliveryZone, DishOption, MenuItem, MenuRow, OptionGroup, Pairing, Settings},
    AppState,
};

pub(crate) const MENU_SELECT: &str = "
    SELECT m.id, m.category_id, c.slug AS category_slug, m.name, m.description,
           m.price_kobo, m.image_url, m.tags, m.ingredients, m.is_available, m.is_featured
    FROM menu_items m
    JOIN categories c ON c.id = m.category_id
";

/// A dish reaches the customer only when the caterer switched it on, put a
/// price on it, and left its category on the customer menu. A switched-on dish
/// with no price would otherwise sell for zero, and a dish in a hidden category
/// would leak a section the caterer has not finished.
pub(crate) const VISIBLE: &str =
    "m.is_available = 1 AND m.price_kobo > 0 AND c.is_approved = 1";

pub async fn list_categories(State(state): State<AppState>) -> AppResult<Json<Vec<Category>>> {
    // Only the categories the caterer has approved. A category that is still
    // being built, or one whose dishes are all switched off, stays off the
    // customer menu until someone deliberately puts it on.
    let rows = sqlx::query_as::<_, Category>(
        "SELECT c.id, c.name, c.slug, c.description, c.sort_order, c.is_approved
         FROM categories c
         WHERE c.is_approved = 1
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

/// Every "what goes with what" rule the caterer has set, written with slugs.
pub async fn list_pairings(State(state): State<AppState>) -> AppResult<Json<Vec<Pairing>>> {
    let rows = sqlx::query_as::<_, Pairing>(
        "SELECT a.slug AS category_slug, b.slug AS accompanies_slug
         FROM category_pairings p
         JOIN categories a ON a.id = p.category_id
         JOIN categories b ON b.id = p.accompanies_id
         ORDER BY a.sort_order, p.sort_order, b.sort_order",
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(rows))
}

/// The whole shelf, including dishes that are switched off or still unpriced.
/// The dashboard curates from this view; customers never see it.
pub(crate) async fn fetch_catalogue(pool: &SqlitePool) -> AppResult<Vec<MenuItem>> {
    let sql = format!("{MENU_SELECT} ORDER BY c.sort_order, m.sort_order, m.name");
    let rows = sqlx::query_as::<_, MenuRow>(&sql).fetch_all(pool).await?;

    with_options(pool, rows).await
}

async fn with_options(pool: &SqlitePool, rows: Vec<MenuRow>) -> AppResult<Vec<MenuItem>> {
    sync_derived_groups(pool).await?;

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
        "SELECT id, menu_item_id, name, kind, help, is_required, allows_quantity,
                source_category_slug, free_text
         FROM item_option_groups
         WHERE menu_item_id IN ({marks})
         ORDER BY sort_order, id"
    );
    let mut query = sqlx::query_as::<_, (i64, i64, String, String, String, bool, bool, String, bool)>(
        &group_sql,
    );
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

    for (
        id,
        menu_item_id,
        name,
        kind,
        help,
        is_required,
        allows_quantity,
        source_category_slug,
        free_text,
    ) in group_rows
    {
        grouped.entry(menu_item_id).or_default().push(OptionGroup {
            id,
            name,
            kind,
            help,
            is_required,
            allows_quantity,
            source_category_slug,
            free_text,
            options: by_group.remove(&id).unwrap_or_default(),
        });
    }

    Ok(grouped)
}

/// Fills in every group that reads its choices from a category.
///
/// The caterer keeps one chop list, in the catalogue. A platter that offers
/// chops points at that category instead of holding a second copy, so a chop
/// added, renamed, repriced or switched off in the dashboard reaches the
/// customer without anyone retyping a list. Rows are updated in place so a
/// choice keeps its id and a basket already holding it stays valid.
pub(crate) async fn sync_derived_groups(pool: &SqlitePool) -> AppResult<()> {
    let derived = sqlx::query_as::<_, (i64, String)>(
        "SELECT id, source_category_slug FROM item_option_groups
         WHERE source_category_slug <> ''",
    )
    .fetch_all(pool)
    .await?;

    if derived.is_empty() {
        return Ok(());
    }

    for (group_id, slug) in derived {
        // The dish that owns the group is left out, so a platter never offers
        // itself as one of its own chops.
        let owner: i64 = sqlx::query_scalar(
            "SELECT menu_item_id FROM item_option_groups WHERE id = ?",
        )
        .bind(group_id)
        .fetch_one(pool)
        .await?;

        // Every dish in the category is read, switched off ones included, so a
        // chop the caterer pauses keeps its place and its id. The customer only
        // sees the ones that are on offer today.
        let dishes = sqlx::query_as::<_, (i64, String, bool)>(
            "SELECT m.id, m.name, m.is_available
             FROM menu_items m
             JOIN categories c ON c.id = m.category_id
             WHERE c.slug = ? AND m.id <> ?
             ORDER BY m.sort_order, m.name",
        )
        .bind(&slug)
        .bind(owner)
        .fetch_all(pool)
        .await?;

        let mut tx = pool.begin().await?;

        let keep: Vec<i64> = dishes.iter().map(|(id, _, _)| *id).collect();
        let marks = vec!["?"; keep.len()].join(",");

        // Anything no longer in the category goes, along with the choices that
        // pointed at it. A dish that is merely switched off is kept but hidden,
        // so switching it back on restores the same choice.
        if keep.is_empty() {
            sqlx::query("DELETE FROM item_options WHERE group_id = ?")
                .bind(group_id)
                .execute(&mut *tx)
                .await?;
        } else {
            let sql = format!(
                "DELETE FROM item_options
                 WHERE group_id = ? AND source_item_id > 0 AND source_item_id NOT IN ({marks})"
            );
            let mut query = sqlx::query(&sql).bind(group_id);
            for id in &keep {
                query = query.bind(id);
            }
            query.execute(&mut *tx).await?;
        }

        // A chop is part of the platter, not an extra, so it carries no price of
        // its own. The dish price is the price of a whole portion and would be
        // wrong here.
        for (index, (item_id, name, is_available)) in dishes.iter().enumerate() {
            sqlx::query(
                "INSERT INTO item_options
                    (group_id, label, price_delta_kobo, is_default, is_available,
                     source_item_id, sort_order)
                 VALUES (?, ?, 0, 0, ?, ?, ?)
                 ON CONFLICT (group_id, source_item_id) WHERE source_item_id > 0 DO UPDATE SET
                    label = excluded.label,
                    price_delta_kobo = 0,
                    is_available = excluded.is_available,
                    sort_order = excluded.sort_order",
            )
            .bind(group_id)
            .bind(name)
            .bind(is_available)
            .bind(item_id)
            .bind(index as i64)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
    }

    Ok(())
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
    sync_derived_groups(pool).await?;

    let sql = format!("{MENU_SELECT} WHERE m.id = ?");
    let row = sqlx::query_as::<_, MenuRow>(&sql)
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("That dish is no longer on the menu.".to_string()))?;

    let mut groups = options_by_item(pool, &[id]).await?;
    Ok(MenuItem::from(row).with_options(groups.remove(&id).unwrap_or_default()))
}
