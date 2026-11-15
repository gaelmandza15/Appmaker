import http from 'node:http';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './src/config.js';
import { AiError, generatePlan, refinePlan } from './src/ai.js';
import { createAppId, getDemoSpec } from './src/spec.js';
import { buildPackaging, generateProject, sqliteAddColumn, writeProjectFiles } from './src/generator.js';
import { detectToolchain, getArtifact, getBuildBundle, getBuildStatus, toBuildSnapshot, startBuild, stopAllBuilds, invalidateBuild } from './src/builder.js';
import { runAgent } from './src/agent.js';
import { browserStatus, closeBrowserSessions } from './src/browser.js';
import { getLibrarySummary } from './src/library/catalog.js';
import { createZip } from './src/zip.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_DIR = path.join(ROOT, 'studio');
const APPS_DIR = path.join(ROOT, 'data', 'apps');
const VERSION = '0.1.0';

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.zip': 'application/zip',
  '.exe': 'application/vnd.microsoft.portable-executable'
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'none'",
  "form-action 'self'"
].join('; ');

class HttpError extends Error {
  constructor(status, message, code = 'HTTP_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS,
    ...extraHeaders
  });
  res.end(body);
}

function sendError(res, status, message, code = 'ERROR') {
  sendJson(res, status, { error: { message, code } });
}

function sendRedirect(res, location) {
  res.writeHead(302, { Location: location, ...SECURITY_HEADERS });
  res.end();
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new HttpError(413, 'La requête est trop volumineuse.', 'PAYLOAD_TOO_LARGE');
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Corps de requête JSON invalide.', 'INVALID_JSON');
  }
}

function cleanPrompt(value) {
  if (typeof value !== 'string') throw new HttpError(400, 'Décrivez l’application souhaitée.', 'PROMPT_REQUIRED');
  const prompt = value.replace(/\r\n/g, '\n').trim();
  if (prompt.length < 3) throw new HttpError(400, 'La description est trop courte pour concevoir une application.', 'PROMPT_TOO_SHORT');
  if (prompt.length > config.maxPromptLength) throw new HttpError(400, `La description dépasse ${config.maxPromptLength} caractères.`, 'PROMPT_TOO_LONG');
  return prompt;
}

function cleanInstruction(value) {
  if (typeof value !== 'string') throw new HttpError(400, 'Précisez la modification souhaitée.', 'INSTRUCTION_REQUIRED');
  const instruction = value.replace(/\r\n/g, '\n').trim();
  if (instruction.length < 3) throw new HttpError(400, 'La modification demandée est trop courte.', 'INSTRUCTION_TOO_SHORT');
  if (instruction.length > 1500) throw new HttpError(400, 'La modification dépasse 1500 caractères.', 'INSTRUCTION_TOO_LONG');
  return instruction;
}

function isValidAppId(id) {
  return typeof id === 'string' && /^[a-z0-9][a-z0-9-]{2,60}$/.test(id);
}

function appPaths(id) {
  const dir = path.join(APPS_DIR, id);
  return {
    dir,
    files: path.join(dir, 'files'),
    manifest: path.join(dir, 'manifest.json'),
    spec: path.join(dir, 'spec.json')
  };
}

async function readManifest(id) {
  if (!isValidAppId(id)) return null;
  try {
    return JSON.parse(await fs.readFile(appPaths(id).manifest, 'utf8'));
  } catch {
    return null;
  }
}

async function readSpec(id) {
  try {
    return JSON.parse(await fs.readFile(appPaths(id).spec, 'utf8'));
  } catch {
    return null;
  }
}

async function walkDir(dir, prefix = '') {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await walkDir(path.join(dir, entry.name), relative));
    else files.push(relative);
  }
  return files.sort();
}

const TEXT_EXTENSIONS = new Set(['.html', '.css', '.js', '.json', '.svg', '.md', '.sql', '.txt', '.rs', '.toml', '.gitignore']);

