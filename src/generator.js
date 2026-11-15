import fs from 'node:fs/promises';
import path from 'node:path';
import { createIconSet } from './icons.js';
import { getBlock, getScaffoldPath } from './library/catalog.js';

const VERSION = '0.1.0';
const TAURI_CLI_VERSION = '2.12.4';
const PUBLISHER = 'AppMaker';

function htmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function xmlEscape(value) {
  return htmlEscape(value);
}

function fillTokens(template, tokens) {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(tokens, key) ? tokens[key] : match
  );
}

function appInitials(name) {
  const words = String(name || 'AppMaker').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return String(name || 'A').replace(/[^a-zA-Z0-9À-ÿ]/g, '').slice(0, 2).toUpperCase() || 'A';
}

const TYPE_LABELS = {
  text: 'Texte',
  textarea: 'Texte long',
  number: 'Nombre',
  currency: 'Montant (€)',
  boolean: 'Oui / Non',
  date: 'Date',
  select: 'Choix',
  relation: 'Relation'
};

function entityMarkdown(spec) {
  return spec.entities.map((entity) => {
    const rows = entity.fields.map((field) => {
      let details = field.required ? 'Obligatoire' : 'Optionnel';
      if (field.type === 'select') details += ` · ${field.options.join(', ')}`;
      if (field.type === 'relation') {
        const target = spec.entities.find((candidate) => candidate.key === field.target);
        details += ` · vers ${target ? target.namePlural : field.target}`;
      }
      if (field.type === 'currency') details += ' · EUR';
      return `| ${field.label.replaceAll('|', '\\|')} | ${TYPE_LABELS[field.type] || field.type} | ${details} |`;
    });
    return `### ${entity.namePlural} (\`${entity.key}\`)\n\n| Champ | Type | Détails |\n| --- | --- | --- |\n${rows.join('\n')}`;
  }).join('\n\n');
}

function screenMarkdown(spec) {
  const lines = spec.screens.map((screen) => {
    if (screen.type === 'dashboard') {
      const kpis = (screen.kpis || []).map((kpi) => kpi.label).join(', ');
      const breakdown = screen.breakdown
        ? ` · répartition par ${spec.entities.find((entity) => entity.key === screen.breakdown.entity)?.namePlural.toLowerCase() || screen.breakdown.field}`
        : '';
      const recent = screen.recent
        ? ` · activité récente (${spec.entities.find((entity) => entity.key === screen.recent.entity)?.namePlural.toLowerCase() || screen.recent.entity})`
        : '';
      return `- **${screen.title}** (\`dashboard\`) — KPI : ${kpis || 'aucun'}${breakdown}${recent}.`;
    }
    const entity = spec.entities.find((candidate) => candidate.key === screen.entity);
    return `- **${screen.title}** (\`crud\`) — gestion des ${entity ? entity.namePlural.toLowerCase() : screen.entity} : recherche, tri, création, modification, suppression.`;
  });
  return lines.join('\n');
}

function blockMarkdown(blocks) {
  return blocks.map((block) => `- **${block.name}** (\`${block.id}\`) — ${block.description}`).join('\n');
}

function sqlIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function sqliteType(field) {
  if (field.type === 'relation') return { type: 'INTEGER', notNull: field.required };
  if (field.type === 'boolean') return { type: 'INTEGER DEFAULT 0', notNull: true };
  if (field.type === 'number') return { type: 'REAL', notNull: false };
  if (field.type === 'currency') return { type: 'NUMERIC', notNull: false };
  return { type: 'TEXT', notNull: false };
}

