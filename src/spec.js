import crypto from 'node:crypto';

const FIELD_TYPES = new Set(['text', 'textarea', 'number', 'currency', 'boolean', 'date', 'select', 'relation']);
const AGGREGATIONS = new Set(['count', 'sum', 'avg']);
const FORMATS = new Set(['number', 'currency', 'percent', 'text']);
const TONES = new Set(['accent', 'success', 'warning', 'danger', 'neutral']);
const FILTER_OPS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains']);

const ICONS = new Set([
  'dashboard', 'package', 'boxes', 'users', 'user', 'truck', 'receipt', 'file-text',
  'calendar', 'settings', 'plus', 'search', 'edit', 'trash', 'x', 'alert', 'trend',
  'euro', 'list', 'kanban', 'chart', 'clock', 'check', 'home', 'briefcase', 'folder',
  'tag', 'cart', 'credit-card', 'building', 'activity', 'layers', 'map-pin', 'phone',
  'mail', 'star', 'filter', 'more-horizontal', 'chevron-down', 'arrow-up-right'
]);

const ICON_ALIASES = {
  overview: 'dashboard', 'layout-dashboard': 'dashboard', grid: 'dashboard',
  product: 'package', products: 'package', inventory: 'boxes', stock: 'boxes',
  client: 'users', clients: 'users', customer: 'users', customers: 'users', team: 'users',
  supplier: 'truck', suppliers: 'truck', fournisseur: 'truck', fournisseurs: 'truck',
  invoice: 'receipt', invoices: 'receipt', facture: 'receipt', factures: 'receipt',
  document: 'file-text', documents: 'file-text', file: 'file-text', notes: 'file-text',
  event: 'calendar', events: 'calendar', planning: 'calendar',
  alert: 'alert', warning: 'alert', euro: 'euro', money: 'euro', finance: 'euro',
  chart: 'chart', analytics: 'chart', stats: 'chart', stats2: 'chart',
  todo: 'check', task: 'check', tasks: 'check', project: 'briefcase', projects: 'briefcase',
  store: 'building', shop: 'building', company: 'building', crm: 'users'
};

const DEFAULT_ACCENT = '#5B5BD6';
const RESERVED_KEYS = new Set([
  'id', 'createdAt', 'updatedAt', '__proto__', 'prototype', 'constructor',
  'toString', 'valueOf', 'hasOwnProperty', 'then', 'catch', 'finally'
]);

function safeKey(key, prefix) {
  if (!RESERVED_KEYS.has(key) && !key.startsWith('__')) return key;
  const cleaned = key.replace(/^_+/, '') || 'valeur';
  return `${prefix}${cleaned[0].toUpperCase()}${cleaned.slice(1)}`;
}

function pickString(value, fallback = '', max = 80) {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;
  const cleaned = String(value).replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, max) : fallback;
}

function asciiSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function camelKey(value, fallback) {
  const parts = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  let key = parts.map((part, index) => index === 0 ? part : part[0].toUpperCase() + part.slice(1)).join('');
  if (!key) key = fallback;
  if (/^[0-9]/.test(key)) key = `f${key}`;
  return key.slice(0, 40);
}

function uniqueKey(base, used) {
  let key = base;
  let i = 2;
  while (used.has(key)) key = `${base}${i++}`;
  used.add(key);
  return key;
}

function normalizeIcon(value, fallback = 'folder') {
  const raw = pickString(value, '', 40).toLowerCase();
  if (ICONS.has(raw)) return raw;
  if (ICON_ALIASES[raw]) return ICON_ALIASES[raw];
  if (fallback && ICONS.has(fallback)) return fallback;
  return 'folder';
}

