const ICONS = {
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  'arrow-up': '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  'arrow-up-right': '<path d="M7 17 17 7"/><path d="M7 7h10v10"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  'external-link': '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  monitor: '<rect width="20" height="14" x="2" y="4" rx="2"/><line x1="8" x2="16" y1="20" y2="20"/><line x1="12" x2="12" y1="18" y2="20"/>',
  tablet: '<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="12" x2="12" y1="18" y2="18.01"/>',
  smartphone: '<rect width="14" height="20" x="5" y="2" rx="2"/><line x1="12" x2="12" y1="18" y2="18.01"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  menu: '<line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  minimize: '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>',
  'monitor-down': '<path d="M12 13V7"/><path d="m15 10-3 3-3-3"/><rect width="20" height="14" x="2" y="3" rx="2"/><path d="M12 17v4"/><path d="M8 21h8"/>',
  layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>'
};

function icon(name, size = 16) {
  const body = ICONS[name] || ICONS.layers;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    if (el.dataset.hydrated === 'true') return;
    el.innerHTML = icon(el.dataset.icon, Number(el.dataset.size) || 16);
    el.dataset.hydrated = 'true';
  });
}

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeAccent(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : '#7C6CF7';
}

function initials(value) {
  const words = String(value || 'A').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return String(value || 'A').replace(/[^a-zA-Z0-9À-ÿ]/g, '').slice(0, 2).toUpperCase() || 'A';
}

function relativeDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const formatter = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' });
  if (abs < 60 * 1000) return 'à l’instant';
  if (abs < 3600 * 1000) return formatter.format(Math.round(diff / 60000), 'minute');
  if (abs < 86400 * 1000) return formatter.format(Math.round(diff / 3600000), 'hour');
  if (abs < 30 * 86400 * 1000) return formatter.format(Math.round(diff / 86400000), 'day');
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} o`;
  return `${(bytes / 1024).toFixed(1).replace('.', ',')} Ko`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const FIELD_TYPES = {
  text: 'texte',
  textarea: 'texte long',
  number: 'nombre',
  currency: '€',
  boolean: 'oui/non',
  date: 'date',
  select: 'choix',
  relation: 'relation'
};

const state = {
  view: 'composer',
  health: null,
  library: null,
  recent: [],
  current: null,
  spec: null,
  files: {},
  activeTab: 'plan',
  selectedFile: null,
  device: 'desktop',
  previewFocus: false,
  busy: false,
  lastPrompt: '',
  lastWasDemo: false
};

const els = {
  main: $('#studio-main'),
  siteHeader: $('#site-header'),
  brandLink: $('#brand-link'),
  navStudio: $('#nav-studio'),
  navLibrary: $('#nav-library'),
  navApps: $('#nav-apps'),
  newAppBtn: $('#new-app-btn'),
  libraryList: $('#library-list'),
  libraryCount: $('#library-count'),
  recentApps: $('#recent-apps'),
  recentCount: $('#recent-count'),
  apiStatus: $('#api-status'),
  apiStatusText: $('#api-status-text'),
  modelPill: $('#model-pill'),
  composerView: $('#composer-view'),
  generatingView: $('#generating-view'),
  errorView: $('#error-view'),
  resultView: $('#result-view'),
  promptInput: $('#prompt-input'),
  generateBtn: $('#generate-btn'),
  genPrompt: $('#gen-prompt'),
  genElapsed: $('#gen-elapsed'),
  genModel: $('#gen-model'),
  genSteps: $('#gen-steps'),
  errorMessage: $('#error-message'),
  retryBtn: $('#retry-btn'),
  demoBtn: $('#demo-btn'),
  errorBack: $('#error-back'),
  backBtn: $('#back-btn'),
  resultName: $('#result-name'),
  resultMeta: $('#result-meta'),
  resultPrompt: $('#result-prompt'),
  openApp: $('#open-app'),
  downloadBtn: $('#download-btn'),
  installBtn: $('#install-btn'),
  installLabel: $('#install-label'),
  buildStrip: $('#build-strip'),
  buildText: $('#build-text'),
  buildSteps: $('#build-steps'),
  buildLogToggle: $('#build-log-toggle'),
  buildLog: $('#build-log'),
  buildArtifact: $('#build-artifact'),
  buildExe: $('#build-exe'),
  buildBundle: $('#build-bundle'),
  inspectorContent: $('#inspector-content'),
  inspectorHint: $('#inspector-hint'),
  refineForm: $('#refine-form'),
  refineInput: $('#refine-input'),
  refineBtn: $('#refine-btn'),
  agentLog: $('#agent-log'),
  resultLoading: $('#result-loading'),
  previewFrame: $('#preview-frame'),
  previewStage: $('#preview-stage'),
  previewUrl: $('.preview-url-text'),
  focusPreview: $('#focus-preview'),
  reloadPreview: $('#reload-preview'),
  toastRoot: $('#toast-root')
};

let stageTimers = [];
let elapsedTimer = null;
let generationStart = 0;

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const isJson = (response.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await response.json().catch(() => ({})) : null;
  if (!response.ok) {
    throw new Error(data?.error?.message || `Erreur ${response.status}.`);
  }
  return data;
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast${type === 'error' ? ' is-error' : ''}`;
  toast.innerHTML = `${icon(type === 'error' ? 'alert' : 'check', 13)}<span>${escapeHtml(message)}</span>`;
  els.toastRoot.appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add('is-leaving');
    window.setTimeout(() => toast.remove(), 220);
  }, 3400);
}