/** Schéma lisible livré avec le projet (documentation ; les migrations Tauri n'utilisent pas de REFERENCES). */
function sqliteDocument(spec) {
  const header = [
    `-- Schéma SQLite de ${spec.app.name}, généré par AppMaker.`,
    '-- Les relations sont déclarées en commentaire : les migrations Tauri créent les tables',
    '-- sans clés étrangères et l’application garantit l’intégrité des relations.',
    ''
  ];
  const tables = spec.entities.map((entity) => {
    const columns = [
      { column: '  "id" INTEGER PRIMARY KEY AUTOINCREMENT', note: '' },
      ...entity.fields.map((field) => {
        const column = `  ${sqlIdentifier(field.key)} ${sqliteType(field).type}`;
        // La virgule précède le commentaire : sinon SQLite l’absorbe et la colonne
        // suivante devient une partie du type de la colonne relation.
        const note = field.type === 'relation' ? ` -- → ${field.target}("id") ON DELETE SET NULL` : '';
        return { column, note };
      }),
      { column: '  "createdAt" TEXT NOT NULL', note: '' },
      { column: '  "updatedAt" TEXT NOT NULL', note: '' }
    ];
    const body = columns
      .map(({ column, note }, index) => `${column}${index < columns.length - 1 ? ',' : ''}${note}`)
      .join('\n');
    return `CREATE TABLE IF NOT EXISTS ${sqlIdentifier(entity.key)} (\n${body}\n);`;
  });
  const indexes = [];
  for (const entity of spec.entities) {
    indexes.push(`CREATE INDEX IF NOT EXISTS ${sqlIdentifier(`idx_${entity.key}_label`)} ON ${sqlIdentifier(entity.key)} (${sqlIdentifier(entity.labelField)});`);
    for (const field of entity.fields.filter((candidate) => candidate.type === 'relation')) {
      indexes.push(`CREATE INDEX IF NOT EXISTS ${sqlIdentifier(`idx_${entity.key}_${field.key}`)} ON ${sqlIdentifier(entity.key)} (${sqlIdentifier(field.key)});`);
    }
  }
  return `${header.concat(tables, [''], indexes).join('\n')}\n`;
}

function favicon(spec) {
  const initial = xmlEscape(appInitials(spec.app.name));
  const accent = spec.app.accent;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${accent}"/>
      <stop offset="1" stop-color="#141a2e"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="15" fill="url(#g)"/>
  <text x="32" y="42" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="700" fill="#ffffff">${initial}</text>
</svg>
`;
}

/* ---------- Métadonnées de packaging ---------- */

function slug(value, max = 20) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, max) || 'appmaker';
}

function sqlString(value) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`;
}

/** Métadonnées de l’application de bureau, dérivées de la spec. */
export function buildPackaging(appId, spec) {
  const crate = `app-${appId}`.replace(/-+/g, '-').slice(0, 60);
  return {
    appId,
    crate,
    name: spec.app.name,
    version: VERSION,
    identifier: `com.appmaker.${slug(appId)}`,
    databaseFile: `${appId}.db`,
    publisher: PUBLISHER,
    copyright: `© ${new Date().getFullYear()} ${spec.app.name} — généré avec AppMaker`,
    description: spec.app.tagline,
    shortDescription: spec.app.tagline.slice(0, 100),
    tauriCliVersion: TAURI_CLI_VERSION,
    generatedAt: null
  };
}

/** Schéma SQLite sous forme de migration Tauri. */
function sqliteMigration(spec) {
  const header = [
    `-- Schéma SQLite de ${spec.app.name}, généré par AppMaker.`,
    '-- Les relations sont déclarées en commentaire : les migrations Tauri créent les tables',
    '-- sans clés étrangères et l’application garantit l’intégrité des relations.',
    '-- Les tables sont créées d’abord, puis initialisées par la migration 0002 (données d’exemple).',
    ''
  ];
  const tables = spec.entities.map((entity) => {
    const columns = [
      '  "id" INTEGER PRIMARY KEY AUTOINCREMENT',
      ...entity.fields.map((field) => {
        const { type, notNull } = sqliteType(field);
        return `  ${sqlIdentifier(field.key)} ${type}${notNull ? ' NOT NULL' : ''}`;
      }),
      '  "createdAt" TEXT NOT NULL',
      '  "updatedAt" TEXT NOT NULL'
    ];
    return `CREATE TABLE IF NOT EXISTS ${sqlIdentifier(entity.key)} (\n${columns.join(',\n')}\n);`;
  });
  const indexes = [];
  for (const entity of spec.entities) {
    indexes.push(`CREATE INDEX IF NOT EXISTS ${sqlIdentifier(`idx_${entity.key}_label`)} ON ${sqlIdentifier(entity.key)} (${sqlIdentifier(entity.labelField)});`);
    for (const field of entity.fields.filter((candidate) => candidate.type === 'relation')) {
      indexes.push(`CREATE INDEX IF NOT EXISTS ${sqlIdentifier(`idx_${entity.key}_${field.key}`)} ON ${sqlIdentifier(entity.key)} (${sqlIdentifier(field.key)});`);
    }
  }
  return `${header.concat(tables, [''], indexes).join('\n')}\n`;
}