function normalizeFieldType(value) {
  const type = pickString(value, 'text', 20).toLowerCase();
  const aliases = {
    string: 'text', name: 'text', email: 'text', tel: 'text', phone: 'text', url: 'text',
    longtext: 'textarea', notes: 'textarea', description: 'textarea',
    int: 'number', integer: 'number', float: 'number', decimal: 'number', quantity: 'number',
    price: 'currency', money: 'currency', amount: 'currency',
    bool: 'boolean', checkbox: 'boolean', switch: 'boolean',
    timestamp: 'date', datetime: 'date', 'date-time': 'date',
    enum: 'select', choice: 'select', status: 'select',
    lookup: 'relation', reference: 'relation', foreignkey: 'relation', 'foreign-key': 'relation'
  };
  const normalized = aliases[type] || type;
  return FIELD_TYPES.has(normalized) ? normalized : 'text';
}

function cleanOptions(rawOptions) {
  if (!Array.isArray(rawOptions)) return [];
  const seen = new Set();
  const options = [];
  for (const option of rawOptions) {
    const label = pickString(typeof option === 'object' ? option.label ?? option.value : option, '', 50);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(label);
    if (options.length >= 12) break;
  }
  return options;
}

function coerceNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/\s/g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function coerceBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const raw = String(value ?? '').toLowerCase();
  if (['true', 'oui', 'yes', '1', 'actif', 'active'].includes(raw)) return true;
  if (['false', 'non', 'no', '0', 'inactif', 'inactive'].includes(raw)) return false;
  return null;
}

