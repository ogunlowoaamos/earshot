use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

#[derive(Debug)]
pub enum AppError {
    NotFound(String),
    BadRequest(String),
    Unauthorized,
    Internal(String),
}

pub type AppResult<T> = Result<T, AppError>;

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppError::NotFound(m) => write!(f, "not found: {m}"),
            AppError::BadRequest(m) => write!(f, "bad request: {m}"),
            AppError::Unauthorized => write!(f, "unauthorized"),
            AppError::Internal(m) => write!(f, "internal: {m}"),
        }
    }
}

impl std::error::Error for AppError {}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::NotFound(m) => (StatusCode::NOT_FOUND, m),
            AppError::BadRequest(m) => (StatusCode::BAD_REQUEST, m),
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "Please sign in again.".into()),
            AppError::Internal(m) => {
                tracing::error!("internal error: {m}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong on our side. Please try again.".to_string(),
                )
            }
        };

        (status, Json(json!({ "error": message }))).into_response()
    }
}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        AppError::Internal(e.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Internal(e.to_string())
    }
}

impl From<argon2::password_hash::Error> for AppError {
    fn from(e: argon2::password_hash::Error) -> Self {
        AppError::Internal(e.to_string())
    }
}

impl From<jsonwebtoken::errors::Error> for AppError {
    fn from(_: jsonwebtoken::errors::Error) -> Self {
        AppError::Unauthorized
    }
}