function setView(name) {
  state.view = name;
  els.composerView.classList.toggle('hidden', name !== 'composer');
  els.generatingView.classList.toggle('hidden', name !== 'generating');
  els.errorView.classList.toggle('hidden', name !== 'error');
  els.resultView.classList.toggle('hidden', name !== 'result');
  els.main.classList.toggle('has-result', name === 'result');
  document.body.classList.toggle('is-result', name === 'result');
  els.navStudio.classList.toggle('is-active', name === 'composer');
  if (name !== 'result' && state.previewFocus) togglePreviewFocus(false);
  if (name !== 'result') document.title = 'AppMaker · Studio d’applications';
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function pushRoute(hash) {
  if (location.hash === hash) return;
  history.pushState(null, '', hash);
}

function showComposer({ updateUrl = true, focus = true } = {}) {
  setView('composer');
  if (updateUrl) pushRoute('#/');
  if (focus) window.setTimeout(() => els.promptInput.focus({ preventScroll: true }), 90);
}

function scrollToSection(id) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function goToSection(id) {
  if (state.busy) return;
  if (state.view !== 'composer') {
    state.current = null;
    state.spec = null;
    state.files = {};
    renderRecent();
    showComposer({ focus: false });
    window.setTimeout(() => scrollToSection(id), 160);
    return;
  }
  scrollToSection(id);
}

function goStudio(event) {
  event?.preventDefault();
  if (state.busy) return;
  if (state.view !== 'composer') {
    state.current = null;
    state.spec = null;
    state.files = {};
    renderRecent();
    showComposer();
    return;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  els.promptInput.focus({ preventScroll: true });
}

function setGenerateDisabled(disabled) {
  els.generateBtn.disabled = disabled;
}

function updateHealth(health) {
  state.health = health;
  if (!health) {
    els.apiStatus.className = 'api-status is-error';
    els.apiStatusText.textContent = 'Hors ligne';
    els.apiStatus.title = 'Serveur local indisponible — relancez npm start';
    els.modelPill.innerHTML = '<span class="model-dot"></span> Hors ligne';
    return;
  }
  if (health.ai) {
    els.apiStatus.className = 'api-status is-ok';
    els.apiStatusText.textContent = 'DeepSeek';
    els.apiStatus.title = `${health.model} connecté · ${health.blocks} blocs disponibles`;
    els.modelPill.title = health.model;
    els.modelPill.innerHTML = '<span class="model-dot"></span> DeepSeek';
  } else {
    els.apiStatus.className = 'api-status';
    els.apiStatusText.textContent = 'Mode démo';
    els.apiStatus.title = 'Clé API manquante — génération de démonstration disponible';
    els.modelPill.title = 'Ajoutez DEEPSEEK_API_KEY dans .env';
    els.modelPill.innerHTML = '<span class="model-dot"></span> Démo locale';
  }
}

function miniTopbar(title) {
  return `<div class="mini-topbar"><span class="mini-dots"><i></i><i></i><i></i></span><span class="mini-title">${escapeHtml(title)}</span></div>`;
}

function libraryVisualMarkup(id) {
  if (id === 'crud') {
    const rows = Array.from({ length: 5 }, () => '<div class="mini-table-row"><span class="mini-avatar"></span><span class="mini-line"></span><span class="mini-tag"></span></div>').join('');
    return `<div class="mini-window">${miniTopbar('Produits')}<div class="mini-body mini-body-table"><div class="mini-search"></div>${rows}</div></div>`;
  }
  if (id === 'web') {
    return `<div class="mini-window mini-window-code">${miniTopbar('app.js')}<div class="mini-code-lines"><span></span><span></span><span></span><span></span><span></span><span></span></div></div>`;
  }
  return `<div class="mini-window">${miniTopbar('Tableau de bord')}<div class="mini-body">
    <div class="mini-kpis">
      <div class="mini-kpi"><span></span><b>128</b></div>
      <div class="mini-kpi"><span></span><b>24,8 k</b></div>
    </div>
    <div class="mini-chart"><i style="height:32%"></i><i style="height:56%"></i><i style="height:44%"></i><i style="height:78%"></i><i style="height:62%"></i></div>
  </div></div>`;
}

function updateLibrary(library) {
  state.library = library;
  const blocks = library?.blocks || [];
  const scaffold = library?.scaffolds?.[0] || null;
  if (!blocks.length && !scaffold) {
    els.libraryList.innerHTML = '<div class="side-empty">Bibliothèque indisponible.</div>';
    return;
  }
  const order = { dashboard: 0, crud: 1 };
  const sortedBlocks = [...blocks].sort((a, b) => (order[a.id] ?? 10) - (order[b.id] ?? 10));
  const items = [
    ...sortedBlocks.map((block) => ({ ...block, kind: 'block' })),
    ...(scaffold ? [{ ...scaffold, icon: 'database', kind: 'scaffold' }] : [])
  ];
  els.libraryCount.textContent = `${blocks.length} blocs + socle`;
  els.libraryList.innerHTML = items.map((item) => {
    const visual = item.kind === 'scaffold'
      ? 'web'
      : (item.id === 'dashboard' || item.id === 'crud' ? item.id : 'dashboard');
    const description = item.description || '';
    return `<article class="lib-card">
      <div class="lib-visual lib-visual-${visual}">${libraryVisualMarkup(visual)}</div>
      <div class="lib-body">
        <div class="lib-title-row">
          <span class="lib-icon">${icon(item.icon || 'layers', 14)}</span>
          <h3>${escapeHtml(item.name)}</h3>
        </div>
        <p>${escapeHtml(description)}</p>
        <span class="status-chip">${icon('check', 10)} ${item.kind === 'scaffold' ? 'Socle prêt' : 'Bloc prêt'}</span>
      </div>
    </article>`;
  }).join('');
}

function recentCardMarkup(app) {
  const accent = safeAccent(app.accent);
  const meta = `${app.entityCount ?? '—'} entités · ${relativeDate(app.createdAt)}`;
  return `<button class="recent-card" type="button" data-app-id="${escapeHtml(app.id)}" aria-label="Ouvrir ${escapeHtml(app.name)}" style="--card-accent:${accent}">
    <span class="recent-visual">
      <span class="recent-window">
        <span class="recent-top"><i></i><i></i><i></i><span class="recent-top-title">${escapeHtml(initials(app.name))}</span></span>
        <span class="recent-layout">
          <span class="recent-side"><i class="recent-side-mark"></i><i></i><i></i><i></i></span>
          <span class="recent-main">
            <span class="recent-head-line"></span>
            <span class="recent-kpis"><i></i><i></i></span>
            <span class="recent-bars"><i style="width:64%"></i><i style="width:44%"></i></span>
          </span>
        </span>
      </span>
    </span>
    <span class="recent-body">
      <span class="recent-title-row"><strong>${escapeHtml(app.name)}</strong><span class="recent-arrow">${icon('arrow-up-right', 12)}</span></span>
      <span class="recent-meta">${escapeHtml(meta)}</span>
    </span>
  </button>`;
}

function renderRecent() {
  const newCard = `<button class="recent-card recent-card-new" type="button" data-new-app>
    <span class="recent-new-plus">${icon('plus', 17)}</span>
    <span class="recent-new-title">Créer une application</span>
    <span class="recent-new-sub">Décrivez un besoin, l’IA s’occupe du reste.</span>
  </button>`;
  els.recentCount.textContent = state.recent.length ? String(state.recent.length) : '';
  if (!state.recent.length) {
    els.recentApps.innerHTML = `<div class="recent-empty">
      <span class="recent-empty-icon">${icon('layers', 20)}</span>
      <h3>Votre première application vous attend.</h3>
      <p>Lancez une génération : elle apparaîtra ici avec son aperçu et son code.</p>
    </div>${newCard}`;
    return;
  }
  const cards = state.recent.slice(0, 6).map(recentCardMarkup).join('');
  els.recentApps.innerHTML = cards + newCard;
}

async function refreshRecent() {
  try {
    const data = await api('/api/apps');
    state.recent = data.apps || [];
    renderRecent();
  } catch {
    /* l’historique est secondaire */
  }
}

async function loadBootData() {
  const [health, library, apps] = await Promise.allSettled([
    api('/api/health'),
    api('/api/library'),
    api('/api/apps')
  ]);
  updateHealth(health.status === 'fulfilled' ? health.value : null);
  if (library.status === 'fulfilled') updateLibrary(library.value);
  else els.libraryList.innerHTML = '<div class="side-empty">Bibliothèque indisponible.</div>';
  if (apps.status === 'fulfilled') {
    state.recent = apps.value.apps || [];
    renderRecent();
  }
}

function setStage(stageNumber, status) {
  const step = els.genSteps.querySelector(`[data-stage="${stageNumber}"]`);
  if (!step) return;
  step.dataset.status = status;
  const marker = step.querySelector('.gen-marker');
  if (status === 'done') marker.innerHTML = icon('check', 12);
  else marker.innerHTML = '';
  step.querySelector('.gen-state').textContent = status === 'done' ? 'Terminé' : status === 'active' ? 'En cours' : 'En attente';
}

function clearGenerationTimers() {
  stageTimers.forEach((timer) => clearTimeout(timer));
  stageTimers = [];
  if (elapsedTimer) clearInterval(elapsedTimer);
  elapsedTimer = null;
}

function startGenerationView(prompt) {
  clearGenerationTimers();
  els.genPrompt.textContent = `« ${prompt} »`;
  els.genElapsed.textContent = '0 s';
  els.genModel.textContent = `${state.health?.model || 'DeepSeek'} · planification + assemblage local`;
  [1, 2, 3, 4].forEach((stage) => setStage(stage, 'pending'));
  setStage(1, 'active');
  generationStart = Date.now();
  elapsedTimer = window.setInterval(() => {
    const seconds = Math.floor((Date.now() - generationStart) / 1000);
    els.genElapsed.textContent = `${seconds} s`;
  }, 1000);
  stageTimers.push(window.setTimeout(() => {
    setStage(1, 'done');
    setStage(2, 'active');
  }, 1700));
  stageTimers.push(window.setTimeout(() => {
    setStage(2, 'done');
    setStage(3, 'active');
  }, 5600));
  setView('generating');
}

async function finishStages() {
  const seconds = Math.max(1, Math.round((Date.now() - generationStart) / 1000));
  clearGenerationTimers();
  els.genElapsed.textContent = `${seconds} s`;
  setStage(1, 'done');
  setStage(2, 'done');
  setStage(3, 'done');
  setStage(4, 'active');
  await sleep(420);
  setStage(4, 'done');
  await sleep(180);
}

async function generate(prompt, { demo = false } = {}) {
  if (state.busy) return;
  const clean = String(prompt || '').trim();
  if (!clean) {
    els.promptInput.focus();
    showToast('Décrivez d’abord l’application souhaitée.', 'error');
    return;
  }
  state.busy = true;
  state.lastPrompt = clean;
  state.lastWasDemo = demo;
  setGenerateDisabled(true);
  startGenerationView(clean);
  try {
    const data = await api(demo ? '/api/demo' : '/api/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: clean })
    });
    await finishStages();
    showResult(data, { updateUrl: true });
    showToast(demo ? 'Démo StockFlow générée' : 'Application générée');
    refreshRecent();
  } catch (error) {
    clearGenerationTimers();
    showError(error.message);
    showToast(error.message, 'error');
  } finally {
    state.busy = false;
    setGenerateDisabled(false);
  }
}

function showError(message) {
  els.errorMessage.textContent = message;
  setView('error');
}

function pickDefaultFile() {
  if (state.files['assets/app.js']) return 'assets/app.js';
  return Object.keys(state.files).sort()[0] || null;
}

function showResult(data, { updateUrl = true } = {}) {
  const previousId = state.current?.id;
  const isIteration = data.app.parentId && data.app.parentId === previousId;
  state.current = data.app;
  state.spec = data.spec;
  state.files = data.files || {};
  if (!isIteration) state.activeTab = 'plan';
  if (!state.selectedFile || !state.files[state.selectedFile]) {
    state.selectedFile = pickDefaultFile();
  }

  const spec = state.spec;
  const blockCount = (data.app.blocks || []).length;
  const timings = data.generation?.timings;
  const timeLabel = timings ? `${(timings.total / 1000).toFixed(1).replace('.', ',')} s` : null;

  els.resultName.textContent = data.app.name;
  els.resultMeta.textContent = `${spec.entities.length} entités · ${spec.screens.length} écrans`;
  els.resultPrompt.textContent = `« ${data.app.prompt} »`;
  els.resultPrompt.title = data.app.prompt;
  els.openApp.href = data.app.previewUrl;
  els.downloadBtn.href = data.app.downloadUrl;
  els.downloadBtn.title = 'Télécharger le projet complet (code source, pour les développeurs)';
  els.inspectorHint.textContent = `${blockCount} blocs${timeLabel ? ` · ${timeLabel}` : ''}`;
  els.refineInput.value = '';
  els.refineBtn.disabled = false;
  els.resultLoading.classList.add('hidden');

  setView('result');
  renderInspector();
  renderRecent();
  applyDevice(state.device);
  syncBuildUi(data.app);
  els.previewFrame.src = data.app.previewUrl;
  els.previewUrl.textContent = `appmaker.local${data.app.previewUrl}`;
  document.title = `${data.app.name} · AppMaker`;
  if (updateUrl) pushRoute(`#/app/${data.app.id}`);
}

async function openApp(id, { updateUrl = true } = {}) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) return;
  if (state.busy) return;
  if (state.current?.id === id && state.view === 'result') return;
  state.busy = true;
  try {
    const data = await api(`/api/apps/${encodeURIComponent(id)}`);
    showResult(data, { updateUrl });
  } catch (error) {
    showToast(error.message, 'error');
    if (location.hash.startsWith('#/app/')) {
      showComposer({ updateUrl: false });
      history.replaceState(null, '', '#/');
    }
  } finally {
    state.busy = false;
  }
}