/** Migration additive d’une colonne, compatible avec les bases déjà installées. */
export function sqliteAddColumn(entityKey, field) {
  // sqliteType inclut déjà les valeurs par défaut (INTEGER DEFAULT 0 pour un booléen).
  const type = sqliteType(field).type;
  return [
    `-- Migration additive AppMaker : ${entityKey}.${field.key}`,
    `ALTER TABLE ${sqlIdentifier(entityKey)} ADD COLUMN ${sqlIdentifier(field.key)} ${type};`,
    ''
  ].join('\n');
}

/** Données d’exemple converties en INSERT avec échappement SQL strict. */
function sqliteSeed(spec) {
  const lines = [
    `-- Données d’exemple de ${spec.app.name}. Exécutées une seule fois, à la première installation.`,
    ''
  ];
  const byKey = new Map(spec.entities.map((entity) => [entity.key, entity]));
  const ids = new Map();

  // Les relations du seed peuvent contenir un libellé : on le résout à partir des lignes insérées.
  for (const entity of spec.entities) {
    const rows = spec.seed?.[entity.key] || [];
    ids.set(entity.key, new Map());
    const labelField = entity.labelField;
    for (const row of rows) {
      const label = row[labelField];
      if (label !== undefined && label !== null) ids.get(entity.key).set(String(label).toLowerCase(), null);
    }
  }

  for (const entity of spec.entities) {
    const rows = spec.seed?.[entity.key] || [];
    if (!rows.length) continue;
    lines.push(`-- ${entity.namePlural}`);
    rows.forEach((row, index) => {
      const id = index + 1;
      const columns = ['"id"'];
      const values = [String(id)];
      const label = row[entity.labelField];
      if (label !== undefined && label !== null) ids.get(entity.key).set(String(label).toLowerCase(), id);
      for (const field of entity.fields) {
        const value = row[field.key];
        if (value === undefined || value === null) continue;
        columns.push(sqlIdentifier(field.key));
        if (field.type === 'relation') {
          const target = byKey.get(field.target);
          const targetId = ids.get(field.target)?.get(String(value).toLowerCase()) ?? (typeof value === 'number' ? value : null);
          values.push(targetId === null || targetId === undefined || !target ? 'NULL' : String(targetId));
        } else if (typeof value === 'boolean') {
          values.push(value ? '1' : '0');
        } else if (typeof value === 'number') {
          values.push(Number.isFinite(value) ? String(value) : 'NULL');
        } else {
          values.push(sqlString(value));
        }
      }
      // Horodatage fixe : le seed doit être déterministe, sinon sa somme de
      // contrôle change à chaque régénération et SQLx refuse la base existante.
      const stamp = sqlString(new Date(Date.UTC(2026, 0, 1, 9 + index)).toISOString());
      columns.push('"createdAt"', '"updatedAt"');
      values.push(stamp);
      values.push(stamp);
      lines.push(`INSERT INTO ${sqlIdentifier(entity.key)} (${columns.join(', ')}) VALUES (${values.join(', ')});`);
    });
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

async function readBlockAssets(block) {
  const rendererPath = path.join(block.dir, 'renderer.js');
  const stylePath = path.join(block.dir, 'style.css');
  try {
    const [renderer, style] = await Promise.all([
      fs.readFile(rendererPath, 'utf8'),
      fs.readFile(stylePath, 'utf8')
    ]);
    return { renderer, style };
  } catch (error) {
    throw new Error(`Le bloc « ${block.id} » est incomplet : ${error.message}`);
  }
}

async function walkFiles(dir, prefix = '') {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await walkFiles(full, relative));
    else files.push({ relative, full });
  }
  return files;
}

/**
 * Enveloppe de bureau Tauri 2 : `src-tauri/` avec configuration, plugin SQL,
 * migrations et icônes. Les fichiers web sont copiés dans `src-tauri/web/`.
 */
