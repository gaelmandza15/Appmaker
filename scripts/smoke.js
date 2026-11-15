import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createAppId, getDemoSpec, normalizeSpec } from '../src/spec.js';
import { generateProject, sqliteAddColumn, writeProjectFiles } from '../src/generator.js';
import { createZip } from '../src/zip.js';
import { getLibrary } from '../src/library/catalog.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.chdir(ROOT);

let passed = 0;
function check(condition, label) {
  if (!condition) {
    console.error(`✗ ${label}`);
    process.exitCode = 1;
    return;
  }
  passed += 1;
  console.log(`✓ ${label}`);
}

const smokeDir = path.join(ROOT, 'generated', '_smoke');
let failed = false;

try {
  const library = getLibrary();
  check(library.blocks.length >= 2, 'La bibliothèque expose les blocs dashboard et crud');
  check(library.scaffolds.some((scaffold) => scaffold.id === 'web'), 'Le scaffold web est disponible');
  check(library.scaffolds.some((scaffold) => scaffold.id === 'tauri'), 'Le scaffold Tauri est disponible');

  const hostRoot = path.join(ROOT, 'src', 'host');
  const hostFiles = ['Cargo.toml', 'build.rs', 'tauri.conf.json', 'capabilities/default.json', 'src/main.rs', 'installer.nsi.tpl'];
  check(hostFiles.every((file) => existsSync(path.join(hostRoot, file))), 'Le crate hôte et son template NSIS sont présents');
  const installerTemplate = await fs.readFile(path.join(hostRoot, 'installer.nsi.tpl'), 'utf8');
  check(installerTemplate.includes('{{APP_NAME}}') && installerTemplate.includes('{{PAYLOAD_DIR}}'), 'Le template NSIS est paramétré par application');
  check(installerTemplate.includes('RequestExecutionLevel user'), 'L’installateur s’installe par utilisateur, sans administrateur');
  check(installerTemplate.includes('Section "Uninstall"'), 'L’installateur fournit un désinstalleur');

  const spec = getDemoSpec();
  check(spec.entities.length === 3, 'La spec de démo contient 3 entités');
  check(Object.values(spec.seed).every((rows) => rows.length >= 4), 'Les données de démo sont renseignées');

  const appId = createAppId('Smoke Test');
  const result = await generateProject({
    spec,
    appId,
    prompt: 'Je veux une application de gestion de stock pour un monteur',
    createdAt: new Date().toISOString()
  });

  const requiredFiles = [
    'index.html',
    'assets/app.css',
    'assets/app.js',
    'assets/db.js',
    'assets/ui.js',
    'data/spec.json',
    'data/schema.sql',
    'appmaker.json',
    'favicon.svg',
    'README.md'
  ];
  check(requiredFiles.every((file) => Object.prototype.hasOwnProperty.call(result.files, file)), 'Tous les fichiers du projet sont générés');

  const leftovers = Object.entries(result.files)
    .filter(([, content]) => typeof content === 'string')
    .flatMap(([file, content]) => [...content.matchAll(/\{\{[A-Z0-9_]+\}\}/g)].map((match) => `${file}:${match[0]}`));
  check(leftovers.length === 0, 'Aucun placeholder de template ne reste dans le projet');

  check(result.files['assets/app.js'].includes("from './extensions.generated.js'"), 'Le runtime charge le registre d’extensions');
  check(result.files['assets/app.js'].includes('createRegistry(extensionModules)'), 'Le registre d’extensions est initialisé');
  check(result.files['assets/extensions.generated.js'].includes('extensionModules = []'), 'Sans extension, le registre généré reste vide');
  check(result.files['assets/extensions.js'].includes('rowActions') && result.files['assets/extensions.js'].includes('dashboardWidgets'), 'Le contrat expose les hooks rowActions et dashboardWidgets');
  check(result.files['assets/extensions.js'].includes('screens()') && result.files['assets/extensions.js'].includes('findScreen'), 'Le contrat expose les écrans personnalisés');
  check(result.files['assets/app.js'].includes('EXTENSION_SCREEN_MAP') && result.files['assets/app.js'].includes('renderExtensionScreen'), 'Le routeur charge les écrans d’extension');
  check(result.files['assets/app.js'].includes('runExtensionAction'), 'Les actions d’extension sont branchées sur les clics');
  check(result.files['assets/app.css'].includes('.row-action.is-extension') || result.files['assets/app.css'].includes('is-extension'), 'Les styles des extensions sont injectés');

  const extensionProject = await generateProject({
    spec,
    appId: createAppId('Smoke Extensions'),
    prompt: 'test extension',
    extensionFiles: { 'extensions/demo/index.js': 'export default { id: "demo", name: "Démo", hooks: {} };' },
    extensionIds: ['demo']
  });
  check(extensionProject.files['assets/extensions.generated.js'].includes("from '../extensions/demo/index.js'"), 'Le registre importe les extensions du projet');
  check(extensionProject.files['extensions/demo/index.js'].includes('export default'), 'Les fichiers d’extension sont copiés dans le projet');
  check(extensionProject.desktopFiles['src-tauri/web/extensions/demo/index.js'].includes('export default'), 'Les extensions sont embarquées dans le binaire desktop');
  check(JSON.parse(extensionProject.files['appmaker.json']).extensions.includes('demo'), 'Le manifeste du projet liste les extensions');

  const alter = sqliteAddColumn('produit', { key: 'notes', type: 'textarea' });
  check(alter.includes('ALTER TABLE "produit" ADD COLUMN "notes" TEXT'), 'Une migration additive produit un ALTER TABLE valide');
  const booleanAlter = sqliteAddColumn('produit', { key: 'archive', type: 'boolean' });
  check(booleanAlter.includes('DEFAULT 0') && !booleanAlter.includes('DEFAULT 0 DEFAULT'), 'La migration d’un booléen n’ajoute qu’une valeur par défaut');
  const preserved = await generateProject({
    spec,
    appId: createAppId('Smoke Migrations'),
    prompt: 'test migrations',
    migrationFiles: {
      'migrations/0001_init.sql': 'CREATE TABLE t (id INTEGER);',
      'migrations/0002_seed.sql': 'INSERT INTO t VALUES (1);',
      'migrations/0003_add_note.sql': 'ALTER TABLE t ADD COLUMN note TEXT;'
    }
  });
  check(preserved.desktopFiles['src-tauri/migrations/0003_add_note.sql'].includes('ALTER TABLE'), 'L’historique des migrations est préservé tel quel');
  check(!preserved.desktopFiles['src-tauri/migrations/0001_init.sql'].includes('CREATE TABLE IF NOT EXISTS'), 'Le générateur ne réécrit pas les migrations existantes');

  check(result.files['assets/app.js'].includes('renderDashboard'), 'Le renderer dashboard est injecté');
  check(result.files['assets/app.js'].includes('renderCrud'), 'Le renderer crud est injecté');
  check(result.files['assets/app.css'].includes('.kpi-grid'), 'Les styles du bloc dashboard sont injectés');
  check(result.files['assets/app.css'].includes('.table-card'), 'Les styles du bloc crud sont injectés');
  check(result.files['README.md'].includes('Tauri + SQLite'), 'Le README documente la cible Tauri + SQLite');

  const desktop = result.desktopFiles;
  const requiredDesktop = [
    'src-tauri/Cargo.toml',
    'src-tauri/build.rs',
    'src-tauri/tauri.conf.json',
    'src-tauri/src/main.rs',
    'src-tauri/capabilities/default.json',
    'src-tauri/migrations/0001_init.sql',
    'src-tauri/migrations/0002_seed.sql',
    'src-tauri/web/index.html',
    'src-tauri/web/assets/app.js',
    'src-tauri/web/vendor/sql.js'
  ];
  check(requiredDesktop.every((file) => Object.prototype.hasOwnProperty.call(desktop, file)), 'Les sources de l’enveloppe Tauri sont générées');
  check(desktop['src-tauri/migrations/0001_init.sql'].includes('CREATE TABLE'), 'La migration SQLite crée les tables');
  check(desktop['src-tauri/migrations/0002_seed.sql'].includes('INSERT INTO'), 'La migration de seed insère les données de démo');
  check(desktop['src-tauri/src/main.rs'].includes('tauri_plugin_sql'), 'L’enveloppe Tauri branche le plugin SQL');
  check(desktop['src-tauri/tauri.conf.json'].includes(result.packaging.databaseFile) === false, 'Le nom de la base n’est pas codé dans la config de fenêtre');
  check(result.files['assets/app.js'].includes(`"databaseFile": "${appId}.db"`), 'La configuration web expose le nom de la base SQLite');
  check(result.files['assets/db.js'].includes('../vendor/sql.js'), 'Le client SQL de bureau est résolu depuis le dossier vendor');
  check(result.packaging.identifier === `com.appmaker.${appId.replace(/[^a-z0-9]/g, '')}`, 'L’identifiant Windows est dérivé de l’app');

  await fs.rm(smokeDir, { recursive: true, force: true });
  await writeProjectFiles(result.files, smokeDir);

  for (const file of ['assets/app.js', 'assets/db.js', 'assets/ui.js']) {
    const checked = spawnSync(process.execPath, ['--check', path.join(smokeDir, file)], { encoding: 'utf8' });
    check(checked.status === 0, `Syntaxe JavaScript valide : ${file}`);
    if (checked.status !== 0) console.error(checked.stderr);
  }

  let DatabaseSync = null;
  try {
    ({ DatabaseSync } = await import('node:sqlite'));
  } catch {
    console.log('… Validation SQLite ignorée (node:sqlite indisponible)');
  }
  if (DatabaseSync) {
    const database = new DatabaseSync(':memory:');
    database.exec(result.files['data/schema.sql']);
    const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((row) => row.name);
    check(['fournisseur', 'mouvement', 'produit'].every((table) => tables.includes(table)), 'Le schéma SQLite crée les tables attendues');
    const fournisseurEntity = spec.entities.find((entity) => entity.key === 'fournisseur');
    const produitEntity = spec.entities.find((entity) => entity.key === 'produit');
    const sampleValue = (field, entityKey) => {
      if (field.type === 'number' || field.type === 'money') return 4;
      if (field.type === 'boolean') return 1;
      if (field.type === 'date') return '2026-01-01';
      if (field.type === 'select') return (field.options || ['smoke'])[0];
      if (field.type === 'relation') return entityKey === 'produit' ? 1 : null;
      return `Smoke ${field.label || field.key}`;
    };
    const insert = (entity, extra = {}) => {
      const columns = entity.fields.map((field) => field.key).concat(['createdAt', 'updatedAt']);
      const values = entity.fields.map((field) => sampleValue(field, entity.key))
        .concat(['2026-01-01', '2026-01-01'])
        .map((value) => value === null ? 'NULL' : typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`);
      database.exec(`INSERT INTO ${entity.key} (${columns.map((column) => `"${column}"`).join(', ')}) VALUES (${values.join(', ')})`);
    };
    insert(fournisseurEntity);
    insert(produitEntity);
    const relationField = produitEntity.fields.find((field) => field.type === 'relation');
    const row = relationField
      ? database.prepare(`SELECT produit.nom, ${relationField.key}.nom AS cible FROM produit JOIN ${relationField.key} ON ${relationField.key}.id = produit.${relationField.key}`).get()
      : database.prepare('SELECT nom FROM produit').get();
    check(relationField ? row?.cible?.startsWith('Smoke') : Boolean(row?.nom), 'La relation SQLite produit → fournisseur est valide');
    database.close();
  }

  const archive = createZip(result.files);
  const desktopArchive = createZip(desktop);
  check(desktopArchive.readUInt32LE(0) === 0x04034b50, 'Les sources Tauri sont archivables en ZIP');
  check(archive.readUInt32LE(0) === 0x04034b50, 'En-tête ZIP local valide');
  const eocd = archive.length - 22;
  check(archive.readUInt32LE(eocd) === 0x06054b50, 'Répertoire central ZIP valide');
  check(archive.readUInt16LE(eocd + 10) === Object.keys(result.files).length, 'Le ZIP contient tous les fichiers');
  check(archive.includes(Buffer.from('data/schema.sql')), 'Le schéma SQLite est inclus dans le ZIP');

  const malicious = JSON.parse(JSON.stringify({
    app: { name: 'Test clés réservées' },
    entities: [{
      key: '__proto__',
      name: 'Chose',
      fields: [
        { key: 'id', label: 'Identifiant', type: 'text' },
        { key: 'constructor', label: 'Constructeur', type: 'text' },
        { key: 'updatedAt', label: 'Date de mise à jour', type: 'date' }
      ]
    }],
    screens: [],
    seed: {}
  }));
  const safe = normalizeSpec(malicious, { prompt: 'test de robustesse' });
  const entityKeys = safe.entities.map((entity) => entity.key);
  const fieldKeys = safe.entities.flatMap((entity) => entity.fields.map((field) => field.key));
  check(entityKeys.every((key) => !['__proto__', 'constructor', 'prototype'].includes(key)), 'Les clés d’entités dangereuses sont neutralisées');
  check(fieldKeys.every((key) => !['id', 'createdAt', 'updatedAt', 'constructor', '__proto__'].includes(key)), 'Les clés de champs réservées sont neutralisées');
  check(safe.screens.some((screen) => screen.type === 'dashboard') && safe.screens.some((screen) => screen.type === 'crud'), 'Les écrans par défaut sont complétés');

  console.log(`\nSmoke test terminé : ${passed} vérifications réussies.`);
} catch (error) {
  failed = true;
  console.error('\nSmoke test échoué :', error);
  process.exitCode = 1;
} finally {
  await fs.rm(smokeDir, { recursive: true, force: true }).catch(() => {});
  if (failed) process.exitCode = 1;
}