function coerceDate(value) {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = raw.match(/^(\d{2})[\/.](\d{2})[\/.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function normalizeField(raw, index, usedKeys) {
  if (!raw || typeof raw !== 'object') return null;
  const type = normalizeFieldType(raw.type);
  const label = pickString(raw.label ?? raw.name ?? raw.title, `Champ ${index + 1}`, 50);
  const key = uniqueKey(safeKey(camelKey(raw.key ?? raw.name ?? label, `field${index + 1}`), 'field'), usedKeys);

  const field = {
    key,
    label,
    type,
    required: raw.required === true,
    inTable: raw.inTable !== false,
    searchable: raw.searchable !== false && ['text', 'select', 'relation', 'textarea'].includes(type),
    placeholder: pickString(raw.placeholder, '', 80),
    unit: pickString(raw.unit, '', 12)
  };

  if (['number', 'currency'].includes(type)) {
    const min = coerceNumber(raw.min);
    const max = coerceNumber(raw.max);
    const step = coerceNumber(raw.step);
    if (min !== null) field.min = min;
    if (max !== null) field.max = max;
    field.step = step !== null && step > 0 ? step : (type === 'currency' ? 0.01 : 1);
  }

  if (type === 'select') {
    field.options = cleanOptions(raw.options);
    if (field.options.length < 2) {
      field.type = 'text';
      delete field.options;
    }
  }

  if (type === 'relation') {
    const target = pickString(raw.target ?? raw.entity ?? raw.relation, '', 40);
    if (!target) {
      field.type = 'text';
    } else {
      field.target = target;
    }
  }

  if (field.type === 'textarea') {
    field.inTable = false;
    field.searchable = raw.searchable === true;
  }

  return field;
}

function normalizeEntity(raw, index, usedEntityKeys) {
  if (!raw || typeof raw !== 'object') return null;
  const name = pickString(raw.name ?? raw.title ?? raw.label, `Entité ${index + 1}`, 40);
  const rawKey = raw.key ?? raw.id ?? asciiSlug(name);
  const safeEntityKey = safeKey(camelKey(rawKey, `entity${index + 1}`), 'entity');
  const key = uniqueKey(safeEntityKey, usedEntityKeys);
  const namePlural = pickString(raw.namePlural ?? raw.plural ?? `${name}s`, `${name}s`, 45);

  const fields = [];
  const usedFieldKeys = new Set();
  const rawFields = Array.isArray(raw.fields) ? raw.fields.slice(0, 12) : [];
  for (const rawField of rawFields) {
    const field = normalizeField(rawField, fields.length, usedFieldKeys);
    if (field) fields.push(field);
  }
  if (!fields.length) {
    fields.push({ key: 'nom', label: 'Nom', type: 'text', inTable: true, searchable: true, required: true, placeholder: '', unit: '' });
  }

  let labelField = camelKey(raw.labelField, '');
  if (!fields.some((field) => field.key === labelField && ['text', 'select', 'date', 'number'].includes(field.type))) {
    const candidate = fields.find((field) => field.type === 'text') || fields.find((field) => ['select', 'date', 'number'].includes(field.type)) || fields[0];
    labelField = candidate.key;
  }

  // Max 6 columns in list views, and the display label always stays visible.
  let tableCount = 0;
  fields.forEach((field) => {
    if (field.key === labelField) {
      field.inTable = true;
      tableCount += 1;
    }
  });
  fields.forEach((field) => {
    if (!field.inTable || field.key === labelField) return;
    if (tableCount >= 6) field.inTable = false;
    else tableCount += 1;
  });

  return {
    key,
    name,
    namePlural,
    icon: normalizeIcon(raw.icon, 'folder'),
    labelField,
    fields
  };
}

function resolveRelationTargets(entities) {
  const byName = new Map(entities.map((entity) => [entity.key, entity]));
  const byNameLower = new Map(entities.map((entity) => [entity.name.toLowerCase(), entity]));
  const byLabelLower = new Map(entities.map((entity) => [entity.namePlural.toLowerCase(), entity]));

  for (const entity of entities) {
    for (const field of entity.fields) {
      if (field.type !== 'relation') continue;
      const rawTarget = String(field.target || '');
      const candidate = byName.get(rawTarget) || byName.get(camelKey(rawTarget, '')) ||
        byNameLower.get(rawTarget.toLowerCase()) || byLabelLower.get(rawTarget.toLowerCase());
      if (candidate) {
        field.target = candidate.key;
        if (candidate.key === entity.key) {
          field.type = 'text';
          delete field.target;
        }
      } else {
        field.type = 'text';
        delete field.target;
      }
    }
  }
}

function normalizeValue(field, value) {
  if (value === null || value === undefined || value === '') return null;
  switch (field.type) {
    case 'number':
    case 'currency':
      return coerceNumber(value);
    case 'boolean': {
      const bool = coerceBoolean(value);
      return bool === null ? null : bool;
    }
    case 'date':
      return coerceDate(value);
    case 'select': {
      if (!field.options?.length) return pickString(value, '', 100);
      const raw = pickString(value, '', 50);
      return field.options.find((option) => option.toLowerCase() === raw.toLowerCase()) || null;
    }
    case 'relation':
      return typeof value === 'number' ? value : pickString(value, '', 100);
    default:
      return pickString(typeof value === 'object' ? JSON.stringify(value) : value, '', 240);
  }
}

function normalizeSeed(rawSeed, entities) {
  const seed = {};
  const rawObject = rawSeed && typeof rawSeed === 'object' ? rawSeed : {};
  for (const entity of entities) {
    const rows = Array.isArray(rawObject[entity.key])
      ? rawObject[entity.key]
      : (Array.isArray(rawObject[entity.name]) ? rawObject[entity.name] : []);
    const cleanedRows = [];
    for (const rawRow of rows.slice(0, 12)) {
      if (!rawRow || typeof rawRow !== 'object') continue;
      const row = {};
      let filled = 0;
      for (const field of entity.fields) {
        const value = normalizeValue(field, rawRow[field.key] ?? rawRow[field.label]);
        if (value !== null) {
          row[field.key] = value;
          filled += 1;
        }
      }
      if (filled) cleanedRows.push(row);
    }
    seed[entity.key] = cleanedRows;
  }
  return seed;
}

function normalizeKpi(raw, entities, index) {
  if (!raw || typeof raw !== 'object') return null;
  const entity = entities.find((candidate) =>
    candidate.key === camelKey(raw.entity ?? raw.entityKey, '') ||
    candidate.name.toLowerCase() === pickString(raw.entity, '', 40).toLowerCase() ||
    candidate.namePlural.toLowerCase() === pickString(raw.entity, '', 40).toLowerCase()
  );
  if (!entity) return null;

  const aggregation = AGGREGATIONS.has(String(raw.aggregation).toLowerCase())
    ? String(raw.aggregation).toLowerCase()
    : 'count';

  let field = null;
  let multiplyBy = null;
  if (aggregation !== 'count') {
    const candidate = entity.fields.find((f) =>
      f.key === camelKey(raw.field, '') ||
      f.label.toLowerCase() === pickString(raw.field, '', 50).toLowerCase()
    );
    if (!candidate || !['number', 'currency'].includes(candidate.type)) return null;
    field = candidate.key;

    if (raw.multiplyBy) {
      const factor = entity.fields.find((f) =>
        f.key === camelKey(raw.multiplyBy, '') ||
        f.label.toLowerCase() === pickString(raw.multiplyBy, '', 50).toLowerCase()
      );
      if (factor && factor.type === 'number') multiplyBy = factor.key;
    }
  }

  let filter = null;
  if (raw.filter && typeof raw.filter === 'object') {
    const filterField = entity.fields.find((f) =>
      f.key === camelKey(raw.filter.field, '') ||
      f.label.toLowerCase() === pickString(raw.filter.field, '', 50).toLowerCase()
    );
    const op = String(raw.filter.op || 'eq').toLowerCase();
    if (filterField && FILTER_OPS.has(op)) {
      let value = raw.filter.value;
      if (['number', 'currency'].includes(filterField.type)) value = coerceNumber(value);
      else if (filterField.type === 'boolean') value = coerceBoolean(value);
      else value = pickString(value, '', 80);
      if (value !== null && value !== '') filter = { field: filterField.key, op, value };
    }
  }

  const fallbackLabel = aggregation === 'count'
    ? `${entity.namePlural}`
    : `${aggregation === 'sum' ? 'Total' : 'Moyenne'} ${field ? entity.fields.find((f) => f.key === field)?.label.toLowerCase() : ''}`;

  return {
    label: pickString(raw.label, fallbackLabel, 40),
    entity: entity.key,
    aggregation,
    field,
    multiplyBy,
    filter,
    format: FORMATS.has(String(raw.format).toLowerCase()) ? String(raw.format).toLowerCase() : (field && entity.fields.find((f) => f.key === field)?.type === 'currency' ? 'currency' : 'number'),
    icon: normalizeIcon(raw.icon, entity.icon),
    tone: TONES.has(String(raw.tone).toLowerCase()) ? String(raw.tone).toLowerCase() : 'accent'
  };
}

function autoKpis(entities) {
  const kpis = [];
  for (const entity of entities) {
    kpis.push({
      label: entity.namePlural,
      entity: entity.key,
      aggregation: 'count',
      field: null,
      filter: null,
      format: 'number',
      icon: entity.icon,
      tone: kpis.length === 0 ? 'accent' : 'neutral'
    });
    const numeric = entity.fields.find((field) => ['number', 'currency'].includes(field.type) && field.key !== entity.labelField);
    if (numeric && kpis.length < 4) {
      kpis.push({
        label: `${numeric.type === 'currency' ? 'Total' : 'Total'} ${numeric.label.toLowerCase()}`,
        entity: entity.key,
        aggregation: 'sum',
        field: numeric.key,
        filter: null,
        format: numeric.type === 'currency' ? 'currency' : 'number',
        icon: entity.icon,
        tone: 'accent'
      });
    }
  }
  return kpis.slice(0, 4);
}

function normalizeDashboard(raw, entities, index) {
  const kpis = (Array.isArray(raw.kpis) ? raw.kpis : [])
    .map((kpi, kpiIndex) => normalizeKpi(kpi, entities, kpiIndex))
    .filter(Boolean)
    .slice(0, 4);
  while (kpis.length < 3) {
    const auto = autoKpis(entities).find((candidate) => !kpis.some((kpi) => kpi.label === candidate.label));
    if (!auto) break;
    kpis.push(auto);
  }

  let breakdown = null;
  if (raw.breakdown && typeof raw.breakdown === 'object') {
    const entity = entities.find((candidate) => candidate.key === camelKey(raw.breakdown.entity, '') || candidate.name.toLowerCase() === pickString(raw.breakdown.entity, '', 40).toLowerCase());
    if (entity) {
      const field = entity.fields.find((candidate) =>
        (candidate.key === camelKey(raw.breakdown.field, '') || candidate.label.toLowerCase() === pickString(raw.breakdown.field, '', 50).toLowerCase()) &&
        ['select', 'boolean', 'text'].includes(candidate.type)
      );
      if (field) breakdown = { entity: entity.key, field: field.key, title: pickString(raw.breakdown.title, `Répartition par ${field.label.toLowerCase()}`, 50) };
    }
  }
  if (!breakdown) {
    for (const entity of entities) {
      const field = entity.fields.find((candidate) => candidate.type === 'select');
      if (field) {
        breakdown = { entity: entity.key, field: field.key, title: `Répartition par ${field.label.toLowerCase()}` };
        break;
      }
    }
  }

  let recent = null;
  if (raw.recent && typeof raw.recent === 'object') {
    const entity = entities.find((candidate) => candidate.key === camelKey(raw.recent.entity, '') || candidate.name.toLowerCase() === pickString(raw.recent.entity, '', 40).toLowerCase());
    if (entity) recent = { entity: entity.key, limit: Math.min(Math.max(Number(raw.recent.limit) || 6, 3), 10), title: pickString(raw.recent.title, `Derniers ${entity.namePlural.toLowerCase()}`, 50) };
  }
  if (!recent) {
    const entity = entities[entities.length - 1];
    if (entity) recent = { entity: entity.key, limit: 6, title: `Derniers ${entity.namePlural.toLowerCase()}` };
  }

  const defaultTitles = ['Tableau de bord', 'Vue d’ensemble', 'Pilotage'];
  return {
    type: 'dashboard',
    key: 'dashboard',
    title: pickString(raw.title, defaultTitles[index % defaultTitles.length], 40),
    icon: 'dashboard',
    kpis,
    breakdown,
    recent
  };
}

function normalizeCrud(raw, entities, usedScreenKeys, index) {
  const entity = entities.find((candidate) =>
    candidate.key === camelKey(raw.entity ?? raw.entityKey, '') ||
    candidate.name.toLowerCase() === pickString(raw.entity, '', 40).toLowerCase() ||
    candidate.namePlural.toLowerCase() === pickString(raw.entity, '', 40).toLowerCase()
  );
  if (!entity) return null;
  return {
    type: 'crud',
    key: uniqueKey(safeKey(camelKey(raw.key ?? raw.id ?? entity.key, entity.key), 'screen'), usedScreenKeys),
    title: pickString(raw.title, entity.namePlural, 40),
    subtitle: pickString(raw.subtitle, '', 70),
    icon: normalizeIcon(raw.icon, entity.icon),
    entity: entity.key
  };
}

function buildDefaultScreens(entities) {
  const screens = [{
    type: 'dashboard',
    key: 'dashboard',
    title: 'Tableau de bord',
    icon: 'dashboard',
    kpis: [],
    breakdown: null,
    recent: null
  }];
  for (const entity of entities) {
    screens.push({
      type: 'crud',
      key: entity.key,
      title: entity.namePlural,
      subtitle: '',
      icon: entity.icon,
      entity: entity.key
    });
  }
  return { screens, usedKeys: new Set(screens.map((screen) => screen.key)) };
}

/**
 * Normalizes an AI-generated application spec into a safe, renderable shape.
 * Every value that ends up in generated code is constrained here.
 */
export function normalizeSpec(raw, { prompt = '' } = {}) {
  if (!raw || typeof raw !== 'object') throw new Error('Le plan renvoyé par l’IA est vide.');

  const root = raw.spec && typeof raw.spec === 'object' ? raw.spec : raw;
  const appRaw = root.app && typeof root.app === 'object' ? root.app : root;

  const appName = pickString(appRaw.name ?? appRaw.appName ?? root.appName, '', 46) ||
    (prompt ? pickString(prompt.split(/[.,\n]/)[0], 'Mon application', 46) : 'Mon application');

  const usedEntityKeys = new Set();
  const entities = (Array.isArray(root.entities) ? root.entities : [])
    .slice(0, 4)
    .map((entity, index) => normalizeEntity(entity, index, usedEntityKeys))
    .filter(Boolean);

  if (!entities.length) throw new Error('Le plan ne contient aucune entité exploitable.');
  resolveRelationTargets(entities);

  const usedScreenKeys = new Set(['dashboard']);
  const rawScreens = Array.isArray(root.screens) ? root.screens : [];
  const screens = [];
  let dashboardSeen = false;

  for (const rawScreen of rawScreens.slice(0, 8)) {
    if (!rawScreen || typeof rawScreen !== 'object') continue;
    const type = String(rawScreen.type || '').toLowerCase();
    if (type === 'dashboard') {
      if (dashboardSeen) continue;
      dashboardSeen = true;
      screens.push(normalizeDashboard(rawScreen, entities, screens.length));
    } else if (type === 'crud' || type === 'table' || type === 'list') {
      const crud = normalizeCrud(rawScreen, entities, usedScreenKeys, screens.length);
      if (crud) screens.push(crud);
    }
  }

  if (!dashboardSeen) screens.unshift(normalizeDashboard({}, entities, 0));
  for (const entity of entities) {
    if (!screens.some((screen) => screen.type === 'crud' && screen.entity === entity.key)) {
      screens.push({
        type: 'crud',
        key: uniqueKey(entity.key, usedScreenKeys),
        title: entity.namePlural,
        subtitle: '',
        icon: entity.icon,
        entity: entity.key
      });
    }
  }
  if (!screens.length) {
    screens.push(...buildDefaultScreens(entities).screens);
  }
  // Dashboard always leads so it can serve as the app home screen.
  screens.sort((a, b) => (a.type === 'dashboard' ? -1 : 0) - (b.type === 'dashboard' ? -1 : 0));

  let accent = pickString(root.theme?.accent ?? root.accent ?? appRaw.accent, DEFAULT_ACCENT, 9);
  if (!/^#[0-9a-f]{6}$/i.test(accent)) accent = DEFAULT_ACCENT;

  const seed = normalizeSeed(root.seed ?? root.data ?? {}, entities);
  const tagline = pickString(appRaw.tagline ?? appRaw.description ?? root.tagline, '', 90) ||
    `Application ${appName} générée avec AppMaker`;

  return {
    app: {
      name: appName,
      tagline,
      accent: accent.toUpperCase(),
      icon: normalizeIcon(appRaw.icon, entities[0]?.icon || 'layers')
    },
    entities,
    screens,
    seed
  };
}

export function createAppId(name) {
  const base = asciiSlug(name).split('-').slice(0, 3).join('-') || 'app';
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${base.slice(0, 30)}-${suffix}`;
}

export const DEFAULT_SPEC_RAW = {
  app: {
    name: 'StockFlow',
    tagline: 'Pilotez votre stock, vos fournisseurs et vos mouvements',
    icon: 'boxes'
  },
  theme: { accent: '#4F6BED' },
  entities: [
    {
      key: 'produit',
      name: 'Produit',
      namePlural: 'Produits',
      icon: 'package',
      labelField: 'nom',
      fields: [
        { key: 'nom', label: 'Nom du produit', type: 'text', required: true, inTable: true, searchable: true },
        { key: 'sku', label: 'Référence', type: 'text', required: true, inTable: true, searchable: true },
        { key: 'categorie', label: 'Catégorie', type: 'select', options: ['Informatique', 'Bureautique', 'Mobilier', 'Câblage'], inTable: true },
        { key: 'fournisseur', label: 'Fournisseur', type: 'relation', target: 'fournisseur', inTable: true },
        { key: 'quantite', label: 'Quantité en stock', type: 'number', min: 0, inTable: true },
        { key: 'seuilAlerte', label: 'Seuil d’alerte', type: 'number', min: 0, inTable: false },
        { key: 'prix', label: 'Prix unitaire', type: 'currency', inTable: true },
        { key: 'dateEntree', label: 'Dernière entrée', type: 'date', inTable: false },
        { key: 'actif', label: 'Actif', type: 'boolean', inTable: false }
      ]
    },
    {
      key: 'fournisseur',
      name: 'Fournisseur',
      namePlural: 'Fournisseurs',
      icon: 'truck',
      labelField: 'nom',
      fields: [
        { key: 'nom', label: 'Nom', type: 'text', required: true, inTable: true, searchable: true },
        { key: 'contact', label: 'Contact', type: 'text', inTable: true, searchable: true },
        { key: 'email', label: 'Email', type: 'text', inTable: true },
        { key: 'telephone', label: 'Téléphone', type: 'text', inTable: true },
        { key: 'ville', label: 'Ville', type: 'text', inTable: true },
        { key: 'actif', label: 'Actif', type: 'boolean', inTable: true }
      ]
    },
    {
      key: 'mouvement',
      name: 'Mouvement',
      namePlural: 'Mouvements',
      icon: 'activity',
      labelField: 'reference',
      fields: [
        { key: 'reference', label: 'Référence', type: 'text', required: true, inTable: true },
        { key: 'produit', label: 'Produit', type: 'relation', target: 'produit', inTable: true },
        { key: 'type', label: 'Type', type: 'select', options: ['Entrée', 'Sortie', 'Ajustement'], inTable: true },
        { key: 'quantite', label: 'Quantité', type: 'number', min: 1, inTable: true },
        { key: 'date', label: 'Date', type: 'date', inTable: true },
        { key: 'note', label: 'Note', type: 'textarea', inTable: false }
      ]
    }
  ],
  screens: [
    {
      type: 'dashboard',
      title: 'Tableau de bord',
      kpis: [
        { label: 'Produits référencés', entity: 'produit', aggregation: 'count', icon: 'package', tone: 'accent' },
        { label: 'Valeur du stock', entity: 'produit', aggregation: 'sum', field: 'prix', multiplyBy: 'quantite', format: 'currency', icon: 'euro', tone: 'success' },
        { label: 'Fournisseurs actifs', entity: 'fournisseur', aggregation: 'count', filter: { field: 'actif', op: 'eq', value: true }, icon: 'truck', tone: 'warning' },
        { label: 'Mouvements enregistrés', entity: 'mouvement', aggregation: 'count', icon: 'activity', tone: 'neutral' }
      ],
      breakdown: { entity: 'produit', field: 'categorie', title: 'Répartition des produits' },
      recent: { entity: 'mouvement', limit: 6, title: 'Derniers mouvements' }
    },
    { type: 'crud', entity: 'produit', title: 'Produits', subtitle: 'Catalogue et niveaux de stock' },
    { type: 'crud', entity: 'fournisseur', title: 'Fournisseurs', subtitle: 'Partenaires et contacts' },
    { type: 'crud', entity: 'mouvement', title: 'Mouvements', subtitle: 'Entrées, sorties et ajustements' }
  ],
  seed: {
    produit: [
      { nom: 'Clavier mécanique K2', sku: 'ACC-1024', categorie: 'Informatique', fournisseur: 'TechDistrib', quantite: 42, seuilAlerte: 10, prix: 89.9, dateEntree: '2026-10-12', actif: true },
      { nom: 'Écran 27" QHD', sku: 'ECR-2710', categorie: 'Informatique', fournisseur: 'TechDistrib', quantite: 7, seuilAlerte: 8, prix: 329, dateEntree: '2026-11-02', actif: true },
      { nom: 'Chaise ergonomique Ergo+', sku: 'MOB-3301', categorie: 'Mobilier', fournisseur: 'BureauConfort', quantite: 12, seuilAlerte: 5, prix: 249, dateEntree: '2026-09-28', actif: true },
      { nom: 'Ramette A4 500 feuilles', sku: 'BUR-0081', categorie: 'Bureautique', fournisseur: 'PapeteriePlus', quantite: 120, seuilAlerte: 30, prix: 4.5, dateEntree: '2026-10-30', actif: true },
      { nom: 'Câble USB-C 2 m', sku: 'CAB-2003', categorie: 'Câblage', fournisseur: 'TechDistrib', quantite: 4, seuilAlerte: 15, prix: 12.9, dateEntree: '2026-11-05', actif: true },
      { nom: 'Souris sans fil MX', sku: 'ACC-1088', categorie: 'Informatique', fournisseur: 'TechDistrib', quantite: 28, seuilAlerte: 10, prix: 59.9, dateEntree: '2026-10-21', actif: true },
      { nom: 'Bureau assis-debout', sku: 'MOB-4410', categorie: 'Mobilier', fournisseur: 'BureauConfort', quantite: 9, seuilAlerte: 4, prix: 399, dateEntree: '2026-10-08', actif: true },
      { nom: 'Multiprise parafoudre', sku: 'CAB-3150', categorie: 'Câblage', fournisseur: 'PapeteriePlus', quantite: 16, seuilAlerte: 8, prix: 24.5, dateEntree: '2026-09-19', actif: true },
      { nom: 'Bloc-notes A5 ligné', sku: 'BUR-0122', categorie: 'Bureautique', fournisseur: 'PapeteriePlus', quantite: 64, seuilAlerte: 20, prix: 3.2, dateEntree: '2026-11-09', actif: true },
      { nom: 'Support écran articulé', sku: 'ACC-2050', categorie: 'Informatique', fournisseur: 'TechDistrib', quantite: 3, seuilAlerte: 6, prix: 79, dateEntree: '2026-10-26', actif: false }
    ],
    fournisseur: [
      { nom: 'TechDistrib', contact: 'Claire Martin', email: 'claire@techdistrib.fr', telephone: '01 44 55 66 77', ville: 'Paris', actif: true },
      { nom: 'BureauConfort', contact: 'Hugo Bernard', email: 'hugo@bureauconfort.fr', telephone: '04 78 12 34 56', ville: 'Lyon', actif: true },
      { nom: 'PapeteriePlus', contact: 'Sofia Benali', email: 'sofia@papeterieplus.fr', telephone: '05 61 22 33 44', ville: 'Toulouse', actif: true },
      { nom: 'Nordic Office', contact: 'Lars Jensen', email: 'lars@nordicoffice.dk', telephone: '+45 33 12 45 67', ville: 'Copenhague', actif: false }
    ],
    mouvement: [
      { reference: 'MVT-2026-041', produit: 'Clavier mécanique K2', type: 'Entrée', quantite: 20, date: '2026-11-10', note: 'Réapprovisionnement mensuel' },
      { reference: 'MVT-2026-040', produit: 'Câble USB-C 2 m', type: 'Sortie', quantite: 8, date: '2026-11-09', note: 'Commande atelier' },
      { reference: 'MVT-2026-039', produit: 'Écran 27" QHD', type: 'Sortie', quantite: 5, date: '2026-11-08', note: 'Équipement de deux postes' },
      { reference: 'MVT-2026-038', produit: 'Ramette A4 500 feuilles', type: 'Entrée', quantite: 80, date: '2026-11-07', note: '' },
      { reference: 'MVT-2026-037', produit: 'Chaise ergonomique Ergo+', type: 'Ajustement', quantite: 2, date: '2026-11-06', note: 'Retour fournisseur' },
      { reference: 'MVT-2026-036', produit: 'Souris sans fil MX', type: 'Sortie', quantite: 6, date: '2026-11-04', note: 'Nouveaux collaborateurs' }
    ]
  }
};

export function getDemoSpec() {
  return normalizeSpec(DEFAULT_SPEC_RAW, { prompt: 'Application de gestion de stock' });
}