async function buildDesktopFiles(spec, appId, files, packaging, migrationFiles = null) {
  const scaffoldDir = path.join(getScaffoldPath('tauri'), 'files');
  const scaffoldFiles = await walkFiles(scaffoldDir);
  const icons = createIconSet({ accent: spec.app.accent });
  const tokens = {
    APP_CRATE: packaging.crate,
    APP_VERSION: packaging.version,
    APP_DESCRIPTION: packaging.description.replaceAll('"', "'"),
    APP_SHORT_DESCRIPTION: packaging.shortDescription.replaceAll('"', "'"),
    APP_NAME: packaging.name,
    APP_IDENTIFIER: packaging.identifier,
    DB_FILE: packaging.databaseFile,
    PUBLISHER: packaging.publisher,
    COPYRIGHT: packaging.copyright,
    TAURI_CLI_VERSION: packaging.tauriCliVersion
  };

  const desktop = {};

  for (const file of scaffoldFiles) {
    if (file.relative.startsWith('icons/')) continue;
    const relative = `src-tauri/${file.relative.replace(/\.tpl$/, '')}`;
    const raw = await fs.readFile(file.full, 'utf8');
    desktop[relative] = fillTokens(raw, tokens);
  }

  for (const [name, buffer] of Object.entries(icons)) {
    desktop[`src-tauri/icons/${name}`] = buffer;
  }

  // Code de l’application (interface + assets) embarqué dans le binaire.
  for (const [relative, content] of Object.entries(files)) {
    desktop[`src-tauri/web/${relative}`] = content;
  }

  // Dépendances JS du plugin SQL, embarquées comme modules ES (version épinglée, sans CDN ni bundler).
  const vendorDir = path.join(getScaffoldPath('tauri'), 'files', 'vendor');
  for (const file of await walkFiles(vendorDir)) {
    desktop[`src-tauri/web/vendor/${file.relative}`] = await fs.readFile(file.full);
  }

  if (migrationFiles && Object.keys(migrationFiles).length) {
    // L’historique des migrations est immuable : on le reprend tel quel pour
    // ne pas rejouer un schéma déjà appliqué sur les bases existantes.
    for (const [relative, content] of Object.entries(migrationFiles)) {
      desktop[`src-tauri/${relative}`] = content;
    }
  } else {
    desktop['src-tauri/migrations/0001_init.sql'] = sqliteMigration(spec);
    desktop['src-tauri/migrations/0002_seed.sql'] = sqliteSeed(spec);
  }

  return desktop;
}

