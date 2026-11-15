/**
 * Persistance de l’application.
 *
 * Deux implémentations partagent la même API :
 *  - SQLite (Tauri) : base locale, migrations et seed fournis par l’enveloppe native ;
 *  - localStorage (navigateur) : pour l’aperçu dans le studio.
 * Les écrans appellent uniquement les méthodes asynchrones ci-dessous.
 */
const HAS_TAURI = typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);

/** Charge le client SQL uniquement en mode desktop (évite une dépendance dans l’aperçu navigateur). */
async function loadSqlClient() {
  // En mode bureau, db.js est servi depuis assets/ et les modules du plugin depuis vendor/.
  const url = new URL('../vendor/sql.js', import.meta.url).href;
  const module = await import(url);
  return module.default;
}

/** Ajoute un délai maximal à une promesse : une base inaccessible ne doit pas bloquer l’interface. */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} : délai dépassé (${ms} ms)`)), ms);
    })
  ]);
}

const TABLE_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
const COLUMN_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

function quote(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

function safeTable(value) {
  if (!TABLE_PATTERN.test(String(value))) throw new Error(`Table invalide : ${value}`);
  return String(value);
}

function safeColumn(value) {
  if (!COLUMN_PATTERN.test(String(value))) throw new Error(`Colonne invalide : ${value}`);
  return String(value);
}

function nowIso() {
  return new Date().toISOString();
}

function toDatabaseValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'string') return value;
  return String(value);
}

class SqliteStore {
  constructor(app) {
    this.app = app;
    this.db = null;
    this.memoryOnly = false;
    this.mode = 'sqlite';
  }

  async init() {
    try {
      const file = this.app.databaseFile;
      if (!file) throw new Error('nom de base absent de la configuration de l’application');
      const Database = await withTimeout(loadSqlClient(), 8000, 'Chargement du client SQL');
      this.db = await withTimeout(Database.load(`sqlite:${file}`), 20000, 'Ouverture de la base');
      await withTimeout(this.db.select('SELECT 1 AS ready'), 8000, 'Vérification de la base');
      return this;
    } catch (error) {
      const detail = typeof error === 'string' ? error : (error?.message || JSON.stringify(error));
      throw new Error(`SQLite : ${detail || 'erreur inconnue'}`);
    }
  }

  get persistent() {
    return this.db !== null;
  }

  async all(entityKey) {
    return this.db.select(`SELECT * FROM ${quote(safeTable(entityKey))} ORDER BY "id" ASC`);
  }

  async get(entityKey, id) {
    const rows = await this.db.select(`SELECT * FROM ${quote(safeTable(entityKey))} WHERE "id" = $1`, [Number(id)]);
    return rows[0] || null;
  }

  async count(entityKey) {
    const rows = await this.db.select(`SELECT COUNT(*) AS total FROM ${quote(safeTable(entityKey))}`);
    return Number(rows[0]?.total || 0);
  }

  async countAll() {
    let total = 0;
    for (const entity of this.app.entities) total += await this.count(entity.key);
    return total;
  }

  async insert(entityKey, values) {
    const columns = Object.keys(values);
    columns.forEach(safeColumn);
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const params = columns.map((column) => toDatabaseValue(values[column]));
    const timestamp = nowIso();
    const allColumns = [...columns, 'createdAt', 'updatedAt'];
    const allPlaceholders = [...placeholders, `$${columns.length + 1}`, `$${columns.length + 2}`];
    const result = await this.db.execute(
      `INSERT INTO ${quote(safeTable(entityKey))} (${allColumns.map(quote).join(', ')}) VALUES (${allPlaceholders.join(', ')})`,
      [...params, timestamp, timestamp]
    );
    return this.get(entityKey, Number(result.lastInsertId));
  }

  async update(entityKey, id, values) {
    const columns = Object.keys(values);
    columns.forEach(safeColumn);
    const sets = columns.map((column, index) => `${quote(column)} = $${index + 1}`);
    sets.push(`"updatedAt" = $${columns.length + 1}`);
    const params = columns.map((column) => toDatabaseValue(values[column]));
    params.push(nowIso());
    params.push(Number(id));
    await this.db.execute(
      `UPDATE ${quote(safeTable(entityKey))} SET ${sets.join(', ')} WHERE "id" = $${columns.length + 2}`,
      params
    );
    return this.get(entityKey, Number(id));
  }

  async remove(entityKey, id) {
    await this.db.execute(`DELETE FROM ${quote(safeTable(entityKey))} WHERE "id" = $1`, [Number(id)]);
    return true;
  }

  async clearAll() {
    for (const entity of this.app.entities) {
      await this.db.execute(`DELETE FROM ${quote(safeTable(entity.key))}`);
    }
  }

  async exportAll() {
    const dump = {};
    for (const entity of this.app.entities) dump[entity.key] = await this.all(entity.key);
    return dump;
  }
}

class LocalStore {
  constructor(app) {
    this.app = app;
    this.key = `appmaker.v1.${app.id}`;
    this.tables = {};
    this.memoryOnly = false;
    this.mode = 'local';
  }

  async init() {
    this.mode = 'local';
    try {
      const raw = window.localStorage.getItem(this.key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.tables && typeof parsed.tables === 'object') {
          this.tables = parsed.tables;
          this.ensureTables();
          return this;
        }
      }
    } catch {
      this.memoryOnly = true;
    }
    this.seed();
    this.save();
    return this;
  }

  get persistent() {
    return !this.memoryOnly;
  }

  ensureTables() {
    let changed = false;
    for (const entity of this.app.entities) {
      if (!Array.isArray(this.tables[entity.key])) {
        this.tables[entity.key] = this.rowsFromSeed(entity);
        changed = true;
      }
    }
    if (changed) this.save();
  }

  seed() {
    this.tables = {};
    for (const entity of this.app.entities) this.tables[entity.key] = this.rowsFromSeed(entity);
    this.resolveSeedRelations();
  }

  rowsFromSeed(entity) {
    const rows = Array.isArray(this.app.seed?.[entity.key]) ? this.app.seed[entity.key] : [];
    const now = Date.now();
    return rows.map((raw, index) => {
      const row = { id: index + 1, ...raw };
      row.createdAt = new Date(now - (rows.length - index) * 3600 * 1000).toISOString();
      row.updatedAt = row.createdAt;
      return row;
    });
  }

  resolveSeedRelations() {
    for (const entity of this.app.entities) {
      for (const field of entity.fields.filter((candidate) => candidate.type === 'relation')) {
        const target = this.app.entities.find((candidate) => candidate.key === field.target);
        if (!target) continue;
        const targetRows = this.tables[target.key] || [];
        for (const row of this.tables[entity.key] || []) {
          const raw = row[field.key];
          if (raw === null || raw === undefined || raw === '') {
            row[field.key] = null;
            continue;
          }
          if (typeof raw === 'number') {
            if (!targetRows.some((candidate) => candidate.id === raw)) row[field.key] = null;
            continue;
          }
          const match = targetRows.find((candidate) => String(candidate[target.labelField] ?? '').toLowerCase() === String(raw).toLowerCase());
          row[field.key] = match ? match.id : null;
        }
      }
    }
  }

  allSync(entityKey) {
    return [...(this.tables[entityKey] || [])];
  }

  async all(entityKey) {
    return this.allSync(entityKey);
  }

  async get(entityKey, id) {
    return this.allSync(entityKey).find((row) => row.id === Number(id)) || null;
  }

  async count(entityKey) {
    return this.allSync(entityKey).length;
  }

  async countAll() {
    return this.app.entities.reduce((total, entity) => total + this.allSync(entity.key).length, 0);
  }

  pickValues(entity, values) {
    const picked = {};
    if (!entity) return picked;
    for (const field of entity.fields) {
      if (Object.prototype.hasOwnProperty.call(values, field.key)) {
        const raw = values[field.key];
        picked[field.key] = typeof raw === 'boolean' ? (raw ? 1 : 0) : raw;
      }
    }
    return picked;
  }

  async insert(entityKey, values) {
    const rows = this.tables[entityKey] || (this.tables[entityKey] = []);
    const entity = this.app.entities.find((candidate) => candidate.key === entityKey);
    const id = rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1;
    const now = nowIso();
    const row = { id, ...this.pickValues(entity, values), createdAt: now, updatedAt: now };
    rows.push(row);
    this.save();
    return row;
  }

  async update(entityKey, id, values) {
    const entity = this.app.entities.find((candidate) => candidate.key === entityKey);
    const row = this.allSync(entityKey).find((candidate) => candidate.id === Number(id));
    if (!row) return null;
    Object.assign(row, this.pickValues(entity, values), { updatedAt: nowIso() });
    this.save();
    return row;
  }

  async remove(entityKey, id) {
    const rows = this.tables[entityKey] || [];
    const index = rows.findIndex((row) => row.id === Number(id));
    if (index === -1) return false;
    rows.splice(index, 1);
    this.save();
    return true;
  }

  async clearAll() {
    this.tables = {};
    for (const entity of this.app.entities) this.tables[entity.key] = [];
    this.save();
  }

  async exportAll() {
    const dump = {};
    for (const entity of this.app.entities) dump[entity.key] = this.allSync(entity.key);
    return dump;
  }

  save() {
    if (this.memoryOnly) return false;
    try {
      window.localStorage.setItem(this.key, JSON.stringify({ version: 1, savedAt: nowIso(), tables: this.tables }));
      return true;
    } catch {
      this.memoryOnly = true;
      return false;
    }
  }
}

/**
 * Choisit SQLite sous Tauri, localStorage dans un navigateur.
 * Si SQLite est indisponible (droits, base verrouillée…), l’application bascule
 * sur le stockage local pour rester utilisable, et le mode est affiché dans l’interface.
 */
export function createStore(app) {
  if (!HAS_TAURI) return new LocalStore(app);
  const sqlite = new SqliteStore(app);

  // Si SQLite échoue, l'instance bascule réellement sur le stockage local :
  // sans ce transfert de méthodes, this.db resterait null et chaque lecture
  // lèverait « Cannot read properties of null ».
  sqlite.initFallback = async () => {
    const local = new LocalStore(app);
    await local.init();
    for (const name of ['init', 'all', 'allSync', 'get', 'count', 'countAll', 'insert', 'update', 'remove', 'clearAll', 'exportAll', 'save']) {
      if (typeof local[name] === 'function') sqlite[name] = local[name].bind(local);
    }
    Object.defineProperty(sqlite, 'persistent', { get: () => !local.memoryOnly, configurable: true });
    sqlite.mode = 'local';
    sqlite.fallbackReason = sqlite.fallbackReason || 'SQLite indisponible';
    return sqlite;
  };

  return sqlite;
}

export { HAS_TAURI };
