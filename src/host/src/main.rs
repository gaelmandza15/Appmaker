//! Hôte AppMaker générique.
//!
//! Ce binaire est compilé **une seule fois** pour toutes les applications. Au
//! lancement il lit `resources/host.json`, sert l’interface depuis
//! `resources/web/` via un protocole local, et enregistre les migrations SQLite
//! de l’application depuis `resources/migrations/`.
//!
//! Empaqueter une nouvelle application revient donc à copier ce binaire avec son
//! dossier de ressources : aucune compilation Rust n’est nécessaire.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::{Path, PathBuf};

use serde::Deserialize;
use tauri::http::{header, Response, StatusCode};
use tauri::image::Image;
use tauri::{WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_sql::{Migration, MigrationKind};

/// Politique de sécurité appliquée aux ressources de l’application.
/// Le protocole local est considéré comme l’origine `self`.
const CSP: &str = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; \
img-src 'self' data:; font-src 'self'; connect-src 'self' ipc: http://ipc.localhost";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HostConfig {
    name: String,
    database_file: String,
}

impl Default for HostConfig {
    fn default() -> Self {
        Self {
            name: "Application".to_string(),
            database_file: String::new(),
        }
    }
}

/// Dossier `resources/` livré à côté de l’exécutable (ou à la racine du projet en développement).
fn app_root() -> PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let resources = dir.join("resources");
            if resources.is_dir() {
                return resources;
            }
        }
    }
    PathBuf::from("resources")
}

fn read_config(root: &Path) -> HostConfig {
    let file = root.join("host.json");
    match fs::read_to_string(&file) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_else(|error| {
            eprintln!("host.json invalide ({error}) : {file:?}");
            HostConfig::default()
        }),
        Err(error) => {
            eprintln!("host.json introuvable ({error}) : {file:?}");
            HostConfig::default()
        }
    }
}

fn leak(value: String) -> &'static str {
    Box::leak(value.into_boxed_str())
}

/// Les migrations doivent être `'static` : on fuit une fois les SQL lus au démarrage.
///
/// Le dossier est lu dynamiquement pour que les migrations additives ajoutées
/// après l’installation (ALTER TABLE) soient appliquées à la prochaine ouverture.
fn load_migrations(root: &Path) -> Vec<Migration> {
    let directory = root.join("migrations");
    let entries = match fs::read_dir(&directory) {
        Ok(entries) => entries,
        Err(error) => {
            eprintln!("Dossier de migrations introuvable ({error}) : {directory:?}");
            return Vec::new();
        }
    };

    let mut files: Vec<PathBuf> = entries
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|path| path.extension().map(|ext| ext == "sql").unwrap_or(false))
        .collect();
    files.sort();

    let mut migrations = Vec::new();
    let mut last_version = 0;
    for path in files {
        let sql = match fs::read_to_string(&path) {
            Ok(sql) => sql,
            Err(error) => {
                eprintln!("Migration ignorée ({error}) : {path:?}");
                continue;
            }
        };
        let stem = path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or("migration");
        let version = stem
            .split('_')
            .next()
            .and_then(|prefix| prefix.parse::<i64>().ok())
            .unwrap_or(0);
        if version <= last_version {
            eprintln!("Migration ignorée (numéro invalide ou dupliqué) : {path:?}");
            continue;
        }
        last_version = version;
        let description = stem
            .split_once('_')
            .map(|(_, rest)| rest)
            .unwrap_or(stem)
            .to_string();
        migrations.push(Migration {
            version,
            description: leak(description),
            sql: leak(sql),
            kind: MigrationKind::Up,
        });
    }
    migrations
}

fn mime_for(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "ico" => "image/x-icon",
        "woff2" => "font/woff2",
        "woff" => "font/woff",
        "txt" | "md" => "text/plain; charset=utf-8",
        "sql" => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}

fn percent_decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[index + 1..index + 3]).ok();
            if let Some(byte) = hex.and_then(|hex| u8::from_str_radix(hex, 16).ok()) {
                out.push(byte);
                index += 3;
                continue;
            }
        }
        out.push(bytes[index]);
        index += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Sert un fichier de `resources/web`, sans autoriser de sortie du dossier.
fn serve_file(web_root: &Path, request_path: &str) -> Response<Vec<u8>> {
    let decoded = percent_decode(request_path);
    let relative = decoded.trim_start_matches('/');
    let relative = if relative.is_empty() { "index.html" } else { relative };

    let candidate = web_root.join(relative);
    let canonical_root = web_root.canonicalize().unwrap_or_else(|_| web_root.to_path_buf());
    let resolved = candidate
        .canonicalize()
        .ok()
        .filter(|path| path.starts_with(&canonical_root) && path.is_file());

    match resolved.and_then(|path| fs::read(&path).ok().map(|bytes| (path, bytes))) {
        Some((path, bytes)) => Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, mime_for(&path))
            .header(header::CACHE_CONTROL, "no-store")
            .header("Content-Security-Policy", CSP)
            .body(bytes)
            .unwrap_or_else(|_| not_found()),
        None => not_found(),
    }
}

fn not_found() -> Response<Vec<u8>> {
    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
        .header("Content-Security-Policy", CSP)
        .body(b"Ressource introuvable".to_vec())
        .expect("réponse 404")
}

fn window_url() -> &'static str {
    #[cfg(any(windows, target_os = "android"))]
    {
        "http://appmaker.localhost/index.html"
    }
    #[cfg(not(any(windows, target_os = "android")))]
    {
        "appmaker://localhost/index.html"
    }
}

fn main() {
    let resources = app_root();
    let config = read_config(&resources);
    let migrations = load_migrations(&resources);
    let web_root = resources.join("web");
    let icon = fs::read(resources.join("icon.png")).ok();

    let mut sql = tauri_plugin_sql::Builder::default();
    if !config.database_file.is_empty() && !migrations.is_empty() {
        let database_url = format!("sqlite:{}", config.database_file);
        sql = sql.add_migrations(&database_url, migrations);
    }

    let protocol_root = web_root.clone();
    let window_title = config.name.clone();

    tauri::Builder::default()
        .plugin(sql.build())
        .register_uri_scheme_protocol("appmaker", move |_context, request| {
            serve_file(&protocol_root, request.uri().path())
        })
        .setup(move |app| {
            let mut builder = WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::External(window_url().parse().expect("URL de fenêtre invalide")),
            )
            .title(&window_title)
            .inner_size(1360.0, 860.0)
            .min_inner_size(1024.0, 680.0)
            .center()
            .resizable(true);

            if let Some(bytes) = icon.as_deref() {
                match Image::from_bytes(bytes) {
                    Ok(image) => builder = builder.icon(image)?,
                    Err(error) => eprintln!("Icône ignorée : {error}"),
                }
            }

            builder.build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erreur au lancement de l’hôte AppMaker");
}