function renderInspector() {
  if (!state.current || !state.spec) return;
  $$('.tab-btn').forEach((btn) => {
    const active = btn.dataset.tab === state.activeTab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  els.inspectorContent.innerHTML = state.activeTab === 'files' ? filesMarkup() : planMarkup();
  els.inspectorContent.classList.toggle('is-files', state.activeTab === 'files');
  hydrateIcons(els.inspectorContent);
  els.inspectorContent.scrollTop = 0;
}

function planMarkup() {
  const app = state.current;
  const spec = state.spec;
  const accent = safeAccent(app.accent);
  const fieldCount = spec.entities.reduce((sum, entity) => sum + entity.fields.length, 0);
  const seedCount = spec.entities.reduce((sum, entity) => sum + ((spec.seed?.[entity.key] || []).length), 0);

  const entityCards = spec.entities.map((entity) => {
    const fieldChips = entity.fields.map((field) => {
      const target = field.type === 'relation'
        ? spec.entities.find((candidate) => candidate.key === field.target)
        : null;
      return `<span class="field-chip" title="${escapeHtml(field.label)}">
        ${field.required ? '<span class="req">*</span>' : ''}
        ${escapeHtml(field.label)}
        <em>${escapeHtml(FIELD_TYPES[field.type] || field.type)}</em>
        ${target ? `<span class="rel">→ ${escapeHtml(target.namePlural)}</span>` : ''}
      </span>`;
    }).join('');
    return `<div class="entity-card">
      <div class="entity-head">
        <span class="entity-ico">${icon(entity.icon, 12)}</span>
        <div>
          <div class="entity-name">${escapeHtml(entity.namePlural)}</div>
          <div class="entity-meta">${entity.fields.length} champs · ${(spec.seed?.[entity.key] || []).length} exemples</div>
        </div>
      </div>
      <div class="field-chips">${fieldChips}</div>
    </div>`;
  }).join('');

  const screenRows = spec.screens.map((screen) => `
    <div class="screen-row">
      ${icon(screen.icon, 13)}
      <span>${escapeHtml(screen.title)}</span>
      <span class="screen-type">${screen.type === 'dashboard' ? 'Dashboard' : 'CRUD'}</span>
    </div>`).join('');

  const blockPills = (app.blocks || []).map((block) => `<span class="block-pill">${escapeHtml(block.name)}</span>`).join('');

  return `<div class="plan-overview">
    <div class="plan-app-row">
      <span class="plan-mark" style="background:color-mix(in srgb, ${accent} 14%, #ffffff); color:${accent}; border:1px solid color-mix(in srgb, ${accent} 24%, #ffffff)">${escapeHtml(initials(app.name))}</span>
      <span class="plan-app-copy">
        <h2>${escapeHtml(app.name)}</h2>
        <p>${escapeHtml(app.tagline)}</p>
      </span>
    </div>
    <div class="plan-stats">
      <div class="plan-stat"><strong>${spec.entities.length}</strong><span>entités</span></div>
      <div class="plan-stat"><strong>${fieldCount}</strong><span>champs</span></div>
      <div class="plan-stat"><strong>${seedCount}</strong><span>exemples</span></div>
    </div>
  </div>
  <div class="plan-section">
    <div class="plan-section-head"><h3>Modèle de données</h3><span>${spec.entities.length} tables</span></div>
    ${entityCards}
  </div>
  <div class="plan-section">
    <div class="plan-section-head"><h3>Écrans</h3><span>${spec.screens.length} écrans</span></div>
    ${screenRows}
  </div>
  <div class="plan-section">
    <div class="plan-section-head"><h3>Blocs assemblés</h3><span>bibliothèque</span></div>
    <div class="block-pills">${blockPills || '<span class="block-pill">Aucun bloc</span>'}</div>
  </div>
  <p class="plan-footnote">Stockage local navigateur · ${escapeHtml(app.storageKey || '')}</p>`;
}

function filesMarkup() {
  const files = Object.keys(state.files).sort();
  if (!files.length) return '<div class="side-empty">Aucun fichier.</div>';
  if (!state.selectedFile || !state.files[state.selectedFile]) state.selectedFile = pickDefaultFile();

  const groups = new Map();
  for (const file of files) {
    const index = file.lastIndexOf('/');
    const dir = index === -1 ? '' : file.slice(0, index);
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir).push(file);
  }
  const dirs = [...groups.keys()].sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)));

  const groupsHtml = dirs.map((dir) => {
    const rows = groups.get(dir).map((file) => {
      const name = dir ? file.slice(dir.length + 1) : file;
      const content = state.files[file] || '';
      const active = file === state.selectedFile;
      return `<button class="file-row${active ? ' is-active' : ''}" type="button" data-file="${escapeHtml(file)}">
        ${icon('file', 12)}
        <span>${escapeHtml(name)}</span>
        <span class="file-size">${formatBytes(content.length)}</span>
      </button>`;
    }).join('');
    return `<div class="file-group">
      <div class="file-group-title">${dir ? `${escapeHtml(dir)}/` : 'Racine'}</div>
      ${rows}
    </div>`;
  }).join('');

  const selected = state.selectedFile;
  const content = state.files[selected] || '';
  const lines = content.length
    ? content.split('\n').map((line) => `<span class="code-line">${escapeHtml(line) || ' '}</span>`).join('')
    : '<span class="code-empty">Fichier vide</span>';

  return `<div class="files-panel">
    <div class="file-groups">${groupsHtml}</div>
    <div class="code-panel">
      <div class="code-head">
        <span class="code-path">${escapeHtml(selected)}</span>
        <button class="copy-btn" type="button" data-copy-file="${escapeHtml(selected)}">
          ${icon('copy', 10)}<span>Copier</span>
        </button>
      </div>
      <div class="code-scroll"><pre class="code-lines">${lines}</pre></div>
    </div>
  </div>`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

