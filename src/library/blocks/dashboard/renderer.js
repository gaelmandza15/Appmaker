function renderDashboard(screen) {
  const kpis = (screen.kpis || []).map((kpi) => {
    const value = computeKpi(kpi);
    const entity = entityByKey(kpi.entity);
    return `<article class="kpi-card tone-${escapeHtml(kpi.tone || 'accent')}">
      <div class="kpi-top">
        <span class="kpi-icon">${icon(kpi.icon, 19)}</span>
        <span class="kpi-entity">${escapeHtml(entity?.namePlural || '')}</span>
      </div>
      <div class="kpi-value">${formatKpiValue(value, kpi.format)}</div>
      <div class="kpi-label">${escapeHtml(kpi.label)}</div>
      <div class="kpi-caption">${escapeHtml(kpiCaption(kpi))}</div>
    </article>`;
  }).join('');

  const emptyKpis = `<article class="kpi-card tone-neutral"><div class="kpi-top"><span class="kpi-icon">${icon('chart', 19)}</span></div><div class="kpi-value">—</div><div class="kpi-label">Aucun indicateur configuré</div><div class="kpi-caption">Ajoutez des données pour démarrer</div></article>`;
  const today = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  const extensionWidgets = (APP.extensions ? APP.extensions.dashboardWidgets(screen.key) : [])
    .map((widget) => {
      try {
        const result = typeof widget.render === 'function'
          ? widget.render({ app: APP, screen, rows: screen.entity ? rows(screen.entity) : [], rowsFor: rows, formatNumber, formatMoney, formatPercent })
          : widget;
        if (!result) return '';
        const tone = ['accent', 'mint', 'amber', 'violet'].includes(result.tone) ? result.tone : 'neutral';
        return `<article class="kpi-card is-extension tone-${tone}">
          <div class="kpi-top">
            <span class="kpi-icon">${icon(result.icon || 'sparkles', 19)}</span>
            <span class="kpi-entity">${escapeHtml(widget.extensionName || '')}</span>
          </div>
          <div class="kpi-value">${escapeHtml(result.value ?? '—')}</div>
          <div class="kpi-label">${escapeHtml(result.label || widget.label || '')}</div>
          <div class="kpi-caption">${escapeHtml(result.hint || '')}</div>
        </article>`;
      } catch (error) {
        console.error('Widget d’extension :', error);
        return '';
      }
    })
    .join('');

  return `<div class="page">
    <div class="page-head">
      <div>
        <div class="page-title"><h1>${escapeHtml(screen.title)}</h1></div>
        <p class="page-sub">${escapeHtml(APP.app.tagline)}</p>
      </div>
      <div class="page-actions">
        <span class="date-chip">${icon('calendar', 14)}${escapeHtml(today.charAt(0).toUpperCase() + today.slice(1))}</span>
      </div>
    </div>
    <section class="kpi-grid" aria-label="Indicateurs clés">${kpis || emptyKpis}${extensionWidgets}</section>
    <div class="dash-grid">
      ${renderBreakdownPanel(screen.breakdown)}
      ${renderRecentPanel(screen.recent)}
    </div>
  </div>`;
}

function renderBreakdownPanel(config) {
  if (!config) return '';
  const entity = entityByKey(config.entity);
  const field = entity ? fieldByKey(entity, config.field) : null;
  if (!entity || !field) return '';

  const counts = new Map();
  for (const item of rows(entity.key)) {
    const raw = item[field.key];
    let label;
    if (raw === null || raw === undefined || raw === '') label = 'Non renseigné';
    else if (field.type === 'boolean') label = (raw === 1 || raw === true || raw === '1') ? 'Oui' : 'Non';
    else label = String(raw);
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'));
  const displayed = sorted.slice(0, 5);
  const others = sorted.slice(5);
  if (others.length) {
    displayed.push(['Autres', others.reduce((total, entry) => total + entry[1], 0)]);
  }
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const screen = screenForEntity(entity.key);

  const breakdownRows = displayed.map(([label, count], index) => {
    const percent = total ? Math.round((count / total) * 100) : 0;
    return `<div class="breakdown-row">
      <div class="breakdown-meta">
        <span class="breakdown-name"><span class="chart-dot c-${index % 6}"></span>${escapeHtml(label)}</span>
        <span class="breakdown-count">${formatNumber(count)}<span class="breakdown-pct">${percent}%</span></span>
      </div>
      <div class="breakdown-track"><span class="breakdown-fill c-${index % 6}" style="width:${Math.max(percent, 3)}%"></span></div>
    </div>`;
  }).join('');

  return `<section class="panel breakdown-panel">
    <div class="panel-head">
      <div>
        <h2>${escapeHtml(config.title || 'Répartition')}</h2>
        <p>${escapeHtml(entity.namePlural)} · ${escapeHtml(field.label.toLowerCase())}</p>
      </div>
      <a class="panel-link" href="#/${encodeURIComponent(screen.key)}">Voir la liste ${icon('arrow-up-right', 12)}</a>
    </div>
    <div class="breakdown-body">
      ${breakdownRows || `<div class="panel-empty">${icon('chart', 22)}<p>Ajoutez des enregistrements pour voir la répartition.</p></div>`}
      ${breakdownRows ? `<div class="breakdown-foot"><span>${formatNumber(total)} ${escapeHtml(entity.namePlural.toLowerCase())} au total</span><span>Répartition actuelle</span></div>` : ''}
    </div>
  </section>`;
}

function renderRecentPanel(config) {
  if (!config) return '';
  const entity = entityByKey(config.entity);
  if (!entity) return '';
  const dateField = entity.fields.find((field) => field.type === 'date');
  const timeOf = (row) => {
    if (dateField) {
      const time = new Date(row[dateField.key]).getTime();
      if (Number.isFinite(time)) return time;
    }
    const fallback = new Date(row.updatedAt || 0).getTime();
    return Number.isFinite(fallback) ? fallback : 0;
  };
  const recentList = rows(entity.key).sort((a, b) => timeOf(b) - timeOf(a)).slice(0, config.limit || 6);
  const secondary = entity.fields.find((field) => field.key !== entity.labelField && ['select', 'currency', 'number', 'text'].includes(field.type));
  const screen = screenForEntity(entity.key);

  const items = recentList.map((row) => {
    const label = recordLabel(entity, row);
    const meta = secondary ? formatFieldValue(secondary, row[secondary.key]) : '';
    const time = dateField ? row[dateField.key] : row.updatedAt;
    return `<a class="recent-item" href="#/${encodeURIComponent(screen.key)}">
      <span class="recent-icon">${icon(entity.icon, 16)}</span>
      <span class="recent-copy">
        <strong>${escapeHtml(label)}</strong>
        ${meta && meta !== '—' ? `<small>${escapeHtml(meta)}</small>` : ''}
      </span>
      <span class="recent-time">${escapeHtml(formatRelative(time))}</span>
      ${icon('chevron-right', 14)}
    </a>`;
  }).join('');

  return `<section class="panel recent-panel">
    <div class="panel-head">
      <div>
        <h2>${escapeHtml(config.title || 'Activité récente')}</h2>
        <p>Dernières entrées de ${escapeHtml(entity.namePlural.toLowerCase())}</p>
      </div>
      <a class="panel-link" href="#/${encodeURIComponent(screen.key)}">Tout voir ${icon('arrow-up-right', 12)}</a>
    </div>
    <div class="recent-list">
      ${items || `<div class="panel-empty">${icon('clock', 22)}<p>Aucune activité enregistrée pour l’instant.</p></div>`}
    </div>
  </section>`;
}
