import { createStore, HAS_TAURI } from './db.js';
import {
  icon, escapeHtml, initials, formatNumber, formatMoney, formatPercent,
  formatDate, formatRelative, toast, openModal, confirmDialog
} from './ui.js';
import { createRegistry, downloadText, toCsv } from './extensions.js';
import { extensionModules } from './extensions.generated.js';

const APP = {{APP_CONFIG}};

// En mode desktop, les libellés de stockage reflètent la base SQLite locale.
APP.desktop = HAS_TAURI;
// Points d’accroche : les extensions ajoutent des actions et des widgets sans
// modifier le socle ni les blocs générés.
APP.extensions = createRegistry(extensionModules);
const storageLabel = HAS_TAURI ? 'Base SQLite locale' : 'Stockage local actif';

const store = createStore(APP);
const state = { navOpen: false, search: {}, filters: {}, sort: {}, counts: {}, total: 0 };
let renderToken = 0;

const ENTITY_MAP = Object.fromEntries(APP.entities.map((entity) => [entity.key, entity]));
const SCREEN_MAP = Object.fromEntries(APP.screens.map((screen) => [screen.key, screen]));

// Écrans fournis par les extensions : ils s’ajoutent à la navigation et au
// routeur sans modifier le plan de l’application.
const EXTENSION_SCREENS = APP.extensions ? APP.extensions.screens() : [];
const EXTENSION_SCREEN_MAP = Object.fromEntries(EXTENSION_SCREENS.map((screen) => [screen.id, screen]));
const view = document.getElementById('app');

/* ---------- Cache de données ----------
 * Les écrans sont rendus de façon synchrone à partir d’un cache chargé
 * depuis la couche de persistance. Cela garde les blocs lisibles et identiques
 * entre le navigateur et l’application de bureau.
 */

const cache = new Map();

/** SQLite renvoie 1/0 pour les booléens : les blocs travaillent avec de vrais booléens. */
function normalizeRow(entity, row) {
  const copy = { ...row };
  for (const field of entity.fields) {
    if (field.type === 'boolean' && copy[field.key] !== null && copy[field.key] !== undefined) {
      copy[field.key] = copy[field.key] === true || copy[field.key] === 1 || copy[field.key] === '1';
    }
  }
  return copy;
}

async function refreshCache() {
  for (const entity of APP.entities) {
    const list = await store.all(entity.key);
    cache.set(entity.key, list.map((row) => normalizeRow(entity, row)));
  }
  state.total = APP.entities.reduce((sum, entity) => sum + (cache.get(entity.key)?.length || 0), 0);
}

async function refreshCounts() {
  const counts = {};
  for (const entity of APP.entities) counts[entity.key] = (cache.get(entity.key) || []).length;
  state.counts = counts;
}

function rows(entityKey) {
  return cache.get(entityKey) || [];
}

async function reload({ render = true } = {}) {
  await refreshCache();
  await refreshCounts();
  if (render) renderApp();
}

/* ---------- Helpers partagés par les blocs ---------- */

function entityByKey(key) {
  return ENTITY_MAP[key] || null;
}

function fieldByKey(entity, key) {
  return entity?.fields.find((field) => field.key === key) || null;
}

function screenForEntity(entityKey) {
  return APP.screens.find((screen) => screen.type === 'crud' && screen.entity === entityKey) || APP.screens[0];
}

function findRow(entityKey, id) {
  return rows(entityKey).find((row) => row.id === Number(id)) || null;
}

function relationLabel(field, value) {
  const target = entityByKey(field.target);
  if (!target || value === null || value === undefined || value === '') return '—';
  const row = findRow(target.key, value);
  if (!row) return '—';
  return String(row[target.labelField] ?? '—');
}

function formatFieldValue(field, value) {
  if (value === null || value === undefined || value === '') return '—';
  switch (field.type) {
    case 'number': return formatNumber(value);
    case 'currency': return formatMoney(value);
    case 'boolean': return value ? 'Oui' : 'Non';
    case 'date': return formatDate(value);
    case 'relation': return relationLabel(field, value);
    default: return String(value);
  }
}

function recordLabel(entity, row) {
  const field = fieldByKey(entity, entity.labelField);
  if (!row) return '—';
  const value = field ? formatFieldValue(field, row[field.key]) : String(row.id);
  return value === '—' ? `#${row.id}` : value;
}