async function runAgentInstruction(instruction) {
  if (!state.current || state.busy) return;
  const text = String(instruction || '').trim();
  if (!text) {
    els.refineInput.focus();
    showToast('Décrivez la modification souhaitée.', 'error');
    return;
  }
  state.busy = true;
  els.refineBtn.disabled = true;
  els.resultLoading.classList.remove('hidden');
  els.agentLog.classList.remove('hidden', 'is-error');
  els.agentLog.textContent = 'L’agent inspecte le projet et prépare la modification…';
  try {
    const data = await api(`/api/apps/${encodeURIComponent(state.current.id)}/agent`, {
      method: 'POST',
      body: JSON.stringify({ instruction: text })
    });
    const changed = data.run?.changedFiles || [];
    els.agentLog.textContent = [
      data.run?.summary || 'Modification appliquée.',
      changed.length ? `Fichiers : ${changed.join(', ')}` : null
    ].filter(Boolean).join('\n');
    showResult(data, { updateUrl: true });
    els.agentLog.classList.remove('hidden');
    showToast('Extension ajoutée et vérifiée');
    refreshRecent();
  } catch (error) {
    els.agentLog.classList.remove('hidden');
    els.agentLog.classList.add('is-error');
    els.agentLog.textContent = error.message;
    showToast(error.message, 'error');
  } finally {
    state.busy = false;
    els.refineBtn.disabled = false;
    els.resultLoading.classList.add('hidden');
  }
}