async function readProjectFiles(id) {
  const dir = appPaths(id).files;
  const list = await walkDir(dir);
  const files = {};
  for (const relative of list) {
    const extension = path.extname(relative).toLowerCase();
    if (relative === 'src-tauri/build.rs' || TEXT_EXTENSIONS.has(extension)) {
      files[relative] = await fs.readFile(path.join(dir, relative), 'utf8');
    } else if (relative.endsWith('.ico')) {
      files[relative] = `[icône Windows binaire — ${(await fs.stat(path.join(dir, relative))).size} octets]`;
    }
  }
  return files;
}

function publicApp(manifest) {
  const build = getBuildStatus(manifest.id) || manifest.build || null;
  return {
    id: manifest.id,
    name: manifest.name,
    tagline: manifest.tagline,
    accent: manifest.accent,
    createdAt: manifest.createdAt,
    prompt: manifest.prompt,
    refineInstruction: manifest.refineInstruction || null,
    parentId: manifest.parentId || null,
    entityCount: manifest.entityCount,
    screenCount: manifest.screenCount,
    blocks: manifest.blocks || [],
    model: manifest.model || null,
    storageKey: manifest.storageKey || null,
    packaging: manifest.packaging || buildPackaging(manifest.id, { app: { name: manifest.name, tagline: manifest.tagline, accent: manifest.accent } }),
    build: build ? {
      status: build.status,
      stage: build.stage,
      stages: build.stages,
      artifacts: build.artifacts,
      error: build.error,
      durationMs: build.durationMs,
      finishedAt: build.finishedAt
    } : null,
    previewUrl: `/preview/${manifest.id}/`,
    downloadUrl: `/api/apps/${manifest.id}/download`
  };
}

async function listApps() {
  const entries = await fs.readdir(APPS_DIR, { withFileTypes: true });
  const apps = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifest = await readManifest(entry.name);
    if (manifest) apps.push(publicApp(manifest));
  }
  apps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return apps.slice(0, 12);
}

async function loadApp(id) {
  const manifest = await readManifest(id);
  if (!manifest) return null;
  const [spec, files] = await Promise.all([readSpec(id), readProjectFiles(id)]);
  if (!spec) return null;
  return { manifest, spec, files };
}

/** Lit les extensions du projet : leurs points d’accroche vivent hors du socle. */
/** Recharge l’historique des migrations : il ne doit jamais être réécrit. */
async function readMigrationFiles(appId) {
  const dir = path.join(appPaths(appId).files, 'src-tauri', 'migrations');
  const files = {};
  let entries = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return files;
  }
  for (const file of entries.sort()) {
    if (!file.endsWith('.sql')) continue;
    files[`migrations/${file}`] = await fs.readFile(path.join(dir, file), 'utf8');
  }
  return files;
}

async function readExtensions(appId) {
  const root = path.join(appPaths(appId).files, 'extensions');
  const files = {};
  const ids = [];
  let entries = [];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return { files, ids };
  }
  const directories = entries.filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of directories) {
    const dir = path.join(root, entry.name);
    if (!existsSync(path.join(dir, 'index.js'))) continue;
    ids.push(entry.name);
    for (const relative of await walkDir(dir)) {
      if (!/.(js|json|css)$/i.test(relative)) continue;
      files[`extensions/${entry.name}/${relative}`] = await fs.readFile(path.join(dir, relative), 'utf8');
    }
  }
  return { files, ids };
}

/**
 * Régénère le socle et les blocs en réintégrant les extensions, puis invalide
 * le build précédent : une extension modifiée doit produire un nouvel installateur.
 */
async function syncProject(appId) {
  const manifest = await readManifest(appId);
  const spec = await readSpec(appId);
  if (!manifest || !spec) throw new HttpError(404, 'Application introuvable.', 'APP_NOT_FOUND');
  const { files: extensionFiles, ids } = await readExtensions(appId);
  const migrationFiles = await readMigrationFiles(appId);
  const createdAt = manifest.createdAt || new Date().toISOString();
  const project = await generateProject({
    spec,
    appId,
    prompt: manifest.prompt || '',
    createdAt,
    extensionFiles,
    extensionIds: ids,
    migrationFiles: Object.keys(migrationFiles).length ? migrationFiles : null
  });
  await writeProjectFiles(project.files, appPaths(appId).files);
  const next = {
    ...manifest,
    extensions: ids,
    packaging: { ...project.packaging, generatedAt: createdAt },
    build: null
  };
  await fs.writeFile(appPaths(appId).manifest, `${JSON.stringify(next, null, 2)}
`, 'utf8');
  invalidateBuild(appId);
  return { ids, files: project.files };
}

