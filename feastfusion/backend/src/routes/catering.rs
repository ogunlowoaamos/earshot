use axum::{extract::State, http::StatusCode, Json};

use crate::{
    db,
    error::{AppError, AppResult},
    models::{CateringRequest, NewCatering},
    notify,
    routes::orders::new_reference,
    AppState,
};

const CATERING_COLUMNS: &str = "
    id, reference, customer_name, customer_phone, customer_email, event_date,
    guest_count, event_type, location, budget_kobo, details, status, created_at
";

pub async fn create_catering(
    State(state): State<AppState>,
    Json(payload): Json<NewCatering>,
) -> AppResult<(StatusCode, Json<CateringRequest>)> {
    let name = payload.name.trim();
    let phone = payload.phone.trim();
    let location = payload.location.trim();
    let event_type = payload.event_type.trim();
    let event_date = payload.event_date.trim();

    if name.len() < 2 {
        return Err(AppError::BadRequest("Please enter your full name.".into()));
    }
    if phone.chars().filter(|c| c.is_ascii_digit()).count() < 7 {
        return Err(AppError::BadRequest(
            "Please enter a phone number we can reach you on.".into(),
        ));
    }
    if event_type.is_empty() {
        return Err(AppError::BadRequest("What kind of event is it?".into()));
    }
    if event_date.is_empty() {
        return Err(AppError::BadRequest("When is the event?".into()));
    }
    if payload.guest_count <= 0 {
        return Err(AppError::BadRequest("How many guests are you feeding?".into()));
    }
    if location.len() < 3 {
        return Err(AppError::BadRequest("Where is the event holding?".into()));
    }

    let settings = db::load_settings(&state.pool).await;
    let reference = new_reference("CAT");
    let email = payload.email.trim().to_string();
    let details = payload
        .details
        .as_ref()
        .map(|d| d.trim().to_string())
        .filter(|d| !d.is_empty());

    let inserted = sqlx::query(
        "INSERT INTO catering_requests
            (reference, customer_name, customer_phone, customer_email, event_type,
             event_date, guest_count, location, budget_kobo, details, deposit_kobo,
             deposit_status, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending')",
    )
    .bind(&reference)
    .bind(name)
    .bind(phone)
    .bind(&email)
    .bind(event_type)
    .bind(event_date)
    .bind(payload.guest_count)
    .bind(location)
    .bind(payload.budget_kobo)
    .bind(&details)
    .bind(settings.catering_deposit_kobo)
    .execute(&state.pool)
    .await?;

    let id = inserted.last_insert_rowid();
    let request = fetch_by_id(&state.pool, id).await?;

    notify::dispatch(
        format!("New catering enquiry {}", request.reference),
        notify::catering_text(&request),
    );

    Ok((StatusCode::CREATED, Json(request)))
}

pub(crate) async fn fetch_by_id(
    pool: &sqlx::SqlitePool,
    id: i64,
) -> AppResult<CateringRequest> {
    let sql = format!("SELECT {CATERING_COLUMNS} FROM catering_requests WHERE id = ?");
    sqlx::query_as::<_, CateringRequest>(&sql)
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("That catering request no longer exists.".into()))
}

pub(crate) async fn fetch_all(pool: &sqlx::SqlitePool) -> AppResult<Vec<CateringRequest>> {
    let sql = format!(
        "SELECT {CATERING_COLUMNS} FROM catering_requests ORDER BY created_at DESC, id DESC"
    );
    Ok(sqlx::query_as::<_, CateringRequest>(&sql)
        .fetch_all(pool)
        .await?)
}
