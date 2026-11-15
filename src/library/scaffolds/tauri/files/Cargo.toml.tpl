[package]
name = "{{APP_CRATE}}"
version = "{{APP_VERSION}}"
description = "{{APP_DESCRIPTION}}"
edition = "2021"
rust-version = "1.90"
publish = false

[build-dependencies]
tauri-build = { version = "2.7.4", features = [] }

[dependencies]
tauri = { version = "2.12.5", features = [] }
tauri-plugin-sql = { version = "2.6.0", features = ["sqlite"] }
serde = { version = "1", features = ["derive"] }

[profile.release]
codegen-units = 1
lto = true
opt-level = "s"
panic = "abort"
strip = true
