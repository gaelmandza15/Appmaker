import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildPackaging } from './generator.js';
import { createZip } from './zip.js';

const STAGES = [
  { id: 'prepare', label: 'Préparation de l’application' },
  { id: 'host', label: 'Mise à jour de l’hôte précompilé' },
  { id: 'payload', label: 'Assemblage des ressources' },
  { id: 'package', label: 'Création de l’installateur' }
];

const builders = new Map();
const children = new Set();
let toolchainCache = {};
let hostBuildPromise = null;

/**
 * Toutes les applications partagent un hôte Tauri précompilé, une CLI et un
 * dossier de build communs. Compiler une application ne demande donc plus de
 * toucher à Rust : on assemble un dossier de ressources et on empaquette.
 */
const cacheRoot = process.env.APPMaker_CACHE_DIR || path.join(process.cwd(), 'data', '.build-cache');
const sharedTargetDir = process.env.APPMaker_TARGET_DIR || path.join(cacheRoot, 'target');
const sharedToolingDir = path.join(cacheRoot, 'tooling');
const hostCacheDir = path.join(cacheRoot, 'host');
const hostExePath = path.join(hostCacheDir, 'appmaker-host.exe');
const webview2Bootstrapper = path.join(hostCacheDir, 'MicrosoftEdgeWebview2Setup.exe');
const packagesDir = path.join(cacheRoot, 'packages');
const hostSourceDir = path.join(process.cwd(), 'src', 'host');
const targetTriple = 'x86_64-pc-windows-msvc';

function nowIso() {
  return new Date().toISOString();
}