function applyDevice(device) {
  state.device = device;
  els.previewStage.classList.toggle('is-tablet', device === 'tablet');
  els.previewStage.classList.toggle('is-mobile', device === 'mobile');
  $$('.device-btn').forEach((btn) => {
    const active = btn.dataset.device === device;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

function togglePreviewFocus(force) {
  state.previewFocus = typeof force === 'boolean' ? force : !state.previewFocus;
  document.body.classList.toggle('preview-focus', state.previewFocus);
  els.focusPreview.classList.toggle('is-active', state.previewFocus);
  els.focusPreview.setAttribute('aria-pressed', String(state.previewFocus));
  els.focusPreview.title = state.previewFocus ? 'Réduire l’aperçu' : 'Agrandir l’aperçu';
  els.focusPreview.setAttribute('aria-label', els.focusPreview.title);
  els.focusPreview.innerHTML = icon(state.previewFocus ? 'minimize' : 'maximize', 13);
}

/* ══════════ Build Windows ══════════ */

let buildPoller = null;
let buildLogVisible = false;

function stopBuildPolling() {
  if (buildPoller) window.clearInterval(buildPoller);
  buildPoller = null;
}

function setInstallState(status) {
  const labels = {
    idle: 'Installer sur Windows',
    running: 'Compilation en cours…',
    success: 'Télécharger l’installateur',
    failed: 'Réessayer la compilation'
  };
  els.installLabel.textContent = labels[status] || labels.idle;
  els.installBtn.disabled = status === 'running';
  els.installBtn.classList.toggle('is-running', status === 'running');
}

function renderBuild(build) {
  const status = build?.status || 'idle';
  setInstallState(status);
  els.buildStrip.classList.remove('hidden');
  els.buildStrip.dataset.status = status;
  els.buildArtifact.classList.add('is-hidden');
  els.buildExe.classList.add('is-hidden');
  els.buildBundle.classList.add('is-hidden');
  els.buildBundle.href = `/api/apps/${encodeURIComponent(state.current.id)}/bundle`;
  els.buildBundle.classList.remove('is-hidden');

  if (!build) {
    els.buildText.textContent = 'Application prête. Consultez l’aperçu ou installez-la sur Windows.';
    els.buildSteps.innerHTML = '';
    els.buildLog.classList.add('hidden');
    return;
  }

  const stageLabel = build.stages?.find((stage) => stage.status === 'active')?.label;
  const texts = {
    running: stageLabel ? `${stageLabel}…` : 'Compilation en cours…',
    success: `Installateur prêt${build.durationMs ? ` en ${Math.round(build.durationMs / 1000)} s` : ''}. Double-cliquez pour installer l’application sur ce PC.`,
    failed: build.error || 'La compilation a échoué.'
  };
  els.buildText.textContent = texts[status] || '';

  els.buildSteps.innerHTML = (build.stages || []).map((stage) => `
    <span class="build-step" data-status="${escapeHtml(stage.status)}">
      <i></i>${escapeHtml(stage.label)}
    </span>`).join('');

  if (build.artifacts?.installerUrl) {
    els.buildArtifact.href = build.artifacts.installerUrl;
    els.buildArtifact.classList.remove('is-hidden');
  }
  if (build.artifacts?.portableUrl || build.artifacts?.executableUrl) {
    els.buildExe.href = build.artifacts.portableUrl || build.artifacts.executableUrl;
    els.buildExe.classList.remove('is-hidden');
  }

  els.buildLog.textContent = (build.log || []).slice(-90).join('\n');
  els.buildLog.classList.toggle('hidden', !buildLogVisible);
  els.buildLogToggle.textContent = buildLogVisible ? 'Masquer le journal' : 'Journal';
}

async function pollBuild(id) {
  try {
    const data = await api(`/api/apps/${encodeURIComponent(id)}/build`);
    renderBuild(data.build);
    if (data.build.status !== 'running' && data.build.status !== 'queued') {
      stopBuildPolling();
      if (data.build.status === 'success') showToast('Installateur Windows prêt');
      if (data.build.status === 'failed') showToast('La compilation a échoué — consultez le journal', 'error');
    }
  } catch {
    stopBuildPolling();
  }
}

function startPolling(id) {
  stopBuildPolling();
  buildPoller = window.setInterval(() => pollBuild(id), 2500);
}

async function installOnWindows() {
  if (!state.current) return;
  const id = state.current.id;
  const build = state.current.build;
  if (build?.status === 'success' && build.artifacts?.installerUrl) {
    window.location.href = build.artifacts.installerUrl;
    return;
  }
  setInstallState('running');
  renderBuild({ status: 'running', stages: [] });
  els.buildText.textContent = 'Démarrage de la compilation…';
  try {
    const data = await api(`/api/apps/${encodeURIComponent(id)}/build`, { method: 'POST', body: JSON.stringify({}) });
    renderBuild(data.build);
    if (data.build.status === 'running') {
      startPolling(id);
    } else if (data.build.status === 'failed') {
      buildLogVisible = true;
      renderBuild(data.build);
      showToast(data.build.error || 'La compilation a échoué', 'error');
    }
    refreshRecent();
  } catch (error) {
    setInstallState('failed');
    els.buildText.textContent = error.message;
    showToast(error.message, 'error');
  }
}

function syncBuildUi(app) {
  stopBuildPolling();
  buildLogVisible = false;
  const build = app.build;
  els.buildLogToggle.textContent = 'Journal';
  if (!build) {
    els.buildStrip.classList.add('hidden');
    setInstallState('idle');
    return;
  }
  renderBuild(build);
  if (build.status === 'running') {
    startPolling(app.id);
  }
}

function reloadPreview() {
  if (!state.current) return;
  const separator = state.current.previewUrl.includes('?') ? '&' : '?';
  els.previewFrame.src = `${state.current.previewUrl}${separator}t=${Date.now()}`;
}

function handleNewApp() {
  if (state.busy) {
    showToast('Une génération est déjà en cours.', 'error');
    return;
  }
  state.current = null;
  state.spec = null;
  state.files = {};
  state.activeTab = 'plan';
  state.selectedFile = null;
  els.promptInput.value = '';
  renderRecent();
  showComposer();
}

function backToComposer() {
  if (state.busy) return;
  const prompt = state.current?.prompt || state.lastPrompt;
  if (prompt) els.promptInput.value = prompt;
  state.current = null;
  state.spec = null;
  state.files = {};
  renderRecent();
  showComposer();
}

function routeFromHash() {
  const match = (location.hash || '').match(/^#\/app\/([a-z0-9][a-z0-9-]*)$/);
  return match ? match[1] : null;
}

function initialRoute() {
  const id = routeFromHash();
  if (id) {
    openApp(id, { updateUrl: false });
  } else {
    showComposer({ updateUrl: false });
  }
}

/* ══════════ Événements ══════════ */

function bindEvents() {
  els.newAppBtn.addEventListener('click', handleNewApp);
  els.generateBtn.addEventListener('click', () => generate(els.promptInput.value));
  els.promptInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      generate(els.promptInput.value);
    }
  });
  $$('.example-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      els.promptInput.value = chip.dataset.example || '';
      els.promptInput.focus();
    });
  });

  els.brandLink.addEventListener('click', goStudio);
  els.navStudio.addEventListener('click', goStudio);
  els.navLibrary.addEventListener('click', () => goToSection('library-section'));
  els.navApps.addEventListener('click', () => goToSection('applications-section'));
  const onScroll = () => els.siteHeader.classList.toggle('is-scrolled', window.scrollY > 6);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.previewFocus) togglePreviewFocus(false);
  });

  els.backBtn.addEventListener('click', backToComposer);
  els.retryBtn.addEventListener('click', () => generate(state.lastPrompt, { demo: state.lastWasDemo }));
  els.demoBtn.addEventListener('click', () => generate(state.lastPrompt || els.promptInput.value, { demo: true }));
  els.errorBack.addEventListener('click', () => {
    if (state.lastPrompt) els.promptInput.value = state.lastPrompt;
    showComposer();
  });

  $$('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeTab = btn.dataset.tab;
      renderInspector();
    });
  });

  els.inspectorContent.addEventListener('click', async (event) => {
    const fileButton = event.target.closest('[data-file]');
    if (fileButton) {
      state.selectedFile = fileButton.dataset.file;
      renderInspector();
      return;
    }
    const copyButton = event.target.closest('[data-copy-file]');
    if (copyButton) {
      const file = copyButton.dataset.copyFile;
      const copied = await copyText(state.files[file] || '');
      showToast(copied ? 'Code copié dans le presse-papiers' : 'Copie impossible sur ce navigateur', copied ? 'success' : 'error');
    }
  });

  els.recentApps.addEventListener('click', (event) => {
    const newAppButton = event.target.closest('[data-new-app]');
    if (newAppButton) {
      handleNewApp();
      return;
    }
    const button = event.target.closest('[data-app-id]');
    if (!button) return;
    openApp(button.dataset.appId);
  });

  $$('.device-btn').forEach((btn) => {
    btn.addEventListener('click', () => applyDevice(btn.dataset.device));
  });
  els.focusPreview.addEventListener('click', () => togglePreviewFocus());
  els.reloadPreview.addEventListener('click', reloadPreview);
  els.installBtn.addEventListener('click', installOnWindows);
  els.buildLogToggle.addEventListener('click', () => {
    buildLogVisible = !buildLogVisible;
    els.buildLog.classList.toggle('hidden', !buildLogVisible);
    els.buildLogToggle.textContent = buildLogVisible ? 'Masquer le journal' : 'Journal';
    els.buildLog.scrollTop = els.buildLog.scrollHeight;
  });

  els.refineForm.addEventListener('submit', (event) => {
    event.preventDefault();
    runAgentInstruction(els.refineInput.value);
  });
  els.refineInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      els.refineForm.requestSubmit();
    }
  });

  window.addEventListener('popstate', () => {
    const id = routeFromHash();
    if (id) openApp(id, { updateUrl: false });
    else {
      state.current = null;
      state.spec = null;
      state.files = {};
      renderRecent();
      showComposer({ updateUrl: false });
    }
  });
}

async function boot() {
  hydrateIcons();
  bindEvents();
  initialRoute();
  await loadBootData();
}

boot().catch((error) => {
  console.error(error);
  document.body.insertAdjacentHTML('beforeend', `<div class="toast-stack"><div class="toast is-error">${icon('alert', 13)}<span>${escapeHtml(error.message)}</span></div></div>`);
});
