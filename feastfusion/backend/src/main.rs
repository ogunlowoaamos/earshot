mod auth;
mod catalogue;
mod db;
mod error;
mod ingredients;
mod models;
mod notify;
mod pricing;
mod routes;
mod seed;

use std::path::PathBuf;

use axum::{
    routing::{get, patch, post, put},
    Router,
};
use sqlx::SqlitePool;
use tower_http::{
    cors::{Any, CorsLayer},
    services::ServeDir,
    trace::TraceLayer,
};

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub uploads: PathBuf,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "feastfusion_api=info,tower_http=warn,info".into()),
        )
        .init();

    let pool = db::connect().await?;

    let uploads =
        PathBuf::from(std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string()));
    tokio::fs::create_dir_all(&uploads).await?;

    let state = AppState {
        pool,
        uploads: uploads.clone(),
    };

    let api = Router::new()
        .route("/categories", get(routes::menu::list_categories))
        .route("/menu", get(routes::menu::list_menu))
        .route("/pairings", get(routes::menu::list_pairings))
        .route("/settings", get(routes::menu::get_settings))
        .route("/zones", get(routes::menu::list_zones))
        .route("/orders", post(routes::orders::create_order))
        .route("/orders/:reference", get(routes::orders::get_order))
        .route(
            "/orders/:reference/proof",
            post(routes::orders::upload_proof),
        )
        .route("/catering", post(routes::catering::create_catering))
        .route("/catering/quote", post(routes::catering::quote))
        .route("/admin/login", post(routes::admin::login))
        .route("/admin/orders", get(routes::admin::list_orders))
        .route("/admin/orders/:id", patch(routes::admin::update_order))
        .route("/admin/catering", get(routes::admin::list_catering))
        .route("/admin/pricing", get(routes::admin::get_pricing))
        .route("/admin/pricing/:kind", post(routes::admin::save_rate))
        .route("/admin/menu", post(routes::admin::create_menu_item))
        .route("/admin/catalogue", get(routes::admin::list_catalogue))
        .route("/admin/availability", post(routes::admin::set_availability))
        .route(
            "/admin/categories/:slug/approval",
            put(routes::admin::set_category_approval),
        )
        .route("/admin/pairings", put(routes::admin::save_pairings))
        .route(
            "/admin/menu/:id/ingredients",
            put(routes::admin::save_ingredients),
        )
        .route("/admin/menu/:id/options", put(routes::admin::save_options))
        .route(
            "/admin/menu/:id",
            patch(routes::admin::update_menu_item).delete(routes::admin::delete_menu_item),
        )
        .with_state(state);

    let app = Router::new()
        .nest("/api", api)
        .nest_service("/uploads", ServeDir::new(uploads))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .layer(TraceLayer::new_for_http());

    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}")).await?;

    tracing::info!("FeastFusion API listening on http://127.0.0.1:{port}");
    axum::serve(listener, app).await?;

    Ok(())
}