/** Trouve un exécutable dans le PATH (utilise PATHEXT sous Windows). */
export function which(command) {
  const pathValue = process.env.PATH || '';
  const separator = process.platform === 'win32' ? ';' : ':';
  const extensions = process.platform === 'win32'
    ? (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
    : [''];
  const hasExtension = extensions.some((ext) => command.toLowerCase().endsWith(ext.toLowerCase()));

  for (const dir of pathValue.split(separator).filter(Boolean)) {
    const candidates = hasExtension ? [command] : extensions.map((ext) => `${command}${ext}`);
    for (const candidate of candidates) {
      const full = path.join(dir, candidate);
      try {
        const stat = statSync(full);
        if (stat.isFile()) return full;
      } catch {
        /* entrée suivante */
      }
    }
  }
  return null;
}

function runCapture(command, args, { timeout = 20000, env = process.env } = {}) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let child;
    try {
      child = spawn(command, args, { env, shell: false, windowsHide: true });
    } catch (error) {
      resolve({ code: -1, stdout: '', stderr: error.message });
      return;
    }
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    child.stdout?.on('data', (chunk) => { stdout += chunk; });
    child.stderr?.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: error.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

function powershellPath() {
  const root = process.env.SystemRoot || 'C:\Windows';
  return path.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
}

async function detectBuildTools() {
  if (process.platform !== 'win32') return null;
  if (toolchainCache.buildTools !== undefined) return toolchainCache.buildTools;
  const drive = process.env.SystemDrive || 'C:';
  const vswhere = path.join(drive, 'Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  if (existsSync(vswhere)) {
    const result = await runCapture(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { timeout: 20000 });
    const installation = firstLines(result.stdout, 1)[0];
    if (installation) {
      toolchainCache.buildTools = installation;
      return installation;
    }
  }
  const roots = [path.join(drive, 'Program Files (x86)', 'Microsoft Visual Studio'), path.join(drive, 'Program Files', 'Microsoft Visual Studio')];
  for (const vsRoot of roots) {
    if (!existsSync(vsRoot)) continue;
    let found = null;
    for (const edition of ['BuildTools', 'Community', 'Professional', 'Enterprise']) {
      const base = path.join(vsRoot, '2022', edition);
      const tools = path.join(base, 'VC', 'Tools', 'MSVC');
      if (existsSync(tools)) {
        found = base;
        break;
      }
    }
    if (found) {
      toolchainCache.buildTools = found;
      return found;
    }
  }
  toolchainCache.buildTools = null;
  return null;
}

/** Découpe une sortie de processus en lignes non vides, limitées à `max`. */
function firstLines(output, max = Infinity) {
  return String(output || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, max);
}

/** Localise le compilateur d’installateurs fourni par Tauri (ou présent dans le PATH). */
function findMakensis() {
  const candidates = [];
  if (process.env.APPMaker_MAKENSIS) candidates.push(process.env.APPMaker_MAKENSIS);
  if (process.env.LOCALAPPDATA) candidates.push(path.join(process.env.LOCALAPPDATA, 'tauri', 'NSIS', 'makensis.exe'));
  const fromPath = which('makensis');
  if (fromPath) candidates.push(fromPath);
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

/**
 * Détecte l’outillage. Rust n’est requis que pour construire l’hôte la première
 * fois : dès qu’il est en cache, seuls le compilateur NSIS et Node sont utiles.
 */
export async function detectToolchain({ refresh = false } = {}) {
  if (refresh) toolchainCache = {};
  const cargo = which('cargo') || null;
  const rustup = which('rustup') || null;
  const hostReady = existsSync(hostExePath);
  const makensis = findMakensis();
  const [buildTools, cargoVersion, rustTargets] = await Promise.all([
    detectBuildTools(),
    cargo ? runCapture(cargo, ['--version']) : null,
    rustup ? runCapture(rustup, ['target', 'list', '--installed']) : null
  ]);
  const targets = (rustTargets?.stdout || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const targetInstalled = targets.includes(targetTriple);

  const checks = [
    {
      id: 'platform',
      label: 'Windows',
      ok: process.platform === 'win32',
      detail: 'Le prototype construit des installateurs Windows sur une machine Windows.'
    },
    {
      id: 'host',
      label: 'Hôte précompilé',
      ok: hostReady || Boolean(cargo && buildTools && targetInstalled),
      detail: hostReady
        ? `Réutilisé depuis ${hostExePath}`
        : 'Sera compilé une seule fois au premier build (Rust requis).'
    },
    {
      id: 'rust',
      label: 'Rust (cargo)',
      ok: hostReady || Boolean(cargo),
      detail: hostReady
        ? 'Non requis : l’hôte est déjà compilé.'
        : (cargoVersion?.stdout?.trim() || 'Installez Rust via https://rustup.rs (toolchain stable MSVC).')
    },
    {
      id: 'msvc',
      label: 'MSVC Build Tools',
      ok: hostReady || Boolean(buildTools),
      detail: hostReady
        ? 'Non requis : l’hôte est déjà compilé.'
        : (buildTools || 'Installez Visual Studio Build Tools avec « Desktop development with C++ ».')
    },
    {
      id: 'target',
      label: 'Cible x86_64-pc-windows-msvc',
      ok: hostReady || targetInstalled,
      detail: hostReady ? 'Hôte compilé' : (targetInstalled ? 'Cible installée' : 'Commande : rustup target add x86_64-pc-windows-msvc')
    },
    {
      id: 'nsis',
      label: 'Compilateur NSIS',
      ok: Boolean(makensis),
      detail: makensis || 'Lancez un premier build Tauri ou installez NSIS (makensis).'
    }
  ];

  const ready = checks.every((check) => check.ok);
  return {
    platform: process.platform,
    supported: ready,
    hostReady,
    checks
  };
}

/** Snapshot sérialisable, conservé dans le manifest pour retrouver un build après redémarrage. */
export function toBuildSnapshot(build) {
  if (!build) return null;
  const slim = (artifact) => (artifact ? { file: artifact.file, size: artifact.size, signed: artifact.signed } : undefined);
  return {
    status: build.status,
    stage: build.stages?.find((stage) => stage.status === 'active')?.id || null,
    stages: build.stages || [],
    artifacts: {
      ...build.artifacts,
      installer: slim(build.artifacts?.installer),
      portable: slim(build.artifacts?.portable)
    },
    error: build.error,
    durationMs: build.durationMs,
    finishedAt: build.finishedAt
  };
}

function publicBuild(build, { includeLog = false } = {}) {
  if (!build) return null;
  return {
    appId: build.appId,
    status: build.status,
    stage: build.stages.find((stage) => stage.status === 'active')?.id || null,
    startedAt: build.startedAt,
    finishedAt: build.finishedAt,
    durationMs: build.durationMs,
    stages: build.stages,
    error: build.error,
    toolchainOk: build.toolchainOk,
    artifacts: build.artifacts,
    log: includeLog ? build.log.slice(-120) : undefined
  };
}

export function getBuild(appId) {
  return builders.get(appId) || null;
}

export function getBuildStatus(appId) {
  return publicBuild(getBuild(appId), { includeLog: true });
}

async function walkFiles(dir, prefix = '') {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...await walkFiles(path.join(dir, entry.name), relative));
    else found.push({ relative, full: path.join(dir, entry.name) });
  }
  return found;
}

function runCommand(command, args, cwd, build) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd,
        shell: false,
        windowsHide: true,
        env: {
          ...process.env,
          CARGO_TERM_COLOR: 'never',
          CARGO_TERM_PROGRESS_WHEN: 'never',
          CARGO_TARGET_DIR: sharedTargetDir
        }
      });
    } catch (error) {
      build.log.push(`Erreur de lancement : ${error.message}`);
      resolve({ ok: false, code: -1 });
      return;
    }
    children.add(child);
    const push = (line) => {
      build.log.push(line);
      if (build.log.length > 1500) build.log.splice(0, build.log.length - 1500);
    };
    push(`$ ${path.basename(command)} ${args.join(' ')}`);
    const forward = (chunk) => {
      for (const line of String(chunk).split(/\r?\n/)) {
        if (line.trim()) push(line.slice(0, 400));
      }
    };
    child.stdout?.on('data', forward);
    child.stderr?.on('data', forward);
    child.on('error', (error) => {
      children.delete(child);
      push(`Erreur : ${error.message}`);
      resolve({ ok: false, code: -1 });
    });
    child.on('close', (code) => {
      children.delete(child);
      push(`(fin du processus, code ${code ?? -1})`);
      resolve({ ok: code === 0, code: code ?? -1 });
    });
  });
}

