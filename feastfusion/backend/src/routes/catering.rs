use axum::{extract::State, http::StatusCode, Json};

use crate::{
    error::{AppError, AppResult},
    models::{CateringRequest, NewCatering, Quote, QuoteRequest},
    notify, pricing,
    routes::orders::new_reference,
    AppState,
};

const CATERING_COLUMNS: &str = "
    id, reference, customer_name, customer_phone, customer_email, event_date,
    guest_count, event_type, location, budget_kobo, details, deposit_kobo,
    deposit_status, proof_url, status, created_at, state, lga, street_address,
    dishes, other_dishes, contact_channel, contact_handle, job_kind, deposit_reason
";

/// Public: lets the form show the deposit before the customer submits.
pub async fn quote(
    State(state): State<AppState>,
    Json(payload): Json<QuoteRequest>,
) -> AppResult<Json<Quote>> {
    let pricing = pricing::load_pricing(&state.pool).await?;
    Ok(Json(pricing::quote(
        &pricing,
        payload.job_kind.trim(),
        payload.event_type.trim(),
        payload.guest_count,
        &payload.dishes,
    )))
}

pub async fn create_catering(
    State(state): State<AppState>,
    Json(payload): Json<NewCatering>,
) -> AppResult<(StatusCode, Json<CateringRequest>)> {
    let name = payload.name.trim();
    let phone = payload.phone.trim();
    let location = payload.location.trim();
    let event_type = payload.event_type.trim();
    let event_date = payload.event_date.trim();
    let job_kind = payload.job_kind.trim();
    let state_name = payload.state.trim();
    let lga = payload.lga.trim();
    let street = payload.street_address.trim();
    let contact_channel = payload.contact_channel.trim();
    let contact_handle = payload.contact_handle.trim();

    if name.len() < 2 {
        return Err(AppError::BadRequest("Please enter your full name.".into()));
    }
    if phone.chars().filter(|c| c.is_ascii_digit()).count() < 7 {
        return Err(AppError::BadRequest(
            "Please enter a phone number we can reach you on.".into(),
        ));
    }
    if !matches!(job_kind, "event" | "cook_only" | "custom") {
        return Err(AppError::BadRequest("Pick what kind of job this is.".into()));
    }
    if event_type.is_empty() {
        return Err(AppError::BadRequest("What kind of event is it?".into()));
    }
    if event_date.is_empty() {
        return Err(AppError::BadRequest("When do you need us?".into()));
    }
    if job_kind == "event" && payload.guest_count <= 0 {
        return Err(AppError::BadRequest("How many guests are you feeding?".into()));
    }
    if location.len() < 3 {
        return Err(AppError::BadRequest("Where is the event holding?".into()));
    }
    if state_name.is_empty() {
        return Err(AppError::BadRequest("Which state are you in?".into()));
    }
    if lga.is_empty() {
        return Err(AppError::BadRequest("Which area or LGA is it?".into()));
    }
    if street.len() < 3 {
        return Err(AppError::BadRequest(
            "Add a street or landmark so we can find you.".into(),
        ));
    }
    if payload.dishes.is_empty() && payload.other_dishes.trim().is_empty() {
        return Err(AppError::BadRequest("Pick at least one dish.".into()));
    }
    if !matches!(
        contact_channel,
        "whatsapp" | "phone" | "telegram" | "snapchat"
    ) {
        return Err(AppError::BadRequest(
            "Choose how you would like us to reach you.".into(),
        ));
    }
    if contact_handle.len() < 3 {
        return Err(AppError::BadRequest(
            "Add the number or username for the channel you picked.".into(),
        ));
    }

    let pricing = pricing::load_pricing(&state.pool).await?;
    let quote = pricing::quote(
        &pricing,
        job_kind,
        event_type,
        payload.guest_count,
        &payload.dishes,
    );

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
             deposit_status, status, state, lga, street_address, dishes,
             other_dishes, contact_channel, contact_handle, job_kind, deposit_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
    .bind(quote.deposit_kobo)
    .bind(state_name)
    .bind(lga)
    .bind(street)
    .bind(payload.dishes.join(", "))
    .bind(payload.other_dishes.trim())
    .bind(contact_channel)
    .bind(contact_handle)
    .bind(job_kind)
    .bind(&quote.reason)
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
