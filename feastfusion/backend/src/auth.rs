use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::http::HeaderMap;
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: i64,
}

pub fn secret() -> String {
    std::env::var("JWT_SECRET").unwrap_or_else(|_| "feastfusion-dev-secret-change-me".to_string())
}

pub fn hash_password(password: &str) -> AppResult<String> {
    let salt = SaltString::generate(&mut OsRng);
    Ok(Argon2::default()
        .hash_password(password.as_bytes(), &salt)?
        .to_string())
}

pub fn verify_password(password: &str, hash: &str) -> bool {
    match PasswordHash::new(hash) {
        Ok(parsed) => Argon2::default()
            .verify_password(password.as_bytes(), &parsed)
            .is_ok(),
        Err(_) => false,
    }
}

pub fn issue_token(username: &str) -> AppResult<String> {
    let claims = Claims {
        sub: username.to_string(),
        exp: (Utc::now() + Duration::hours(12)).timestamp(),
    };
    Ok(encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret().as_bytes()),
    )?)
}

/// Validates the `Authorization: Bearer <token>` header.
pub fn require_admin(headers: &HeaderMap) -> AppResult<String> {
    let raw = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or(AppError::Unauthorized)?;

    let token = raw
        .strip_prefix("Bearer ")
        .or_else(|| raw.strip_prefix("bearer "))
        .ok_or(AppError::Unauthorized)?
        .trim();

    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret().as_bytes()),
        &Validation::default(),
    )?;

    Ok(data.claims.sub)
}