async function persistApp({ spec, prompt, model, usage, parentId = null, refineInstruction = null }) {
  let appId = null;
  let paths = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const candidate = createAppId(spec.app.name);
    const candidatePaths = appPaths(candidate);
    try {
      await fs.mkdir(candidatePaths.dir, { recursive: false });
      appId = candidate;
      paths = candidatePaths;
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  if (!appId || !paths) throw new Error('Impossible de réserver un identifiant d’application.');

  const createdAt = new Date().toISOString();
  try {
    const project = await generateProject({ spec, appId, prompt, createdAt });
    await writeProjectFiles(project.files, paths.files);
    const manifest = {
      id: appId,
      name: spec.app.name,
      tagline: spec.app.tagline,
      accent: spec.app.accent,
      createdAt,
      prompt,
      parentId,
      refineInstruction,
      entityCount: spec.entities.length,
      screenCount: spec.screens.length,
      blocks: project.blocks,
      model: model || null,
      usage: usage || null,
      storageKey: project.storageKey,
      packaging: { ...project.packaging, generatedAt: createdAt },
      build: null
    };
    await Promise.all([
      fs.writeFile(paths.manifest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
      fs.writeFile(paths.spec, `${JSON.stringify(spec, null, 2)}\n`, 'utf8')
    ]);
    return { manifest, spec, files: project.files, project };
  } catch (error) {
    await fs.rm(paths.dir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

function projectResponse(record, { timings = null } = {}) {
  return {
    app: publicApp(record.manifest),
    spec: record.spec,
    files: record.files,
    generation: {
      model: record.manifest.model,
      usage: record.manifest.usage,
      timings
    }
  };
}

function safeJoin(root, userPath) {
  const decoded = decodeURIComponent(userPath || '');
  if (decoded.includes('\0')) return null;
  const target = path.resolve(root, `.${path.sep}${decoded}`);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return target;
}

async function serveFile(res, filePath, { headOnly = false, downloadName = null } = {}) {
  let data;
  try {
    data = await fs.readFile(filePath);
  } catch {
    sendError(res, 404, 'Fichier introuvable.', 'NOT_FOUND');
    return;
  }
  const extension = path.extname(filePath).toLowerCase();
  const type = MIME[extension] || 'application/octet-stream';
  const headers = {
    'Content-Type': `${type}${/^text\/|^application\/(json|javascript)|^image\/svg/.test(type) ? '; charset=utf-8' : ''}`,
    'Content-Length': data.length,
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS
  };
  if (extension === '.html') headers['Content-Security-Policy'] = CSP;
  if (downloadName) headers['Content-Disposition'] = `attachment; filename="${downloadName}"`;
  res.writeHead(200, headers);
  if (headOnly) res.end();
  else res.end(data);
}

async function serveDirectory(res, root, relativePath, { headOnly = false } = {}) {
  let target = safeJoin(root, relativePath || '');
  if (!target) {
    sendError(res, 404, 'Ressource introuvable.', 'NOT_FOUND');
    return;
  }
  try {
    const stat = await fs.stat(target);
    if (stat.isDirectory()) target = path.join(target, 'index.html');
  } catch {
    sendError(res, 404, 'Ressource introuvable.', 'NOT_FOUND');
    return;
  }
  await serveFile(res, target, { headOnly });
}

async function handleGenerate(req, res) {
  const body = await readJsonBody(req);
  const prompt = cleanPrompt(body.prompt);
  const startedAt = Date.now();
  const plan = await generatePlan(prompt);
  const aiMs = Date.now() - startedAt;
  const recordsStart = Date.now();
  const record = await persistApp({ spec: plan.spec, prompt, model: plan.model, usage: plan.usage });
  sendJson(res, 200, projectResponse(record, {
    timings: { ai: aiMs, generation: Date.now() - recordsStart, total: Date.now() - startedAt }
  }));
}

async function handleDemo(req, res) {
  const body = await readJsonBody(req).catch(() => ({}));
  const startedAt = Date.now();
  const spec = getDemoSpec();
  const prompt = typeof body.prompt === 'string' && body.prompt.trim()
    ? cleanPrompt(body.prompt)
    : 'Application de démonstration : gestion de stock pour un atelier artisanal';
  const record = await persistApp({ spec, prompt, model: 'demo', usage: null });
  sendJson(res, 200, projectResponse(record, {
    timings: { ai: 0, generation: Date.now() - startedAt, total: Date.now() - startedAt }
  }));
}

/**
 * Ajoute un champ par migration additive : le schéma d’origine reste intact,
 * les bases déjà installées reçoivent un ALTER TABLE à la prochaine ouverture.
 */
async function addFieldToApp(appId, { entity: entityKey, key, label, type, options, target, required }) {
  const manifest = await readManifest(appId);
  const spec = await readSpec(appId);
  if (!manifest || !spec) throw new HttpError(404, 'Application introuvable.', 'APP_NOT_FOUND');

  const entity = spec.entities.find((candidate) => candidate.key === entityKey);
  if (!entity) throw new HttpError(400, `Entité inconnue : ${entityKey}`, 'UNKNOWN_ENTITY');

  const fieldKey = String(key || '').trim();
  if (!/^[a-z][A-Za-z0-9]{0,30}$/.test(fieldKey)) {
    throw new HttpError(400, 'Clé de champ invalide : minuscules, chiffres, sans espace.', 'INVALID_FIELD_KEY');
  }
  if (['id', 'createdAt', 'updatedAt', 'constructor', '__proto__', 'prototype'].includes(fieldKey)) {
    throw new HttpError(400, `Clé réservée : ${fieldKey}`, 'RESERVED_FIELD_KEY');
  }
  if (entity.fields.some((field) => field.key === fieldKey)) {
    throw new HttpError(409, `Le champ ${fieldKey} existe déjà sur ${entityKey}.`, 'FIELD_EXISTS');
  }
  if (entity.fields.length >= 14) {
    throw new HttpError(400, 'Limite de 14 champs par entité atteinte.', 'TOO_MANY_FIELDS');
  }
  const allowedTypes = ['text', 'textarea', 'number', 'currency', 'date', 'boolean', 'select', 'relation'];
  const fieldType = allowedTypes.includes(type) ? type : 'text';
  if (fieldType === 'select' && (!Array.isArray(options) || options.length === 0)) {
    throw new HttpError(400, 'Un champ « select » exige des options.', 'MISSING_OPTIONS');
  }
  if (fieldType === 'relation' && !spec.entities.some((candidate) => candidate.key === target)) {
    throw new HttpError(400, 'Relation invalide : entité cible inconnue.', 'INVALID_TARGET');
  }

  const field = {
    key: fieldKey,
    label: String(label || fieldKey).slice(0, 60),
    type: fieldType,
    required: Boolean(required),
    inTable: true,
    ...(fieldType === 'select' ? { options: options.slice(0, 12) } : {}),
    ...(fieldType === 'relation' ? { target } : {})
  };

  const migrationsDir = path.join(appPaths(appId).files, 'src-tauri', 'migrations');
  let entries = [];
  try {
    entries = await fs.readdir(migrationsDir);
  } catch {
    /* première migration : le dossier sera créé */
  }
  const version = Math.max(0, ...entries.map((file) => Number.parseInt(file, 10) || 0)) + 1;
  const slug = fieldKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/[^a-z0-9]+/g, '-').slice(0, 28);
  const migrationName = `${String(version).padStart(4, '0')}_add_${slug}.sql`;
  await fs.mkdir(migrationsDir, { recursive: true });
  await fs.writeFile(path.join(migrationsDir, migrationName), sqliteAddColumn(entityKey, field), 'utf8');

  entity.fields.push(field);
  await fs.writeFile(appPaths(appId).spec, `${JSON.stringify(spec, null, 2)}
`, 'utf8');
  await syncProject(appId);
  return {
    ok: true,
    field: { entity: entityKey, ...field },
    migration: migrationName,
    note: 'Migration additive écrite ; elle sera appliquée aux bases existantes au prochain lancement.'
  };
}

async function handleAgent(req, res, id) {
  const record = await loadApp(id);
  if (!record) throw new HttpError(404, 'Application introuvable.', 'APP_NOT_FOUND');
  const body = await readJsonBody(req);
  const instruction = cleanInstruction(body.instruction);
  const startedAt = Date.now();

  let result;
  try {
    result = await runAgent({
      appId: id,
      projectDir: appPaths(id).files,
      spec: record.spec,
      manifest: record.manifest,
      syncProject: () => syncProject(id),
      addField: (payload) => addFieldToApp(id, payload),
      baseUrl: `http://127.0.0.1:${config.port}`,
      instruction
    });
  } catch (error) {
    throw new HttpError(error.status || 500, error.message || 'L’agent a échoué.', error.code || 'AGENT_ERROR');
  }

  // Une dernière synchronisation garantit que l’aperçu et le build voient l’état final.
  await syncProject(id);
  const updated = await loadApp(id);
  sendJson(res, 200, {
    run: {
      summary: result.summary,
      changedFiles: result.changedFiles,
      usage: result.usage
    },
    transcript: result.transcript,
    timings: { total: Date.now() - startedAt },
    ...(updated ? { app: publicApp(updated.manifest), spec: updated.spec, files: updated.files } : {})
  });
}

async function handleRefine(req, res, id) {
  const parent = await loadApp(id);
  if (!parent) throw new HttpError(404, 'Application introuvable.', 'APP_NOT_FOUND');
  const body = await readJsonBody(req);
  const instruction = cleanInstruction(body.instruction);
  const originalPrompt = parent.manifest.prompt || parent.spec.app.tagline;
  const startedAt = Date.now();
  const plan = await refinePlan({ spec: parent.spec, instruction, originalPrompt });
  const aiMs = Date.now() - startedAt;
  const generationStart = Date.now();
  const record = await persistApp({
    spec: plan.spec,
    prompt: originalPrompt,
    model: plan.model,
    usage: plan.usage,
    parentId: id,
    refineInstruction: instruction
  });
  sendJson(res, 200, projectResponse(record, {
    timings: { ai: aiMs, generation: Date.now() - generationStart, total: Date.now() - startedAt }
  }));
}

async function handleDownloadZip(res, id) {
  if (!isValidAppId(id)) throw new HttpError(404, 'Application introuvable.', 'APP_NOT_FOUND');
  const manifest = await readManifest(id);
  if (!manifest) throw new HttpError(404, 'Application introuvable.', 'APP_NOT_FOUND');
  const files = await readProjectFiles(id);
  const archive = createZip(files);
  res.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-Length': archive.length,
    'Content-Disposition': `attachment; filename="${id}.zip"`,
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS
  });
  res.end(archive);
}

async function handleBuildStart(req, res, id) {
  const record = await loadApp(id);
  if (!record) throw new HttpError(404, 'Application introuvable.', 'APP_NOT_FOUND');
  const stat = getBuildStatus(id);
  if (stat && (stat.status === 'running' || stat.status === 'queued')) {
    sendJson(res, 202, { build: stat });
    return;
  }
  const result = await startBuild({ appId: id, projectDir: appPaths(id).files, spec: record.spec });
  const status = result?.status === 'success' ? 200 : 422;
  if (result) {
    record.manifest.build = toBuildSnapshot(result);
    await fs.writeFile(appPaths(id).manifest, `${JSON.stringify(record.manifest, null, 2)}\n`, 'utf8').catch(() => {});
  }
  sendJson(res, status, { build: result });
}

async function handleDownloadExe(res, id, url) {
  if (!isValidAppId(id)) throw new HttpError(404, 'Application introuvable.', 'APP_NOT_FOUND');
  const requested = url.searchParams.get('kind');
  const kind = requested === 'portable' || requested === 'exe' ? 'portable' : 'installer';
  const artifact = getArtifact(id, kind);
  if (!artifact) throw new HttpError(404, 'Ce build n’est pas encore disponible.', 'BUILD_NOT_READY');
  const downloadName = encodeURIComponent(path.basename(artifact.file)).replaceAll('%20', ' ');
  res.writeHead(200, {
    'Content-Type': kind === 'portable' ? 'application/zip' : 'application/vnd.microsoft.portable-executable',
    'Content-Length': artifact.size,
    'Content-Disposition': `attachment; filename="${downloadName}"; filename*=UTF-8''${encodeURIComponent(path.basename(artifact.file))}`,
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS
  });
  if (url.searchParams.has('head')) {
    res.end();
    return;
  }
  const data = await fs.readFile(artifact.path);
  res.end(data);
}

async function handleBuildBundle(res, id) {
  const record = await loadApp(id);
  if (!record) throw new HttpError(404, 'Application introuvable.', 'APP_NOT_FOUND');
  const files = await getBuildBundle(appPaths(id).files);
  const archive = createZip(files);
  res.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-Length': archive.length,
    'Content-Disposition': `attachment; filename="${id}-sources.zip"`,
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS
  });
  res.end(archive);
}