function setStage(build, id, status) {
  const stage = build.stages.find((item) => item.id === id);
  if (!stage) return;
  stage.status = status;
  if (status === 'active') stage.startedAt = nowIso();
  if (status === 'done' || status === 'failed') stage.finishedAt = nowIso();
}

function finish(build, status, error = null) {
  build.status = status;
  build.error = error;
  build.finishedAt = nowIso();
  build.durationMs = Date.now() - new Date(build.startedAt).getTime();
  if (status === 'failed') {
    const active = build.stages.find((stage) => stage.status === 'active');
    if (active) setStage(build, active.id, 'failed');
  }
  for (const child of children) {
    try { child.kill(); } catch { /* déjà terminé */ }
  }
}

/** Résout la CLI Tauri : version globale compatible, cache partagé, sinon installation. */
async function resolveTauriCli(packaging, build) {
  let cargoTauriPath = path.join(sharedToolingDir, 'bin', process.platform === 'win32' ? 'cargo-tauri.exe' : 'cargo-tauri');
  const globalTauri = which('cargo-tauri');
  if (globalTauri) {
    const version = await runCapture(globalTauri, ['--version']);
    const expected = packaging.tauriCliVersion.split('.').slice(0, 2).join('.');
    if (version.stdout.includes(expected)) {
      build.log.push(`CLI Tauri globale réutilisée : ${version.stdout.trim()}`);
      return globalTauri;
    }
  }
  if (existsSync(cargoTauriPath)) {
    build.log.push('Outil de build Tauri déjà disponible dans le cache partagé.');
    return cargoTauriPath;
  }
  const cargo = which('cargo');
  if (!cargo) return null;
  const install = await runCommand(
    cargo,
    ['install', 'tauri-cli', '--version', `^${packaging.tauriCliVersion}`, '--locked', '--root', sharedToolingDir],
    process.cwd(),
    build
  );
  if (!install.ok || !existsSync(cargoTauriPath)) return null;
  return cargoTauriPath;
}

/** Date du fichier source le plus récent du crate hôte. */
async function hostSourceStamp() {
  // Seuls les fichiers qui entrent dans le binaire comptent : le template NSIS,
  // le dossier gen/ et la cible partagée ne doivent pas déclencher de rebuild.
  const relevant = /^(Cargo\.(toml|lock)|build\.rs|tauri\.conf\.json|capabilities\/|icons\/|src\/|web\/)/;
  let newest = 0;
  for (const file of await walkFiles(hostSourceDir)) {
    if (!relevant.test(file.relative)) continue;
    const stat = await fs.stat(file.full);
    newest = Math.max(newest, stat.mtimeMs);
  }
  return newest;
}

/**
 * Compile l’hôte générique une seule fois, puis le réutilise pour toutes les
 * applications. Un changement dans `src/host` déclenche une unique reconstruction.
 */