function formatKpiValue(value, format) {
  if (format === 'currency') return formatMoney(value);
  if (format === 'percent') return formatPercent(value);
  if (format === 'text') return String(value);
  return formatNumber(value);
}

const FILTER_SYMBOLS = { eq: '=', neq: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤', contains: 'contient' };

function kpiCaption(kpi) {
  if (!kpi.filter) {
    return kpi.aggregation === 'count' ? 'Tous les enregistrements' : `${formatNumber(rows(kpi.entity).length)} lignes analysées`;
  }
  const entity = entityByKey(kpi.entity);
  const field = entity ? fieldByKey(entity, kpi.filter.field) : null;
  const value = typeof kpi.filter.value === 'boolean' ? (kpi.filter.value ? 'oui' : 'non') : kpi.filter.value;
  return `${field?.label || kpi.filter.field} ${FILTER_SYMBOLS[kpi.filter.op] || ''} ${value}`;
}

function matchesFilter(row, filter) {
  if (!filter) return true;
  const value = row[filter.field];
  const target = filter.value;
  const asText = (input) => String(input ?? '').toLowerCase();
  if (filter.op === 'eq') return String(value ?? '') === String(target ?? '');
  if (filter.op === 'neq') return String(value ?? '') !== String(target ?? '');
  if (filter.op === 'contains') return asText(value).includes(asText(target));
  const a = Number(value);
  const b = Number(target);
  if (Number.isFinite(a) && Number.isFinite(b)) {
    if (filter.op === 'gt') return a > b;
    if (filter.op === 'gte') return a >= b;
    if (filter.op === 'lt') return a < b;
    if (filter.op === 'lte') return a <= b;
  }
  const left = String(value ?? '');
  const right = String(target ?? '');
  const compare = left.localeCompare(right, 'fr', { numeric: true });
  if (filter.op === 'gt') return compare > 0;
  if (filter.op === 'gte') return compare >= 0;
  if (filter.op === 'lt') return compare < 0;
  if (filter.op === 'lte') return compare <= 0;
  return true;
}

function computeKpi(kpi) {
  const matching = rows(kpi.entity).filter((row) => matchesFilter(row, kpi.filter));
  if (kpi.aggregation === 'count') return matching.length;
  const total = matching.reduce((sum, row) => {
    const base = Number(row[kpi.field]);
    if (!Number.isFinite(base)) return sum;
    const factor = kpi.multiplyBy ? Number(row[kpi.multiplyBy]) : 1;
    return sum + base * (Number.isFinite(factor) ? factor : 1);
  }, 0);
  if (kpi.aggregation === 'avg') return matching.length ? total / matching.length : 0;
  return total;
}

function firstFilterField(entity) {
  return entity.fields.find((field) => field.type === 'select') || entity.fields.find((field) => field.type === 'boolean') || null;
}

function normalizeSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function filteredRows(screen) {
  const entity = entityByKey(screen.entity);
  if (!entity) return [];
  let list = rows(entity.key);
  const filter = state.filters[screen.key];
  if (filter?.value !== undefined && filter.value !== '' && filter.field) {
    list = list.filter((row) => String(row[filter.field] ?? '') === String(filter.value));
  }
  const query = normalizeSearch(String(state.search[screen.key] || '').trim());
  if (query) {
    list = list.filter((row) => entity.fields.some((field) => {
      if (!field.searchable) return false;
      const value = formatFieldValue(field, row[field.key]);
      return value !== '—' && normalizeSearch(value).includes(query);
    }));
  }
  return sortRows(list, entity, state.sort[screen.key]);
}

function sortValue(field, row) {
  const value = row[field.key];
  if (value === null || value === undefined || value === '') return null;
  if (field.type === 'relation') return relationLabel(field, value).toLowerCase();
  if (field.type === 'date') {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : null;
  }
  if (['number', 'currency', 'boolean'].includes(field.type)) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  return String(value).toLowerCase();
}

function sortRows(list, entity, sort) {
  if (!sort?.field) return list;
  const field = fieldByKey(entity, sort.field);
  if (!field) return list;
  return [...list].sort((a, b) => {
    const left = sortValue(field, a);
    const right = sortValue(field, b);
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    let result;
    if (typeof left === 'number' && typeof right === 'number') result = left - right;
    else result = String(left).localeCompare(String(right), 'fr', { numeric: true, sensitivity: 'base' });
    return sort.dir === 'desc' ? -result : result;
  });
}

/* ---------- Shell ---------- */

function currentRoute() {
  const key = decodeURIComponent((location.hash || '').replace(/^#\/?/, ''));
  if (SCREEN_MAP[key] || EXTENSION_SCREEN_MAP[key]) return key;
  return APP.screens[0].key;
}

/** Navigation : écrans générés puis écrans ajoutés par les extensions. */
function navigableScreens() {
  const extensionItems = EXTENSION_SCREENS.map((screen) => ({
    key: screen.id,
    title: screen.title,
    icon: screen.icon || 'sparkles',
    type: 'extension',
    entity: screen.entity || null
  }));
  return [...APP.screens, ...extensionItems];
}

function shell(screen, content) {
  const activeStorageLabel = store.mode === 'local' ? 'Stockage local actif' : 'Base SQLite locale';
  const navItems = navigableScreens().map((item) => {
    const isActive = item.key === screen.key;
    const count = item.type === 'crud' && item.entity ? `<span class="nav-count">${formatNumber(state.counts[item.entity] || 0)}</span>` : '';
    return `<a class="nav-item${isActive ? ' is-active' : ''}" href="#/${encodeURIComponent(item.key)}" data-nav${isActive ? ' aria-current="page"' : ''}>
      ${icon(item.icon, 18)}
      <span class="nav-text">${escapeHtml(item.title)}</span>
      ${count}
    </a>`;
  }).join('');

  return `
    <div class="app-shell">
      <aside class="sidebar" aria-label="Navigation principale">
        <div class="brand">
          <div class="brand-mark">${icon(APP.app.icon, 20)}</div>
          <div class="brand-copy">
            <strong>${escapeHtml(APP.app.name)}</strong>
            <span>${escapeHtml(APP.app.tagline)}</span>
          </div>
        </div>
        <nav class="sidebar-nav">
          <div class="nav-label">Navigation</div>
          <div class="nav-list">${navItems}</div>
        </nav>
        <div class="sidebar-foot">
          <div class="storage-card">
            <span class="storage-dot${store.persistent ? '' : ' is-memory'}"></span>
            <div>
              <strong>${activeStorageLabel}</strong>
              <small>${formatNumber(state.total)} enregistrements · ${APP.entities.length} tables</small>
            </div>
          </div>
          <div class="sidebar-meta">${escapeHtml(APP.app.name)} · généré avec AppMaker</div>
        </div>
      </aside>
      ${state.navOpen ? '<div class="nav-scrim" data-action="close-nav"></div>' : ''}
      <div class="workspace">
        <header class="topbar">
          <button class="icon-btn menu-btn" type="button" data-action="toggle-nav" aria-label="Ouvrir la navigation">${icon('menu')}</button>
          <div class="crumbs">
            <span class="crumb-app">${escapeHtml(APP.app.name)}</span>
            <span class="crumb-slash">/</span>
            <strong>${escapeHtml(screen.title)}</strong>
          </div>
          <div class="topbar-actions">
            <span class="status-pill">${activeStorageLabel}</span>
            <div class="avatar" title="${escapeHtml(APP.app.name)}">${escapeHtml(initials(APP.app.name))}</div>
          </div>
        </header>
        <main class="content">${content}</main>
      </div>
    </div>`;
}

/* ---------- Formulaires & suppression ---------- */

function renderFormField(field, record, isFirst) {
  const id = `field-${field.key}`;
  const requiredAttr = field.required ? ' required' : '';
  const requiredMark = field.required ? '<span class="field-required">*</span>' : '';
  const placeholder = field.placeholder || '';
  const wide = field.type === 'textarea' ? ' is-wide' : '';
  let control = '';

  switch (field.type) {
    case 'textarea':
      control = `<textarea class="textarea" id="${id}" name="${field.key}" placeholder="${escapeHtml(placeholder)}"${requiredAttr}>${escapeHtml(record?.[field.key] ?? '')}</textarea>`;
      break;
    case 'number':
    case 'currency': {
      const min = field.min !== undefined ? ` min="${field.min}"` : '';
      const max = field.max !== undefined ? ` max="${field.max}"` : '';
      const step = field.step !== undefined ? ` step="${field.step}"` : '';
      const raw = record?.[field.key] ?? '';
      const input = `<input class="input" type="number" inputmode="decimal" id="${id}" name="${field.key}" value="${escapeHtml(raw)}"${min}${max}${step} placeholder="${escapeHtml(placeholder)}"${requiredAttr}>`;
      const affix = field.type === 'currency' ? '€' : (field.unit ? escapeHtml(field.unit) : '');
      control = affix ? `<div class="input-affix">${input}<span class="affix">${affix}</span></div>` : input;
      break;
    }
    case 'date':
      control = `<input class="input" type="date" id="${id}" name="${field.key}" value="${escapeHtml(record?.[field.key] ?? new Date().toISOString().slice(0, 10))}"${requiredAttr}>`;
      break;
    case 'select':
      control = `<select class="select" id="${id}" name="${field.key}"${requiredAttr}>
        <option value="">Sélectionner…</option>
        ${(field.options || []).map((option) => `<option value="${escapeHtml(option)}"${String(record?.[field.key]) === option ? ' selected' : ''}>${escapeHtml(option)}</option>`).join('')}
      </select>`;
      break;
    case 'relation': {
      const target = entityByKey(field.target);
      const options = target ? rows(target.key) : [];
      control = `<select class="select" id="${id}" name="${field.key}"${requiredAttr}>
        <option value="">${options.length ? 'Sélectionner…' : 'Aucun élément disponible'}</option>
        ${options.map((row) => `<option value="${row.id}"${Number(record?.[field.key]) === row.id ? ' selected' : ''}>${escapeHtml(recordLabel(target, row))}</option>`).join('')}
      </select>
      ${!options.length ? `<p class="field-hint">Aucun ${escapeHtml(target?.name.toLowerCase() || 'élément')} enregistré. Ajoutez-en un depuis le menu.</p>` : ''}`;
      break;
    }
    case 'boolean': {
      const checked = record?.[field.key] === true || record?.[field.key] === 1;
      control = `<div class="checkbox-row">
        <label class="switch">
          <input type="checkbox" id="${id}" name="${field.key}"${checked ? ' checked' : ''}>
          <span class="switch-track"></span>
          <span>${checked ? 'Activé' : 'Désactivé'}</span>
        </label>
      </div>`;
      break;
    }
    default:
      control = `<input class="input" type="text" id="${id}" name="${field.key}" value="${escapeHtml(record?.[field.key] ?? '')}" placeholder="${escapeHtml(placeholder || field.label)}"${requiredAttr}${isFirst ? ' autofocus' : ''}>`;
  }

  return `<div class="field${wide}">
    <label for="${id}">${escapeHtml(field.label)}${requiredMark}</label>
    ${control}
  </div>`;
}

function readFormValues(entity, form) {
  const values = {};
  const errors = {};
  for (const field of entity.fields) {
    const input = form.elements.namedItem(field.key);
    if (!input) continue;
    let value;
    if (field.type === 'boolean') value = input.checked;
    else if (['number', 'currency', 'relation'].includes(field.type)) value = input.value === '' ? null : Number(input.value);
    else value = input.value.trim() === '' ? null : input.value.trim();

    if (field.required) {
      if (field.type === 'boolean' && !value) errors[field.key] = 'Ce champ doit être activé.';
      else if (value === null || value === undefined || value === '') errors[field.key] = 'Ce champ est obligatoire.';
    }
    if (['number', 'currency'].includes(field.type) && value !== null) {
      if (!Number.isFinite(value)) errors[field.key] = 'Saisissez un nombre valide.';
      else if (field.min !== undefined && value < field.min) errors[field.key] = `La valeur minimale est ${field.min}.`;
      else if (field.max !== undefined && value > field.max) errors[field.key] = `La valeur maximale est ${field.max}.`;
    }
    values[field.key] = value;
  }
  return { values, errors };
}

function showFormErrors(modal, errors) {
  modal.querySelectorAll('.field-error').forEach((el) => el.remove());
  modal.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
  for (const [key, message] of Object.entries(errors)) {
    const input = modal.querySelector(`[name="${key}"]`);
    if (!input) continue;
    input.classList.add('is-invalid');
    const wrapper = input.closest('.field');
    if (wrapper) {
      const error = document.createElement('p');
      error.className = 'field-error';
      error.textContent = message;
      wrapper.appendChild(error);
    }
  }
  modal.querySelector('.is-invalid')?.focus();
}

function openEntityForm(entityKey, recordId = null) {
  const entity = entityByKey(entityKey);
  if (!entity) return;
  const record = recordId ? findRow(entityKey, recordId) : null;
  const title = record ? `Modifier ${entity.name.toLowerCase()}` : `Nouveau ${entity.name.toLowerCase()}`;
  const fields = entity.fields.map((field) => renderFormField(field, record, field === entity.fields[0])).join('');

  openModal(`
    <div class="modal-head">
      <div class="modal-head-copy">
        <div class="modal-eyebrow">${escapeHtml(entity.namePlural)}</div>
        <h2>${escapeHtml(title)}</h2>
        <p>${record ? 'Mettez à jour les informations puis enregistrez.' : 'Renseignez les informations pour créer une nouvelle entrée.'}</p>
      </div>
      <button class="icon-btn" type="button" data-modal-close aria-label="Fermer">${icon('x')}</button>
    </div>
    <div class="modal-body">
      <form novalidate>
        <div class="form-grid">${fields}</div>
        <div class="modal-actions">
          <button class="btn btn-ghost" type="button" data-modal-close>Annuler</button>
          <button class="btn btn-primary" type="submit">${record ? 'Enregistrer' : 'Créer'}</button>
        </div>
      </form>
    </div>
  `, {
    onMount(modal, close) {
      const form = modal.querySelector('form');
      form.querySelectorAll('input[type="checkbox"]').forEach((input) => {
        input.addEventListener('change', () => {
          const text = input.closest('.switch')?.querySelector('span:last-child');
          if (text) text.textContent = input.checked ? 'Activé' : 'Désactivé';
        });
      });
      form.addEventListener('input', (event) => {
        const field = event.target.closest('.field');
        if (field) {
          field.querySelector('.field-error')?.remove();
          field.querySelector('.is-invalid')?.classList.remove('is-invalid');
        }
      });
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const { values, errors } = readFormValues(entity, form);
        if (Object.keys(errors).length) {
          showFormErrors(modal, errors);
          return;
        }
        const submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;
        try {
          if (record) {
            await store.update(entityKey, record.id, values);
            toast('Modifications enregistrées');
          } else {
            await store.insert(entityKey, values);
            toast('Nouvel enregistrement ajouté');
          }
          close();
          await reload();
        } catch (error) {
          console.error(error);
          submit.disabled = false;
          toast('L’enregistrement a échoué. Réessayez.', 'error');
        }
      });
    }
  });
}

async function openDeleteDialog(entityKey, recordId) {
  const entity = entityByKey(entityKey);
  if (!entity) return;
  const record = findRow(entityKey, recordId);
  if (!record) return;
  const label = recordLabel(entity, record);
  const confirmed = await confirmDialog({
    title: `Supprimer ${entity.name.toLowerCase()} ?`,
    message: `<strong>${escapeHtml(label)}</strong> sera définitivement supprimé de vos données locales.`,
    confirmLabel: 'Supprimer'
  });
  if (!confirmed) return;
  try {
    await store.remove(entityKey, recordId);
    toast('Enregistrement supprimé');
    await reload();
  } catch (error) {
    console.error(error);
    toast('La suppression a échoué. Réessayez.', 'error');
  }
}

/* ---------- Blocs générés ---------- */
{{BLOCK_RENDERERS}}

const RENDERERS = { {{RENDERER_MAP}} };

/* ---------- Routage & rendu ---------- */

function renderExtensionScreen(screen) {
  try {
    return screen.render(extensionScreenContext(screen));
  } catch (error) {
    console.error(`Écran d’extension « ${screen.id} » :`, error);
    return `<div class="page"><div class="panel"><div class="panel-empty">${icon('alert', 22)}<p>Cet écran a rencontré une erreur.</p></div></div></div>`;
  }
}

/** Contexte partagé entre render(), mount() et on(). */
function extensionScreenContext(screen) {
  return {
    app: APP,
    screen,
    root: view.querySelector('.content'),
    store,
    reload: () => reload(),
    refresh: () => refreshExtensionScreen(screen),
    rows: screen.entity ? rows(screen.entity) : [],
    rowsFor: rows,
    icon,
    escapeHtml,
    formatNumber,
    formatMoney,
    formatPercent,
    formatDate,
    formatRelative,
    toast,
    confirm: confirmDialog,
    ui: { toast, confirm: confirmDialog }
  };
}

/**
 * Après un événement, seul le contenu est re-rendu : l'écran garde son état local
 * (variable de module) et mount() rebranche les écouteurs sur le nouveau DOM.
 */
function refreshExtensionScreen(screen) {
  const current = ++renderToken;
  const content = renderExtensionScreen(screen);
  if (current !== renderToken) return;
  const main = view.querySelector('.content');
  if (!main) {
    renderApp();
    return;
  }
  main.innerHTML = content;
  mountExtensionScreen(screen);
}

function mountExtensionScreen(screen) {
  if (typeof screen.mount !== 'function') return;
  try {
    screen.mount(view.querySelector('.content'), extensionScreenContext(screen));
  } catch (error) {
    console.error(`Écran d’extension « ${screen.id} » (mount) :`, error);
  }
}

/** Écouteurs déclaratifs : tout élément [data-ext-event="nom"] déclenche screen.on(nom, …). */
function bindExtensionEvents() {
  const handler = (event) => {
    const trigger = event.target.closest('[data-ext-event]');
    if (!trigger) return;
    const route = currentRoute();
    const screen = EXTENSION_SCREEN_MAP[route];
    if (!screen || typeof screen.on !== 'function') return;
    const name = trigger.dataset.extEvent;
    try {
      const result = screen.on(name, trigger, extensionScreenContext(screen), event);
      if (result && typeof result.then === 'function') {
        result.catch((error) => console.error(`Écran « ${screen.id} » (${name}) :`, error));
      }
    } catch (error) {
      console.error(`Écran d’extension « ${screen.id} » (${name}) :`, error);
    }
  };
  for (const type of ['click', 'submit', 'change']) {
    document.addEventListener(type, handler, true);
  }
}

function renderApp() {
  const current = ++renderToken;
  const route = currentRoute();
  const screen = SCREEN_MAP[route] || EXTENSION_SCREEN_MAP[route] || APP.screens[0];
  let content;
  if (EXTENSION_SCREEN_MAP[route]) {
    content = renderExtensionScreen(EXTENSION_SCREEN_MAP[route]);
  } else {
    const renderer = RENDERERS[screen.type];
    content = typeof renderer === 'function'
      ? renderer(screen)
      : `<div class="page"><div class="panel"><div class="panel-head"><h2>Écran indisponible</h2></div></div></div>`;
  }
  if (current !== renderToken) return;
  view.innerHTML = shell(screen, content);
  if (EXTENSION_SCREEN_MAP[route]) mountExtensionScreen(EXTENSION_SCREEN_MAP[route]);
  document.body.classList.toggle('nav-open', state.navOpen);
  document.title = `${screen.title} · ${APP.app.name}`;
}

function scheduleRender() {
  window.requestAnimationFrame(() => renderApp());
}

function renderWithSearchFocus(screenKey, caret) {
  renderApp();
  const input = view.querySelector(`[data-search="${screenKey}"]`);
  if (input) {
    input.focus();
    input.setSelectionRange(caret, caret);
  }
}

async function runExtensionAction(button) {
  const extensionAction = APP.extensions.findRowAction(button.dataset.extAction);
  const entity = ENTITY_MAP[button.dataset.entity];
  if (!extensionAction || !entity || typeof extensionAction.run !== 'function') return;

  const rowId = Number(button.dataset.id);
  const row = rows(entity.key).find((candidate) => Number(candidate.id) === rowId);
  if (!row) return;
  const screen = APP.screens.find((item) => item.type === 'crud' && item.entity === entity.key) || null;

  button.disabled = true;
  try {
    await extensionAction.run({
      app: APP,
      entity,
      screen,
      row,
      rows: rows(entity.key),
      store,
      reload: () => reload(),
      download: downloadText,
      toCsv,
      ui: { toast, escapeHtml, formatNumber, formatMoney, formatPercent, formatDate, confirm: confirmDialog }
    });
  } catch (error) {
    console.error(`Action « ${extensionAction.id} » :`, error);
    toast('L’action n’a pas pu être exécutée.', 'error');
  } finally {
    button.disabled = false;
  }
}

document.addEventListener('click', async (event) => {
  const extensionButton = event.target.closest('[data-ext-action]');
  if (extensionButton) {
    await runExtensionAction(extensionButton);
    return;
  }

  if (event.target.closest('[data-nav]')) {
    state.navOpen = false;
    document.body.classList.remove('nav-open');
  }

  const trigger = event.target.closest('[data-action]');
  if (!trigger) return;
  const action = trigger.dataset.action;

  if (action === 'toggle-nav') {
    state.navOpen = !state.navOpen;
    renderApp();
    return;
  }
  if (action === 'close-nav') {
    state.navOpen = false;
    renderApp();
    return;
  }
  if (action === 'add') {
    openEntityForm(trigger.dataset.entity);
    return;
  }
  if (action === 'edit') {
    openEntityForm(trigger.dataset.entity, Number(trigger.dataset.id));
    return;
  }
  if (action === 'delete') {
    openDeleteDialog(trigger.dataset.entity, Number(trigger.dataset.id));
    return;
  }
  if (action === 'sort') {
    const screenKey = trigger.dataset.screen;
    const fieldKey = trigger.dataset.field;
    const current = state.sort[screenKey];
    if (!current || current.field !== fieldKey) state.sort[screenKey] = { field: fieldKey, dir: 'asc' };
    else if (current.dir === 'asc') state.sort[screenKey] = { field: fieldKey, dir: 'desc' };
    else state.sort[screenKey] = null;
    renderApp();
    return;
  }
  if (action === 'clear-filters') {
    const screenKey = trigger.dataset.screen;
    delete state.search[screenKey];
    delete state.filters[screenKey];
    scheduleRender();
  }
});

document.addEventListener('input', (event) => {
  const input = event.target.closest('[data-search]');
  if (!input) return;
  const screenKey = input.dataset.search;
  state.search[screenKey] = input.value;
  renderWithSearchFocus(screenKey, input.selectionStart ?? input.value.length);
});

document.addEventListener('change', (event) => {
  const select = event.target.closest('[data-filter]');
  if (!select) return;
  const screenKey = select.dataset.filter;
  state.filters[screenKey] = select.value
    ? { field: select.dataset.field, value: select.value }
    : null;
  renderApp();
  view.querySelector(`[data-filter="${screenKey}"]`)?.focus();
});

window.matchMedia('(min-width: 901px)').addEventListener('change', (event) => {
  if (event.matches && state.navOpen) {
    state.navOpen = false;
    renderApp();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Erreur asynchrone', event.reason);
});

async function boot() {
  bindExtensionEvents();
  try {
    await store.init();
  } catch (error) {
    console.warn('SQLite indisponible, bascule sur le stockage local :', error);
    if (typeof store.initFallback === 'function') {
      state.storageError = error?.message || String(error);
      await store.initFallback();
    } else throw error;
  }
  await refreshCache();
  await refreshCounts();
  if (!location.hash) {
    history.replaceState(null, '', `#/${encodeURIComponent(APP.screens[0].key)}`);
  }
  renderApp();
  window.addEventListener('hashchange', () => {
    state.navOpen = false;
    renderApp();
  });
}

boot().catch((error) => {
  console.error(error);
  window.__appmakerBootError = error;
  const hint = HAS_TAURI && store.mode === 'sqlite'
    ? `<p class="boot-hint">La base locale n’a pas pu être ouverte. Fermez et relancez l’application ; si le problème persiste, supprimez le dossier de données de l’application.</p>${state.storageError ? `<p class="boot-hint">Détail : ${escapeHtml(state.storageError)}</p>` : ''}`
    : '';
  view.innerHTML = `<div class="error-screen">
    <div class="error-card">
      <div class="boot-mark">!</div>
      <h1>Impossible de charger l’application</h1>
      <p>${escapeHtml(error?.message || String(error) || 'Erreur inconnue')}</p>
      ${hint}
      <div style="margin-top:16px;display:flex;gap:8px;justify-content:center">
        <button class="btn btn-primary" type="button" data-reload>Recharger</button>
        <button class="btn btn-ghost" type="button" data-copy-diagnostic>Copier le diagnostic</button>
      </div>
    </div>
  </div>`;
  view.querySelector('[data-reload]')?.addEventListener('click', () => location.reload());
  view.querySelector('[data-copy-diagnostic]')?.addEventListener('click', async () => {
    const payload = [
      `AppMaker ${APP.name} ${APP.desktop ? '(desktop)' : '(web)'}`,
      `URL : ${location.href}`,
      `Tauri : ${typeof window.__TAURI_INTERNALS__ !== 'undefined'}`,
      `SQL natif : ${typeof window.__TAURI_INTERNALS__?.invoke === 'function'}`,
      `Erreur : ${error?.stack || String(error)}`
    ].join('\n');
    try { await navigator.clipboard.writeText(payload); } catch { console.log(payload); }
  });
});