async function handleApi(req, res, url) {
  const pathname = decodeURIComponent(url.pathname);
  const method = req.method || 'GET';

  if (pathname === '/api/health' && method === 'GET') {
    const library = getLibrarySummary();
    sendJson(res, 200, {
      ok: true,
      version: VERSION,
      ai: Boolean(config.apiKey),
      model: config.model,
      blocks: library.blocks.length,
      scaffolds: library.scaffolds.length
    });
    return true;
  }

  if (pathname === '/api/browser' && method === 'GET') {
    sendJson(res, 200, await browserStatus());
    return true;
  }

  if (pathname === '/api/toolchain' && method === 'GET') {
    const toolchain = await detectToolchain({ refresh: url.searchParams.has('refresh') });
    sendJson(res, 200, toolchain);
    return true;
  }

  if (pathname === '/api/library' && method === 'GET') {
    sendJson(res, 200, getLibrarySummary());
    return true;
  }

  if (pathname === '/api/apps' && method === 'GET') {
    sendJson(res, 200, { apps: await listApps() });
    return true;
  }

  if (pathname === '/api/generate' && method === 'POST') {
    await handleGenerate(req, res);
    return true;
  }

  if (pathname === '/api/demo' && method === 'POST') {
    await handleDemo(req, res);
    return true;
  }

  const match = pathname.match(/^\/api\/apps\/([a-z0-9][a-z0-9-]+)(?:\/(files|download|download-exe|refine|agent|build|bundle))?$/);
  if (match) {
    const id = match[1];
    const action = match[2] || null;
    if (action === 'download' && method === 'GET') {
      await handleDownloadZip(res, id);
      return true;
    }
    if (action === 'download-exe' && method === 'GET') {
      await handleDownloadExe(res, id, url);
      return true;
    }
    if (action === 'build' && method === 'GET') {
      const build = getBuildStatus(id);
      if (!build) throw new HttpError(404, 'Aucun build pour cette application.', 'NO_BUILD');
      sendJson(res, 200, { build });
      return true;
    }
    if (action === 'build' && method === 'POST') {
      await handleBuildStart(req, res, id);
      return true;
    }
    if (action === 'bundle' && method === 'GET') {
      await handleBuildBundle(res, id);
      return true;
    }
    if (action === 'refine' && method === 'POST') {
      await handleRefine(req, res, id);
      return true;
    }
    if (action === 'agent' && method === 'POST') {
      await handleAgent(req, res, id);
      return true;
    }
    if (action === 'files' && method === 'GET') {
      const manifest = await readManifest(id);
      if (!manifest) throw new HttpError(404, 'Application introuvable.', 'APP_NOT_FOUND');
      sendJson(res, 200, { app: publicApp(manifest), files: await readProjectFiles(id) });
      return true;
    }
    if (!action && method === 'GET') {
      const record = await loadApp(id);
      if (!record) throw new HttpError(404, 'Application introuvable.', 'APP_NOT_FOUND');
      sendJson(res, 200, projectResponse(record));
      return true;
    }
    throw new HttpError(405, 'Méthode non autorisée pour cette ressource.', 'METHOD_NOT_ALLOWED');
  }

  return false;
}