async function ensureHost(packaging, build) {
  const stamp = await hostSourceStamp();
  if (existsSync(hostExePath)) {
    const cached = await fs.stat(hostExePath);
    if (cached.mtimeMs >= stamp) {
      build.log.push(`Hôte précompilé réutilisé (${Math.round(cached.size / 1024 / 1024 * 10) / 10} Mo).`);
      return hostExePath;
    }
    build.log.push('Sources de l’hôte modifiées : reconstruction.');
  }
  if (hostBuildPromise) {
    build.log.push('Une compilation de l’hôte est déjà en cours, attente…');
    await hostBuildPromise;
    return existsSync(hostExePath) ? hostExePath : null;
  }

  hostBuildPromise = (async () => {
    const cargoTauri = await resolveTauriCli(packaging, build);
    if (!cargoTauri) throw new Error('CLI Tauri indisponible.');
    build.log.push('Compilation de l’hôte générique (une seule fois par machine)…');
    const result = await runCommand(cargoTauri, ['build', '--target', targetTriple, '--no-bundle'], hostSourceDir, build);
    if (!result.ok) throw new Error('La compilation de l’hôte a échoué.');
    const built = path.join(sharedTargetDir, targetTriple, 'release', 'appmaker-host.exe');
    if (!existsSync(built)) throw new Error('Binaire hôte introuvable après compilation.');
    await fs.mkdir(hostCacheDir, { recursive: true });
    await fs.copyFile(built, hostExePath);
  })();

  try {
    await hostBuildPromise;
  } finally {
    hostBuildPromise = null;
  }
  return existsSync(hostExePath) ? hostExePath : null;
}

