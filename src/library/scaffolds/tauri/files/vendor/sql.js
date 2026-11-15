/**
 * Client JS minimal du plugin SQL Tauri 2.
 *
 * Depuis Tauri 2.6, les plugins ne sont plus injectés automatiquement dans
 * `window.__TAURI__` : on appelle directement les commandes IPC `plugin:sql|*`.
 *
 * Contrat IPC (côté Rust) :
 *   load(db, options) / execute(db, query, values) / select(db, query, values)
 * `db` est passé en argument positionnel dans le payload ; l’envoyer sous forme
 * d’objet (`{ db, query }`) ferait résoudre la base « undefined ».
 */

function invoke(command, args) {
  const internals = typeof window !== 'undefined' ? window.__TAURI_INTERNALS__ : undefined;
  if (!internals || typeof internals.invoke !== 'function') {
    return Promise.reject(new Error('Contexte Tauri indisponible : cette fonctionnalité requiert l’application de bureau.'));
  }
  return internals.invoke(command, args);
}

class Database {
  constructor(path) {
    this.path = path;
  }

  /** Ouvre la base (créée si nécessaire, migrations Rust exécutées). */
  static async load(path, options) {
    const resolved = await invoke('plugin:sql|load', { db: path, options: options ?? null });
    return new Database(resolved);
  }

  /** Handle différé : la connexion s’ouvre au premier appel. */
  static get(path) {
    return new Database(path);
  }

  async execute(query, values) {
    const [rowsAffected, lastInsertId] = await invoke('plugin:sql|execute', {
      db: this.path,
      query,
      values: values ?? []
    });
    return { rowsAffected, lastInsertId };
  }

  async select(query, values) {
    return invoke('plugin:sql|select', {
      db: this.path,
      query,
      values: values ?? []
    });
  }

  async close(db) {
    return invoke('plugin:sql|close', { db: db ?? null });
  }
}

export default Database;
