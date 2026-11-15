//! Application de bureau générée par AppMaker.
//!
//! L’interface reste celle du scaffold web ; ici on ajoute uniquement
//! l’enveloppe native et la base SQLite locale (migrations issues de la spec).

use std::fs;

use serde::Serialize;
use tauri_plugin_sql::{Migration, MigrationKind};

/// Schéma de la base de données généré depuis le plan de l’application.
const MIGRATION_0001: &str = include_str!("../migrations/0001_init.sql");
/// Données d’exemple insérées au premier lancement.
const MIGRATION_0002: &str = include_str!("../migrations/0002_seed.sql");

#[derive(Serialize)]
struct AppInfo {
    name: String,
    version: String,
    platform: String,
    arch: String,
    database: String,
}

#[tauri::command]
fn app_info(name: String, database: String) -> AppInfo {
    AppInfo {
        name,
        version: env!("CARGO_PKG_VERSION").to_string(),
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        database,
    }
}

#[tauri::command]
fn app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

fn main() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "schema",
            sql: MIGRATION_0001,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "seed",
            sql: MIGRATION_0002,
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:{{DB_FILE}}", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![app_info, app_data_dir])
        .run(tauri::generate_context!())
        .expect("erreur au lancement de l’application");
}