function sanitizeFileName(value) {
  const cleaned = String(value || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'Application';
}

function nsiEscape(value) {
  return String(value ?? '')
    .replaceAll('$', '$$')
    .replaceAll('"', "'")
    .replaceAll('\r', ' ')
    .replaceAll('\n', ' ');
}

function numericVersion(version) {
  const parts = String(version || '0.1.0').split('.').map((part) => Number.parseInt(part, 10) || 0);
  while (parts.length < 4) parts.push(0);
  return parts.slice(0, 4).join('.');
}

async function directorySize(dir) {
  let total = 0;
  for (const file of await walkFiles(dir)) {
    total += (await fs.stat(file.full)).size;
  }
  return total;
}

/** Assemble le dossier de ressources et le binaire de l’application. */
async function stagePayload(appId, projectDir, packaging) {
  const packageRoot = path.join(packagesDir, appId);
  const payloadDir = path.join(packageRoot, 'payload');
  const resourcesDir = path.join(payloadDir, 'resources');
  await fs.rm(packageRoot, { recursive: true, force: true });
  await fs.mkdir(resourcesDir, { recursive: true });

  const exeName = `${sanitizeFileName(packaging.name)}.exe`;
  await fs.copyFile(hostExePath, path.join(payloadDir, exeName));

  await fs.cp(path.join(projectDir, 'src-tauri', 'web'), path.join(resourcesDir, 'web'), { recursive: true });

  const migrationsDir = path.join(resourcesDir, 'migrations');
  await fs.mkdir(migrationsDir, { recursive: true });
  const sourceMigrations = path.join(projectDir, 'src-tauri', 'migrations');
  for (const file of await fs.readdir(sourceMigrations)) {
    if (!file.endsWith('.sql')) continue;
    await fs.copyFile(path.join(sourceMigrations, file), path.join(migrationsDir, file));
  }

  const hostConfig = {
    name: packaging.name,
    databaseFile: packaging.databaseFile,
    version: packaging.version,
    identifier: packaging.identifier
  };
  await fs.writeFile(path.join(resourcesDir, 'host.json'), `${JSON.stringify(hostConfig, null, 2)}\n`, 'utf8');

  const iconSource = path.join(projectDir, 'src-tauri', 'icons', 'icon.png');
  if (existsSync(iconSource)) {
    await fs.copyFile(iconSource, path.join(resourcesDir, 'icon.png'));
  }

  return { packageRoot, payloadDir, resourcesDir, exeName };
}

/** Compile l’installateur NSIS et l’archive portable à partir du payload. */
async function packageArtifacts(projectDir, appId, packaging, staged, build) {
  const makensis = findMakensis();
  if (!makensis) throw new Error('Compilateur NSIS introuvable.');

  const outDir = path.join(staged.packageRoot, 'out');
  await fs.mkdir(outDir, { recursive: true });
  const baseName = `${sanitizeFileName(packaging.name)}_${packaging.version}_x64`;
  const installerPath = path.join(outDir, `${baseName}-setup.exe`);
  const iconPath = path.join(staged.resourcesDir, 'icon.png');

  // NSIS exige un fichier .ico : on réutilise l’icône générée pour l’application.
  const projectIco = path.join(projectDir, 'src-tauri', 'icons', 'icon.ico');
  const iconForInstaller = existsSync(projectIco) ? projectIco : iconPath;

  const payloadSize = await directorySize(staged.payloadDir);
  const template = await fs.readFile(path.join(hostSourceDir, 'installer.nsi.tpl'), 'utf8');
  const script = template
    .replaceAll('{{APP_NAME}}', nsiEscape(packaging.name))
    .replaceAll('{{APP_VERSION}}', nsiEscape(packaging.version))
    .replaceAll('{{APP_VERSION_4}}', numericVersion(packaging.version))
    .replaceAll('{{APP_PUBLISHER}}', nsiEscape(packaging.publisher))
    .replaceAll('{{APP_EXE}}', nsiEscape(staged.exeName))
    .replaceAll('{{APP_ID}}', nsiEscape(packaging.identifier))
    .replaceAll('{{APP_DESCRIPTION}}', nsiEscape(packaging.shortDescription))
    .replaceAll('{{PAYLOAD_DIR}}', staged.payloadDir)
    .replaceAll('{{ICON_PATH}}', iconForInstaller)
    .replaceAll('{{WEBVIEW2_BOOTSTRAPPER}}', existsSync(webview2Bootstrapper) ? webview2Bootstrapper : '')
    .replaceAll('{{OUTPUT_FILE}}', installerPath)
    .replaceAll('{{ESTIMATED_SIZE_KB}}', String(Math.max(1024, Math.round(payloadSize / 1024))));

  const scriptPath = path.join(staged.packageRoot, 'installer.nsi');
  await fs.writeFile(scriptPath, script, 'utf8');
  const result = await runCommand(makensis, ['/V2', scriptPath], staged.packageRoot, build);
  if (!result.ok || !existsSync(installerPath)) {
    throw new Error('La compilation de l’installateur NSIS a échoué.');
  }

  // Version portable : dossier décompressé, exécutable + ressources.
  const portableFiles = {};
  for (const file of await walkFiles(staged.payloadDir)) {
    portableFiles[file.relative] = await fs.readFile(file.full);
  }
  const portablePath = path.join(outDir, `${baseName}-portable.zip`);
  await fs.writeFile(portablePath, createZip(portableFiles));

  const [installerStat, portableStat] = await Promise.all([fs.stat(installerPath), fs.stat(portablePath)]);
  return {
    installer: { file: path.basename(installerPath), path: installerPath, size: installerStat.size, signed: false },
    portable: { file: path.basename(portablePath), path: portablePath, size: portableStat.size, signed: false }
  };
}

/** Chemin de l’artefact téléchargeable pour une application. */
export function getArtifact(appId, kind = 'installer') {
  const build = builders.get(appId);
  if (!build || build.status !== 'success') return null;
  if (kind === 'portable' || kind === 'exe') return build.artifacts.portable || null;
  return build.artifacts.installer || null;
}

/** Oublie un build réussi : la prochaine demande repart de zéro (après une extension). */
export function invalidateBuild(appId) {
  const build = builders.get(appId);
  if (build && build.status !== 'running' && build.status !== 'queued') builders.delete(appId);
}

/** Arrête les processus de build en cours (à l’arrêt du serveur). */
export function stopAllBuilds() {
  for (const child of children) {
    try { child.kill(); } catch { /* déjà terminé */ }
  }
  children.clear();
}

/** Liste des sources du build (src-tauri + web) pour l’archive téléchargeable. */
export async function getBuildBundle(projectDir) {
  const files = {};
  const candidates = [
    ['src-tauri/Cargo.toml', 'src-tauri/Cargo.toml'],
    ['src-tauri/build.rs', 'src-tauri/build.rs'],
    ['src-tauri/tauri.conf.json', 'src-tauri/tauri.conf.json'],
    ['src-tauri/src/main.rs', 'src-tauri/src/main.rs'],
    ['src-tauri/capabilities/default.json', 'src-tauri/capabilities/default.json'],
    ['src-tauri/migrations/0001_init.sql', 'src-tauri/migrations/0001_init.sql'],
    ['src-tauri/migrations/0002_seed.sql', 'src-tauri/migrations/0002_seed.sql']
  ];
  for (const [relative, archiveName] of candidates) {
    try {
      files[archiveName] = await fs.readFile(path.join(projectDir, relative));
    } catch {
      /* fichier facultatif */
    }
  }
  for (const relative of ['icons/32x32.png', 'icons/128x128.png', 'icons/icon.ico']) {
    try {
      files[`src-tauri/${relative}`] = await fs.readFile(path.join(projectDir, 'src-tauri', relative));
    } catch {
      /* icône facultative */
    }
  }
  const webRoot = path.join(projectDir, 'src-tauri', 'web');
  for (const file of await walkFiles(webRoot)) {
    files[`src-tauri/web/${file.relative}`] = await fs.readFile(file.full);
  }
  return files;
}

/**
 * Lance l’empaquetage Windows d’une application.
 * L’hôte générique est compilé au premier appel, puis réutilisé : les builds
 * suivants ne font que copier des ressources et lancer NSIS.
 */
export async function startBuild({ appId, projectDir, spec, force = false }) {
  const existing = builders.get(appId);
  if (existing && (existing.status === 'running' || existing.status === 'queued')) {
    return publicBuild(existing);
  }
  if (existing?.status === 'success' && !force) {
    return publicBuild(existing);
  }

  const packaging = buildPackaging(appId, spec);
  // NSIS résout les chemins depuis son propre dossier : tout doit être absolu.
  projectDir = path.resolve(projectDir);
  const build = {
    appId,
    status: 'running',
    startedAt: nowIso(),
    finishedAt: null,
    durationMs: null,
    stages: STAGES.map((stage, index) => ({
      ...stage,
      status: index === 0 ? 'active' : 'pending',
      startedAt: index === 0 ? nowIso() : null,
      finishedAt: null
    })),
    error: null,
    toolchainOk: null,
    artifacts: { bundleUrl: `/api/apps/${appId}/bundle`, installerUrl: null, portableUrl: null },
    log: []
  };
  builders.set(appId, build);

  const toolchain = await detectToolchain();
  build.toolchainOk = toolchain.supported;
  if (!toolchain.supported) {
    const missing = toolchain.checks.filter((check) => !check.ok).map((check) => `${check.label} (${check.detail})`).join(' ; ');
    finish(build, 'failed', `Outillage de build incomplet : ${missing}`);
    return publicBuild(build, { includeLog: true });
  }

  build.log.push(`Empaquetage Windows de ${packaging.name} (${projectDir})`);
  setStage(build, 'prepare', 'done');
  setStage(build, 'host', 'active');

  try {
    const host = await ensureHost(packaging, build);
    if (!host) throw new Error('Hôte précompilé indisponible.');
  } catch (error) {
    finish(build, 'failed', `${error.message} Consultez le journal du build.`);
    return publicBuild(build, { includeLog: true });
  }
  setStage(build, 'host', 'done');
  setStage(build, 'payload', 'active');

  let staged;
  try {
    staged = await stagePayload(appId, projectDir, packaging);
  } catch (error) {
    const locked = ['EPERM', 'EBUSY', 'EACCES'].includes(error.code);
    finish(build, 'failed', locked
      ? `Fermez l’application « ${packaging.name} » déjà ouverte puis relancez l’installation.`
      : `Assemblage des ressources échoué : ${error.message}`);
    return publicBuild(build, { includeLog: true });
  }
  setStage(build, 'payload', 'done');
  setStage(build, 'package', 'active');

  let artifacts;
  try {
    artifacts = await packageArtifacts(projectDir, appId, packaging, staged, build);
  } catch (error) {
    finish(build, 'failed', `${error.message} Consultez le journal pour le détail NSIS.`);
    return publicBuild(build, { includeLog: true });
  }

  build.artifacts = {
    ...build.artifacts,
    ...artifacts,
    installerUrl: `/api/apps/${appId}/download-exe`,
    portableUrl: `/api/apps/${appId}/download-exe?kind=portable`,
    builtAt: nowIso()
  };
  setStage(build, 'package', 'done');
  finish(build, 'success');
  return publicBuild(build, { includeLog: true });
}
