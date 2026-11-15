/**
 * Registre d’extensions de l’application.
 *
 * Une extension est un module ES qui exporte par défaut :
 *   { id, name, hooks: { rowActions, dashboardWidgets } }
 *
 * Le socle ne contient aucune logique métier propre aux extensions : il expose
 * uniquement les points d’accroche ci-dessous, ce qui permet de faire évoluer
 * l’application sans régénérer ni réécrire le reste du code.
 */

const HOOKS = ['rowActions', 'dashboardWidgets', 'screens'];

function normalizeExtension(raw) {
  const extension = raw && raw.default ? raw.default : raw;
  if (!extension || typeof extension !== 'object' || !extension.id) return null;
  return extension;
}

export function createRegistry(modules) {
  const extensions = (modules || []).map(normalizeExtension).filter(Boolean);

  function collect(hook, ...args) {
    const items = [];
    for (const extension of extensions) {
      const value = extension.hooks?.[hook];
      if (!value) continue;
      try {
        const list = typeof value === 'function' ? value(...args) : value;
        for (const [index, item] of (Array.isArray(list) ? list : [list]).entries()) {
          if (!item) continue;
          items.push({
            id: item.id || `${extension.id}:${hook}:${index}`,
            extensionId: extension.id,
            extensionName: extension.name || extension.id,
            ...item
          });
        }
      } catch (error) {
        console.error(`Extension « ${extension.id} » (${hook}) :`, error);
      }
    }
    return items;
  }

  function matching(hook, filterKey, value) {
    return collect(hook, value).filter((item) => !item[filterKey] || item[filterKey] === value);
  }

  return {
    extensions,
    hooks: HOOKS,
    /** Actions ajoutées sur chaque ligne d’une entité CRUD. */
    rowActions(entityKey) {
      return matching('rowActions', 'entity', entityKey);
    },
    /** Cartes indicateurs ajoutées à un écran tableau de bord. */
    dashboardWidgets(screenKey) {
      return matching('dashboardWidgets', 'screen', screenKey);
    },
    /** Écrans complets ajoutés à la navigation. */
    screens() {
      return collect('screens').filter((screen) => screen.id && screen.title);
    },
    findScreen(id) {
      return collect('screens').find((screen) => screen.id === id) || null;
    },
    findRowAction(id) {
      return collect('rowActions').find((action) => action.id === id) || null;
    }
  };
}

/** Déclenche un téléchargement de texte sans dépendance ni serveur. */
export function downloadText(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Sérialise des lignes en CSV (séparateur point-virgule, BOM UTF-8). */
export function toCsv(rows, columns) {
  const escapeCell = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[";\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const header = columns.map((column) => escapeCell(column.label || column.key)).join(';');
  const body = (rows || []).map((row) => columns
    .map((column) => escapeCell(typeof column.value === 'function' ? column.value(row) : row[column.key]))
    .join(';'))
    .join('\r\n');
  return `\uFEFF${header}\r\n${body}\r\n`;
}
