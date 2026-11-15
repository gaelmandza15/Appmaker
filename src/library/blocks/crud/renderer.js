function renderCrud(screen) {
  const entity = entityByKey(screen.entity);
  if (!entity) {
    return `<div class="page"><div class="panel"><div class="panel-empty">${icon('alert', 22)}<p>Entité introuvable pour cet écran.</p></div></div></div>`;
  }

  const total = (state.counts[entity.key] || 0);
  const rows = filteredRows(screen);
  const columns = entity.fields.filter((field) => field.inTable).slice(0, 6);
  const filterField = firstFilterField(entity);
  const query = state.search[screen.key] || '';
  const activeFilter = state.filters[screen.key];
  const hasFilters = Boolean(query || activeFilter?.value);
  const sort = state.sort[screen.key];
  const filterOptions = filterField
    ? (filterField.type === 'boolean' ? ['true', 'false'] : (filterField.options || []))
    : [];

  const headerCells = columns.map((field) => {
    const direction = sort?.field === field.key ? sort.dir : null;
    const numeric = ['number', 'currency'].includes(field.type);
    return `<th class="${numeric ? 'is-num' : ''}">
      <button class="th-sort${direction ? ' is-sorted' : ''}${numeric ? ' is-num' : ''}" type="button" data-action="sort" data-screen="${screen.key}" data-field="${field.key}">
        <span>${escapeHtml(field.label)}</span>
        <span class="sort-glyph">${icon(direction === 'asc' ? 'arrow-up' : direction === 'desc' ? 'arrow-down' : 'arrow-up-down', 12)}</span>
      </button>
    </th>`;
  }).join('');

  const extensionActions = APP.extensions ? APP.extensions.rowActions(entity.key) : [];
  const bodyRows = rows.map((row) => {
    const label = recordLabel(entity, row);
    const cells = columns.map((field, index) => {
      const numeric = ['number', 'currency'].includes(field.type);
      return `<td class="${numeric ? 'is-num' : ''}${index === 0 ? ' is-primary' : ''}">${renderCrudCell(field, row)}</td>`;
    }).join('');
    const extensionButtons = extensionActions.map((action) => `<button class="row-action is-extension" type="button" data-ext-action="${escapeHtml(action.id)}" data-entity="${entity.key}" data-id="${row.id}" title="${escapeHtml(action.label || action.extensionName)}" aria-label="${escapeHtml(action.label || action.extensionName)}">${icon(action.icon || 'sparkles', 15)}</button>`).join('');
    return `<tr>
      ${cells}
      <td class="cell-actions">
        ${extensionButtons}
        <button class="row-action" type="button" data-action="edit" data-entity="${entity.key}" data-id="${row.id}" aria-label="Modifier ${escapeHtml(label)}">${icon('edit', 15)}</button>
        <button class="row-action is-danger" type="button" data-action="delete" data-entity="${entity.key}" data-id="${row.id}" aria-label="Supprimer ${escapeHtml(label)}">${icon('trash', 15)}</button>
      </td>
    </tr>`;
  }).join('');

  const emptyState = `<tr class="empty-row">
    <td colspan="${columns.length + 1}">
      <div class="empty-state">
        <div class="empty-icon">${icon(entity.icon, 23)}</div>
        <h3>${hasFilters ? 'Aucun résultat' : 'Rien à afficher pour l’instant'}</h3>
        <p>${hasFilters ? 'Aucun enregistrement ne correspond à vos critères.' : 'Ajoutez un premier enregistrement pour démarrer.'}</p>
        ${hasFilters
          ? `<button class="btn btn-ghost btn-sm" type="button" data-action="clear-filters" data-screen="${screen.key}">${icon('x', 14)}Réinitialiser les filtres</button>`
          : `<button class="btn btn-primary btn-sm" type="button" data-action="add" data-entity="${entity.key}">${icon('plus', 14)}Ajouter</button>`}
      </div>
    </td>
  </tr>`;

  return `<div class="page">
    <div class="page-head">
      <div>
        <div class="page-title">
          <h1>${escapeHtml(screen.title)}</h1>
          <span class="count-chip">${formatNumber(total)}</span>
        </div>
        <p class="page-sub">${escapeHtml(screen.subtitle || 'Consultez, ajoutez et modifiez vos données.')}</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" type="button" data-action="add" data-entity="${entity.key}" aria-label="Ajouter un enregistrement à ${escapeHtml(screen.title)}">
          ${icon('plus', 16)}Nouveau
        </button>
      </div>
    </div>

    <div class="crud-toolbar">
      <div class="search-field">
        ${icon('search', 16)}
        <input type="text" data-search="${screen.key}" value="${escapeHtml(query)}" placeholder="Rechercher…" aria-label="Rechercher dans ${escapeHtml(screen.title)}">
      </div>
      ${filterField ? `<div class="filter-field">
        ${icon('filter', 14)}
        <select data-filter="${screen.key}" data-field="${filterField.key}" aria-label="Filtrer par ${escapeHtml(filterField.label.toLowerCase())}">
          <option value="">Filtrer par ${escapeHtml(filterField.label.toLowerCase())}</option>
          ${filterOptions.map((option) => {
            const label = filterField.type === 'boolean'
              ? (option === 'true' ? 'Oui' : 'Non')
              : option;
            const selected = activeFilter?.field === filterField.key && String(activeFilter.value) === String(option);
            return `<option value="${escapeHtml(option)}"${selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
          }).join('')}
        </select>
      </div>` : ''}
      ${hasFilters ? `<button class="btn btn-ghost btn-sm" type="button" data-action="clear-filters" data-screen="${screen.key}">${icon('x', 13)}Réinitialiser</button>` : ''}
    </div>

    <div class="table-card">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              ${headerCells}
              <th class="th-actions"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>${rows.length ? bodyRows : emptyState}</tbody>
        </table>
      </div>
      <div class="table-foot">
        <span>${formatNumber(rows.length)} ${rows.length > 1 ? 'enregistrements' : 'enregistrement'}${hasFilters ? ` sur ${formatNumber(total)}` : ''}</span>
        <span class="table-foot-storage">${icon('database', 12)}${APP.desktop ? 'Base SQLite locale' : 'Stockage local'}</span>
      </div>
    </div>
  </div>`;
}

function renderCrudCell(field, row) {
  const value = row[field.key];
  if (value === null || value === undefined || value === '') return '<span class="cell-empty">—</span>';

  switch (field.type) {
    case 'select': {
      const index = Math.max(0, (field.options || []).indexOf(String(value)));
      return `<span class="badge badge-tone-${(index % 6) + 1}">${escapeHtml(String(value))}</span>`;
    }
    case 'boolean':
      return value
        ? `<span class="badge badge-success"><span class="badge-dot"></span>Oui</span>`
        : `<span class="badge badge-muted"><span class="badge-dot"></span>Non</span>`;
    case 'relation': {
      const target = entityByKey(field.target);
      return `<span class="relation-cell">${icon(target?.icon || 'layers', 13)}<span>${escapeHtml(relationLabel(field, value))}</span></span>`;
    }
    case 'currency':
      return `<span class="cell-number">${formatMoney(value)}</span>`;
    case 'number':
      return `<span class="cell-number">${formatNumber(value)}</span>`;
    case 'date':
      return `<span class="cell-date">${formatDate(value)}</span>`;
    default:
      return `<span class="cell-text" title="${escapeHtml(String(value))}">${escapeHtml(String(value))}</span>`;
  }
}