async function handleRequest(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const method = req.method || 'GET';

  if (url.pathname.startsWith('/api/')) {
    const handled = await handleApi(req, res, url);
    if (!handled) sendError(res, 404, 'Endpoint inconnu.', 'NOT_FOUND');
    return;
  }

  const headOnly = method === 'HEAD';
  if (method !== 'GET' && !headOnly) {
    sendError(res, 405, 'Méthode non autorisée.', 'METHOD_NOT_ALLOWED');
    return;
  }

  if (url.pathname === '/' || url.pathname === '/studio') {
    sendRedirect(res, '/studio/');
    return;
  }
  if (url.pathname.startsWith('/studio/')) {
    await serveDirectory(res, STUDIO_DIR, url.pathname.slice('/studio/'.length), { headOnly });
    return;
  }

  const previewMatch = url.pathname.match(/^\/preview\/([a-z0-9][a-z0-9-]+)(\/.*)?$/);
  if (previewMatch) {
    const id = previewMatch[1];
    const relative = previewMatch[2] || '/';
    const manifest = await readManifest(id);
    if (!manifest) {
      sendError(res, 404, 'Application introuvable.', 'APP_NOT_FOUND');
      return;
    }
    await serveDirectory(res, path.join(appPaths(id).files, 'src-tauri', 'web'), relative.replace(/^\/+/, ''), { headOnly });
    return;
  }

  sendError(res, 404, 'Ressource introuvable.', 'NOT_FOUND');
}

