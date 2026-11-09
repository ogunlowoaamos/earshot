use std::str::FromStr;

use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;

use crate::models::Settings;

pub async fn connect() -> Result<SqlitePool, Box<dyn std::error::Error>> {
    let url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite://data/feastfusion.db".to_string());

    if let Some(path) = url.strip_prefix("sqlite://") {
        if let Some(dir) = std::path::Path::new(path).parent() {
            if !dir.as_os_str().is_empty() {
                std::fs::create_dir_all(dir)?;
            }
        }
    }

    let options = SqliteConnectOptions::from_str(&url)?
        .create_if_missing(true)
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;

    migrate(&pool).await?;
    crate::seed::run(&pool).await?;

    Ok(pool)
}

const MIGRATIONS: &[&str] = &[
    include_str!("../migrations/0001_init.sql"),
    include_str!("../migrations/0002_ingredients_and_deposit.sql"),
    include_str!("../migrations/0003_catalogue_and_options.sql"),
    include_str!("../migrations/0004_pairings.sql"),
    include_str!("../migrations/0005_category_approval.sql"),
    include_str!("../migrations/0006_catering_time.sql"),
    include_str!("../migrations/0007_catering_allergies.sql"),
];

async fn migrate(pool: &SqlitePool) -> Result<(), Box<dyn std::error::Error>> {
    for sql in MIGRATIONS {
        for chunk in sql.split(';') {
            let statement = chunk.trim();
            if statement.is_empty() {
                continue;
            }
            // Migrations are replayed on every boot, so statements that add a
            // column or index must tolerate "already exists".
            if let Err(err) = sqlx::query(statement).execute(pool).await {
                let msg = err.to_string().to_lowercase();
                let already_applied =
                    msg.contains("duplicate column") || msg.contains("already exists");
                if !already_applied {
                    return Err(err.into());
                }
            }
        }
    }
    Ok(())
}

async fn setting_value(pool: &SqlitePool, key: &str, fallback: &str) -> String {
    sqlx::query_scalar::<_, String>("SELECT value FROM settings WHERE key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .unwrap_or_else(|| fallback.to_string())
}

async fn setting_int(pool: &SqlitePool, key: &str, fallback: i64) -> i64 {
    setting_value(pool, key, &fallback.to_string())
        .await
        .parse::<i64>()
        .unwrap_or(fallback)
}

pub async fn load_settings(pool: &SqlitePool) -> Settings {
    Settings {
        delivery_fee_kobo: setting_int(pool, "delivery_fee_kobo", 200_000).await,
        catering_deposit_kobo: setting_int(pool, "catering_deposit_kobo", 10_000_000).await,
        whatsapp_number: setting_value(pool, "whatsapp_number", "2348012345678").await,
        bank_name: setting_value(pool, "bank_name", "Guaranty Trust Bank").await,
        bank_account_name: setting_value(pool, "bank_account_name", "FeastFusion Kitchen Ltd")
            .await,
        bank_account_number: setting_value(pool, "bank_account_number", "0123456789").await,
    }
}