export async function generateProject({ spec, appId, prompt = '', createdAt = new Date().toISOString(), extensionFiles = {}, extensionIds = [], migrationFiles = null }) {
  if (!/^[a-z0-9][a-z0-9-]{2,60}$/.test(appId)) throw new Error('Identifiant d’application invalide.');

  const usedTypes = [...new Set(spec.screens.map((screen) => screen.type))];
  const blocks = usedTypes.map((type) => {
    const block = getBlock(type);
    if (!block) throw new Error(`Aucun bloc « ${type} » dans la bibliothèque.`);
    return block;
  });
  const assets = await Promise.all(blocks.map(readBlockAssets));

  const generatedDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(createdAt));
  const storageKey = `appmaker.v1.${appId}`;
  // `databaseFile` est consommé par le client SQL : il doit correspondre au nom
  // de base enregistré pour les migrations de l’enveloppe Tauri.
  const appConfig = { id: appId, generatedAt: createdAt, databaseFile: `${appId}.db`, ...spec };
  const blockRenderers = assets.map((asset, index) => `// ── Bloc ${blocks[index].name} (${blocks[index].id}) ──\n${asset.renderer.trim()}`).join('\n\n');
  const rendererMap = blocks.filter((block) => block.renderer).map((block) => `${block.id}: ${block.renderer}`).join(', ');
  const blockStyles = assets.map((asset, index) => `/* ── Bloc ${blocks[index].name} (${blocks[index].id}) ── */\n${asset.style.trim()}`).join('\n\n');

  const promptQuote = String(prompt || spec.app.tagline).replace(/\n+/g, '\n> ');

  const tokens = {
    APP_ID: appId,
    APP_NAME: spec.app.name,
    APP_TAGLINE: spec.app.tagline,
    APP_INITIAL: htmlEscape(appInitials(spec.app.name)),
    ACCENT: spec.app.accent,
    GENERATED_DATE: generatedDate,
    PROMPT: promptQuote.replaceAll('|', '\\|'),
    STORAGE_KEY: storageKey,
    ENTITY_LIST: entityMarkdown(spec),
    SCREEN_LIST: screenMarkdown(spec),
    BLOCK_LIST: blockMarkdown(blocks),
    APP_CONFIG: JSON.stringify(appConfig, null, 2),
    BLOCK_RENDERERS: blockRenderers,
    RENDERER_MAP: rendererMap
  };

  const files = {};
  const scaffoldDir = path.join(getScaffoldPath('web'), 'files');
  const scaffoldFiles = await walkFiles(scaffoldDir);

  for (const file of scaffoldFiles) {
    const relative = file.relative.replace(/\.tpl$/, '');
    let content = await fs.readFile(file.full, 'utf8');
    if (relative === 'index.html') {
      content = fillTokens(content, {
        APP_NAME: htmlEscape(spec.app.name),
        APP_TAGLINE: htmlEscape(spec.app.tagline),
        APP_INITIAL: tokens.APP_INITIAL,
        ACCENT: spec.app.accent
      });
    } else if (relative === 'assets/app.css') {
      content = fillTokens(content, { ACCENT: spec.app.accent });
      content = `${content}\n\n/* ══════════ Styles des blocs ══════════ */\n${blockStyles}\n`;
    } else if (relative === 'assets/app.js') {
      content = fillTokens(content, {
        APP_CONFIG: tokens.APP_CONFIG,
        BLOCK_RENDERERS: tokens.BLOCK_RENDERERS,
        RENDERER_MAP: tokens.RENDERER_MAP
      });
    } else if (relative === 'README.md') {
      content = fillTokens(content, tokens);
    }
    files[relative] = content;
  }


  // Le registre est généré : il importe statiquement les extensions présentes
  // dans le projet, ce qui fonctionne aussi bien dans l’aperçu que dans le binaire.
  const extensionImports = extensionIds.map((id, index) => `import extension${index} from '../extensions/${id}/index.js';`).join('\n');
  const extensionList = extensionIds.map((_, index) => `extension${index}`).join(', ');
  files['assets/extensions.generated.js'] = `// Généré par AppMaker : modules d’extension chargés par l’application.
${extensionImports ? `${extensionImports}\n\n` : ''}export const extensionModules = [${extensionList}];
`;

  // Les extensions vivent dans le projet et sont copiées telles quelles.
  for (const [relative, content] of Object.entries(extensionFiles || {})) {
    files[relative] = content;
  }

  files['favicon.svg'] = favicon(spec);
  files['data/spec.json'] = `${JSON.stringify(spec, null, 2)}\n`;
  files['data/schema.sql'] = sqliteDocument(spec);
  files['appmaker.json'] = `${JSON.stringify({
    generator: 'AppMaker',
    version: VERSION,
    scaffold: 'web',
    appId,
    createdAt,
    prompt,
    blocks: blocks.map((block) => ({ id: block.id, name: block.name })),
    extensions: extensionIds,
    specFile: 'data/spec.json'
  }, null, 2)}\n`;

  const packaging = buildPackaging(appId, spec);
  const desktop = await buildDesktopFiles(spec, appId, files, packaging, migrationFiles);
  const allFiles = { ...files, ...desktop };

  // Toute la génération est déterministe à partir des fichiers ci-dessus.
  return {
    files: allFiles,
    webFiles: files,
    desktopFiles: desktop,
    packaging,
    blocks: blocks.map((block) => ({ id: block.id, name: block.name, description: block.description })),
    storageKey
  };
}

export async function writeProjectFiles(files, rootDir) {
  for (const [relative, content] of Object.entries(files)) {
    const target = path.resolve(rootDir, relative);
    if (!isInside(rootDir, target)) throw new Error(`Chemin de fichier invalide : ${relative}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    if (Buffer.isBuffer(content)) await fs.writeFile(target, content);
    else await fs.writeFile(target, content, 'utf8');
  }
}

function isInside(root, target) {
  const relative = path.relative(path.resolve(root), target);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}