const server = http.createServer(async (req, res) => {
  try {
    await handleRequest(req, res);
  } catch (error) {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    const status = error instanceof HttpError ? error.status : (error instanceof AiError ? error.status : 500);
    if (status >= 500) console.error('[AppMaker]', error);
    else console.warn('[AppMaker]', error.message);
    sendError(
      res,
      status,
      status >= 500 && !(error instanceof AiError)
        ? 'Une erreur interne est survenue pendant la génération.'
        : error.message,
      error.code || 'INTERNAL_ERROR'
    );
  }
});

await fs.mkdir(APPS_DIR, { recursive: true });
await ensureInitialDemo();

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Le port ${config.port} est déjà utilisé. Changez PORT dans .env ou arrêtez l'autre processus.`);
  } else {
    console.error(error);
  }
  process.exit(1);
});

server.listen(config.port, config.host, () => {
  console.log('');
  console.log('  AppMaker · studio de génération d’applications');
  console.log(`  → http://${config.host}:${config.port}`);
  console.log(`  DeepSeek : ${config.apiKey ? `configuré (${config.model})` : 'non configuré — ajoutez DEEPSEEK_API_KEY dans .env'}`);
  console.log('  Export Windows : build Tauri 2 + installateur NSIS (GET /api/toolchain pour vérifier l’outillage)');
  console.log('');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopAllBuilds();
  closeBrowserSessions();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}

async function ensureInitialDemo() {
  try {
    const apps = await listApps();
    if (apps.length) return;
    const spec = getDemoSpec();
    const record = await persistApp({
      spec,
      prompt: 'Application de démonstration : gestion de stock pour un atelier artisanal',
      model: 'demo'
    });
    console.log(`  Démo initiale disponible : ${record.manifest.name} (${record.manifest.id})`);
  } catch (error) {
    console.warn('  Démo initiale non générée :', error.message);
  }
}
