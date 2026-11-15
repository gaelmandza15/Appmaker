import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { config } from './config.js';

/**
 * Agent AppMaker.
 *
 * L’agent ne réécrit pas le socle : il inspecte le projet, ajoute des modules
 * d’extension, synchronise le projet, vérifie que tout démarre, puis peut lancer
 * l’empaquetage Windows. Chaque outil est borné et journalisé.
 */

const MAX_STEPS = 30;
const MAX_FILE_BYTES = 60 * 1024;
const EXTENSION_PATH = /^extensions\/[a-z0-9][a-z0-9-]*\/[A-Za-z0-9._-]+\.(js|json|css)$/;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'Liste les fichiers du projet (chemins relatifs).',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Lit un fichier du projet (chemin relatif, 200 Ko max).',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Chemin relatif, ex. extensions/mon-export/index.js' } },
        required: ['path'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Crée ou remplace un fichier sous extensions/. Synchronise immédiatement l’aperçu.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Chemin sous extensions/, ex. extensions/csv-produits/index.js' },
          content: { type: 'string', description: 'Contenu complet du fichier.' }
        },
        required: ['path', 'content'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_file',
      description: 'Supprime un fichier sous extensions/.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_field',
      description: 'Ajoute un champ à une entité par migration additive (ALTER TABLE). À utiliser pour toute nouvelle donnée ; les bases existantes sont migrées au prochain lancement.',
      parameters: {
        type: 'object',
        properties: {
          entity: { type: 'string', description: 'Clé de l’entité, ex. produit' },
          key: { type: 'string', description: 'Clé technique du champ (minuscules, camelCase), ex. notes' },
          label: { type: 'string', description: 'Libellé affiché, ex. Notes internes' },
          type: { type: 'string', enum: ['text', 'textarea', 'number', 'currency', 'date', 'boolean', 'select', 'relation'] },
          options: { type: 'array', items: { type: 'string' }, description: 'Options pour un champ select.' },
          target: { type: 'string', description: 'Entité cible pour un champ relation.' },
          required: { type: 'boolean', description: 'Champ obligatoire dans les formulaires.' }
        },
        required: ['entity', 'key', 'label', 'type'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_app',
      description: 'Vérifie le projet : syntaxe JS, chargement des extensions, accès HTTP aux ressources de l’aperçu.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'verify_ui',
      description: 'Ouvre l’aperçu dans un vrai navigateur et exécute une action : inspecter, naviguer, cliquer, remplir un champ, recharger, capturer. Retourne la page (titres, navigation, boutons, champs, lignes, texte) et les erreurs console. Utilisez-le pour PROUVER qu’une fonctionnalité fonctionne.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['inspect', 'goto', 'click', 'fill', 'reload', 'screenshot'] },
          hash: { type: 'string', description: 'Pour goto : route, ex. #/alertes-stock' },
          text: { type: 'string', description: 'Pour click : libellé visible ou aria-label du bouton/lien' },
          field: { type: 'string', description: 'Pour fill : nom, id ou libellé du champ' },
          value: { type: 'string', description: 'Pour fill : valeur à saisir' }
        },
        required: ['action'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'build_windows',
      description: 'Lance l’empaquetage Windows (installateur NSIS + version portable).',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'finish',
      description: 'Termine la mission avec un résumé court en français.',
      parameters: {
        type: 'object',
        properties: { summary: { type: 'string', description: 'Résumé de ce qui a été ajouté et vérifié.' } },
        required: ['summary'],
        additionalProperties: false
      }
    }
  }
];

class AgentError extends Error {
  constructor(message, { status = 502, code = 'AGENT_ERROR' } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function clamp(text, max = 6000) {
  const value = typeof text === 'string' ? text : JSON.stringify(text);
  return value.length > max ? `${value.slice(0, max)}\n…(${value.length - max} caractères tronqués)` : value;
}

async function walkFiles(dir, prefix = '', limit = 250) {
  const found = [];
  if (found.length >= limit) return found;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (found.length >= limit) break;
    if (entry.name === 'node_modules') continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (relative === 'src-tauri/target') continue;
      found.push(...await walkFiles(full, relative, limit - found.length));
    } else {
      found.push(relative);
    }
  }
  return found;
}

function safeRelative(projectDir, relative) {
  const normalized = String(relative || '').replaceAll('\\', '/').replace(/^\/+/, '');
  const full = path.resolve(projectDir, normalized);
  if (!full.startsWith(path.resolve(projectDir) + path.sep)) throw new AgentError('Chemin hors du projet.', { status: 400 });
  return { normalized, full };
}

function describeSpec(spec) {
  const lines = [];
  for (const entity of spec.entities) {
    const fields = entity.fields.map((field) => {
      const extra = field.type === 'relation' ? ` → ${field.target}` : field.options?.length ? ` [${field.options.join(', ')}]` : '';
      return `${field.key}:${field.type}${extra}`;
    }).join(', ');
    lines.push(`- entité « ${entity.key} » (${entity.namePlural || entity.name}) : ${fields}`);
  }
  for (const screen of spec.screens) {
    lines.push(`- écran « ${screen.key} » (${screen.type})${screen.entity ? ` sur ${screen.entity}` : ''} : ${screen.title}`);
  }
  return lines.join('\n');
}

function systemPrompt({ spec, manifest, extensions, extensionSources }) {
  const existing = extensionSources.length
    ? extensionSources.map(({ path, content }) => `--- ${path} ---\n${content.slice(0, 4000)}`).join('\n\n')
    : 'aucune extension pour l’instant';
  return `Tu es l'agent AppMaker. Tu fais évoluer une application métier existante en ajoutant des extensions, jamais en réécrivant le socle.

APPLICATION : ${spec.app.name} — ${spec.app.tagline}
PROJET : data/apps/${manifest.id}/
MODÈLE DE DONNÉES :
${describeSpec(spec)}
EXTENSIONS EXISTANTES : ${extensions.length ? extensions.join(', ') : 'aucune'}

CONTRAT D'EXTENSION (respecte-le strictement)
Un module ES sous extensions/<id>/index.js exporte par défaut :
export default {
  id: 'mon-extension',
  name: 'Nom lisible',
  hooks: {
    rowActions: [{ id: 'csv-produits', entity: 'produit', label: 'CSV', icon: 'download', run(ctx) { /* ... */ } }],
    dashboardWidgets: [{ id: 'stock-total', screen: 'dashboard', label: 'Stock total', render(ctx) { return { value: '12', label: 'Unités', hint: 'Toutes catégories', icon: 'layers', tone: 'mint' }; } }],
    screens: [{ id: 'alertes', title: 'Alertes', icon: 'alert', entity: 'produit', render(ctx) { return '<div class="page"><div class="page-head"><div class="page-title"><h1>Alertes</h1></div></div><div class="panel">…</div></div>'; } }]
  }
}

CONTEXTE FOURNI À run(ctx) :
ctx.row (l'enregistrement courant), ctx.rows (toutes les lignes de l'entité), ctx.entity, ctx.screen, ctx.app (spec complète), ctx.store avec ctx.store.insert(entityKey, valeurs), ctx.store.update(entityKey, id, valeurs), ctx.store.remove(entityKey, id). Il n'existe PAS de create/delete/save/add. ctx.reload() rafraîchit l'interface après une écriture,
ctx.download(nomFichier, contenu, mime), ctx.toCsv(lignes, [{ key, label }]), ctx.ui.toast(message, 'success'|'error'),
ctx.ui.formatNumber, ctx.ui.formatMoney, ctx.ui.formatDate, ctx.ui.escapeHtml. formatPercent attend un pourcentage (42.5 → « 42,5 % »), pas une fraction.

CONTEXTE FOURNI À render(ctx) des widgets : ctx.app, ctx.screen, ctx.rows (lignes de l'écran, ou []), ctx.rowsFor(entityKey), ctx.formatNumber, ctx.formatMoney, ctx.formatPercent (pourcentage : 42.5 → « 42,5 % »).
Retourne { value, label, hint, icon, tone } avec tone parmi accent, mint, amber, violet, neutral.

ÉCRANS INTERACTIFS (important : tu peux écrire du vrai code)
Un écran est un objet { id, title, icon, entity?, render(ctx), mount(root, ctx)?, on(eventName, element, ctx, event)? }.
- render(ctx) retourne une chaîne HTML. Classes disponibles : page, page-head, page-title, page-sub, page-actions, panel, panel-head, table-card, table-scroll, kpi-grid, kpi-card, badge, chip, btn btn-primary, btn btn-ghost, input, select, empty-state, grid-2.
- Les boutons et champs interactifs portent data-ext-event="nom-événement". Au clic / submit / change, le runtime appelle on(nom, élément, ctx, événement) puis ctx.refresh() pour redessiner.
- L'état vit dans une variable de module (let filtre = '';). on() la met à jour, puis ctx.refresh().
- mount(root, ctx) est appelé à chaque rendu : utilise-le pour des écouteurs fins (input, keydown) ou pour initialiser des composants.
- Ne jamais intercepter data-action (réservé au socle). Ne pas attacher d'écouteur global sans condition.

CONTEXTE FOURNI À render/mount/on : ctx.app, ctx.screen, ctx.rows (lignes de l'entité), ctx.rowsFor(entityKey), ctx.store (insert/update/remove), ctx.reload(), ctx.refresh(), ctx.icon(nom, taille), ctx.escapeHtml, ctx.formatNumber, ctx.formatMoney, ctx.formatPercent, ctx.formatDate, ctx.formatRelative, ctx.toast(message, type), ctx.confirm(message).
Échappe toujours les données utilisateur avec ctx.escapeHtml. Pas de dépendance externe, pas de fetch.

SCHÉMA DE DONNÉES
Pour ajouter un champ, utilise add_field (migration additive ALTER TABLE). N'édite jamais src-tauri/migrations ni data/spec.json à la main. Les lignes existantes auront NULL pour le nouveau champ ; ne l'exige pas dans les actions.
Pour créer un écran qui liste des données existantes, utilise le hook screens : pas besoin de nouvelle table.

EXTENSIONS EXISTANTES (source complète, ne les relis pas) :
${existing}

EXEMPLE D'ÉCRAN INTERACTIF (filtre par catégorie, à adapter) :
let filtre = '';
export default {
  id: 'catalogue', name: 'Catalogue',
  hooks: { screens: [{
    id: 'catalogue', title: 'Catalogue', icon: 'list', entity: 'produit',
    render(ctx) {
      const lignes = ctx.rowsFor('produit').filter((r) => !filtre || r.categorie === filtre);
      const boutons = ['Informatique', 'Mobilier'].map((c) => '<button class="btn btn-ghost" data-ext-event="filtre" data-valeur="' + c + '">' + c + '</button>').join('');
      const rangs = lignes.map((r) => '<tr><td>' + ctx.escapeHtml(r.nom) + '</td><td>' + ctx.escapeHtml(r.categorie || '') + '</td></tr>').join('');
      return '<div class="page"><div class="page-head"><div><div class="page-title"><h1>Catalogue</h1></div>'
        + '<p class="page-sub">' + lignes.length + ' produit(s)</p></div></div>'
        + '<div class="panel"><button class="btn btn-ghost" data-ext-event="reset">Tout afficher</button>' + boutons
        + '<table class="table-card"><tbody>' + rangs + '</tbody></table></div></div>';
    },
    on(name, el, ctx) {
      if (name === 'filtre') filtre = el.dataset.valeur;
      if (name === 'reset') filtre = '';
      ctx.refresh();
    }
  }] }
};

ICÔNES DISPONIBLES
download, activity, chart, layers, package, boxes, users, truck, receipt, calendar, star, tag, cart, building, sparkles, alert, list, check, clock, home, briefcase, phone, mail, settings, database.

RÈGLES
1. N'écris QUE sous extensions/. Le socle, les blocs, le schéma (via add_field) et les migrations sont hors de portée directe.
2. Un module autonome, sans dépendance externe, sans URL distante. Code simple et robuste.
3. Les seuls hooks sont rowActions, dashboardWidgets et screens. N'en invente pas d'autres.
4. Les identifiants d'écran d'extension ne doivent pas entrer en collision avec les écrans du plan.
5. Après chaque modification, appelle check_app. Corrige jusqu'à obtenir ok=true.
6. Termine par finish avec un résumé court en français. Tu peux appeler build_windows si l'utilisateur demande explicitement un installateur.
7. Réponds toujours en français, sans blabla.

MÉTHODE — tu es un développeur, prouve ce que tu fais :
1. Le socle (assets/, src-tauri/) est en lecture seule : n'y touche pas et ne le lis pas, tout le contexte utile est ci-dessus.
2. Implémente : add_field pour une donnée, write_file pour une action, un widget ou un écran. Tu peux écrire du vrai code : état local, événements, calculs, DOM construit en JS.
3. check_app : syntaxe + chargement des modules. OBLIGATOIRE après chaque écriture.
4. verify_ui : ouvre l'aperçu réel dans un navigateur. Inspecte, navigue, clique, remplis, recharges. Vérifie que le résultat attendu apparaît ET qu'aucune erreur console n'apparaît. Une fonctionnalité n'est pas terminée tant que verify_ui ne le prouve pas.
5. Corrige et répète jusqu'à ce que la preuve soit là. Ne prétends jamais qu'un écran ou une action marche sans l'avoir observé.
6. finish en résumant ce qui a été vérifié, pas seulement écrit. build_windows uniquement si l'utilisateur demande un installateur.
Ne lis un fichier existant que si tu dois modifier cette extension précise.`;
}

async function requestAgentChat(messages) {
  if (!config.apiKey) throw new AgentError('Aucune clé DeepSeek configurée.', { status: 503, code: 'NO_KEY' });
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          messages,
          tools: TOOLS,
          tool_choice: 'auto',
          temperature: 0.2,
          max_tokens: 4000
        }),
        signal: AbortSignal.timeout(180000)
      });
      const raw = await response.text();
      if (!response.ok) {
        let detail = '';
        try { detail = JSON.parse(raw)?.error?.message || ''; } catch { /* ignore */ }
        if (response.status === 429 || response.status >= 500) {
          lastError = new AgentError(`DeepSeek est momentanément indisponible (${response.status}).`, { status: 503, code: 'UPSTREAM' });
          await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
          continue;
        }
        if (response.status === 401) throw new AgentError('La clé DeepSeek est invalide ou expirée.', { status: 502, code: 'AUTH_ERROR' });
        throw new AgentError(`Erreur de l’API DeepSeek (${response.status})${detail ? ` : ${detail}` : ''}`);
      }
      const data = JSON.parse(raw);
      const message = data.choices?.[0]?.message;
      if (!message) throw new AgentError('Réponse vide de DeepSeek.', { code: 'EMPTY_RESPONSE' });
      return { message, usage: data.usage || null };
    } catch (error) {
      if (error instanceof AgentError) {
        if (error.code === 'UPSTREAM' && attempt === 0) continue;
        throw error;
      }
      lastError = new AgentError(`Appel DeepSeek impossible : ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }
  throw lastError || new AgentError('Appel DeepSeek impossible.');
}

function runNodeCheck(file) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  return result.status === 0 ? null : (result.stderr || 'syntaxe invalide').split('\n').slice(0, 4).join(' ');
}

async function importExtensionModule(file) {
  const url = `${pathToFileURL(file).href}?v=${Date.now()}`;
  const module = await import(url);
  const extension = module.default;
  if (!extension || typeof extension !== 'object') throw new Error('export default manquant');
  if (!extension.id) throw new Error('id manquant');
  if (!extension.hooks || typeof extension.hooks !== 'object') throw new Error('hooks manquants');
  for (const [hook, value] of Object.entries(extension.hooks)) {
    if (!['rowActions', 'dashboardWidgets', 'screens'].includes(hook)) throw new Error(`hook inconnu « ${hook} »`);
    for (const item of Array.isArray(value) ? value : [value]) {
      if (!item || typeof item !== 'object') throw new Error(`élément invalide dans ${hook}`);
      if (hook === 'rowActions' && typeof item.run !== 'function') throw new Error('rowAction sans run()');
      if (hook === 'dashboardWidgets' && typeof item.render !== 'function' && item.value === undefined) throw new Error('widget sans render()');
      if (hook === 'screens') {
        if (!item.id || !item.title) throw new Error('écran sans id ou title');
        if (typeof item.render !== 'function') throw new Error(`écran « ${item.id} » sans render()`);
        if (item.mount && typeof item.mount !== 'function') throw new Error(`écran « ${item.id} » : mount doit être une fonction`);
        if (item.on && typeof item.on !== 'function') throw new Error(`écran « ${item.id} » : on doit être une fonction`);
      }
    }
  }
  return extension;
}

async function executeTool(name, args, context) {
  const { projectDir, appId, manifest, syncProject, addField, baseUrl, changedFiles } = context;

  if (name === 'list_files') {
    return { files: await walkFiles(projectDir) };
  }

  if (name === 'read_file') {
    const { normalized, full } = safeRelative(projectDir, args.path);
    const stat = await fs.stat(full).catch(() => null);
    if (!stat || !stat.isFile()) throw new AgentError(`Fichier introuvable : ${normalized}`, { status: 404 });
    if (stat.size > 200 * 1024) throw new AgentError('Fichier trop volumineux.', { status: 413 });
    return { path: normalized, content: await fs.readFile(full, 'utf8') };
  }

  if (name === 'write_file') {
    const { normalized, full } = safeRelative(projectDir, args.path);
    if (!EXTENSION_PATH.test(normalized)) {
      throw new AgentError('Écriture refusée : seuls les fichiers sous extensions/<id>/ avec une extension .js, .json ou .css sont autorisés.', { status: 403 });
    }
    const content = String(args.content ?? '');
    if (!content.trim()) throw new AgentError('Contenu vide.', { status: 400 });
    if (Buffer.byteLength(content) > MAX_FILE_BYTES) throw new AgentError('Fichier trop volumineux (60 Ko max).', { status: 413 });
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, 'utf8');
    changedFiles.add(normalized);
    await syncProject();
    return { ok: true, path: normalized, bytes: Buffer.byteLength(content) };
  }

  if (name === 'delete_file') {
    const { normalized, full } = safeRelative(projectDir, args.path);
    if (!EXTENSION_PATH.test(normalized)) throw new AgentError('Suppression refusée hors extensions/.', { status: 403 });
    await fs.rm(full, { force: true });
    changedFiles.add(normalized);
    await syncProject();
    return { ok: true, path: normalized };
  }

  if (name === 'add_field') {
    if (typeof addField !== 'function') throw new AgentError('Le schéma n’est pas modifiable dans ce contexte.', { status: 400 });
    const result = await addField(args);
    if (result?.ok) changedFiles.add(`src-tauri/migrations/${result.migration}`);
    return result;
  }

  if (name === 'verify_ui') {
    const { runUiAction } = await import('./browser.js');
    return runUiAction({ appId, baseUrl, action: args.action, selectors: { hash: args.hash, text: args.text, field: args.field, value: args.value } });
  }

  if (name === 'check_app') {
    const issues = [];
    const files = await walkFiles(projectDir);
    for (const relative of files) {
      if (!relative.endsWith('.js')) continue;
      if (relative.startsWith('src-tauri/web/vendor/')) continue;
      if (relative.startsWith('src-tauri/target/')) continue;
      const error = runNodeCheck(path.join(projectDir, relative));
      if (error) issues.push({ file: relative, error });
    }

    const extensionsRoot = path.join(projectDir, 'extensions');
    const extensionDirs = existsSync(extensionsRoot)
      ? (await fs.readdir(extensionsRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory())
      : [];
    const specScreenKeys = new Set((context.spec?.screens || []).map((screen) => screen.key));
    const extensionScreenIds = new Set();
    for (const dir of extensionDirs) {
      const indexFile = path.join(extensionsRoot, dir.name, 'index.js');
      if (!existsSync(indexFile)) {
        issues.push({ file: `extensions/${dir.name}`, error: 'index.js manquant' });
        continue;
      }
      try {
        const extension = await importExtensionModule(indexFile);
        const screens = extension.hooks?.screens;
        for (const screen of (Array.isArray(screens) ? screens : screens ? [screens] : [])) {
          if (specScreenKeys.has(screen.id)) {
            issues.push({ file: `extensions/${dir.name}/index.js`, error: `écran « ${screen.id} » : identifiant déjà utilisé par le plan` });
          }
          if (extensionScreenIds.has(screen.id)) {
            issues.push({ file: `extensions/${dir.name}/index.js`, error: `écran « ${screen.id} » : doublon entre extensions` });
          }
          extensionScreenIds.add(screen.id);
        }
      } catch (error) {
        issues.push({ file: `extensions/${dir.name}/index.js`, error: `chargement : ${error.message}` });
      }
      try {
        const source = await fs.readFile(indexFile, 'utf8');
        if (/\.store\.(create|delete|save|add)\s*\(/.test(source)) {
          issues.push({ file: `extensions/${dir.name}/index.js`, error: 'API de données invalide : utilisez ctx.store.insert / update / remove (pas create/delete/save/add).' });
        }
      } catch {
        /* lecture déjà validée ci-dessus */
      }
    }

    const checks = [];
    for (const resource of ['', 'assets/app.js', 'assets/extensions.generated.js', 'assets/extensions.js']) {
      const url = `${baseUrl}/preview/${appId}/${resource}`;
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        checks.push({ resource: resource || 'index.html', status: response.status });
        if (!response.ok) issues.push({ file: resource || 'index.html', error: `HTTP ${response.status}` });
      } catch (error) {
        issues.push({ file: resource || 'index.html', error: `injoignable : ${error.message}` });
      }
    }

    if (issues.length === 0) {
      const indexOk = checks.every((check) => check.status === 200);
      if (!indexOk) issues.push({ file: 'aperçu', error: 'certaines ressources ne répondent pas' });
    }

    return { ok: issues.length === 0, issues, checks };
  }

  if (name === 'build_windows') {
    const { startBuild } = await import('./builder.js');
    const build = await startBuild({ appId, projectDir, spec: context.spec, force: true });
    return {
      status: build.status,
      error: build.error || null,
      installer: build.artifacts?.installer?.file || null,
      portable: build.artifacts?.portable?.file || null,
      durationMs: build.durationMs
    };
  }

  if (name === 'finish') {
    return { done: true, summary: String(args.summary || '').trim() || 'Mission terminée.' };
  }

  throw new AgentError(`Outil inconnu : ${name}`, { status: 400 });
}

export async function runAgent({ appId, projectDir, spec, manifest, syncProject, addField, baseUrl, instruction }) {
  const extensionsRoot = path.join(projectDir, 'extensions');
  const extensions = existsSync(extensionsRoot)
    ? (await fs.readdir(extensionsRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
    : [];

  const extensionSources = [];
  for (const id of extensions) {
    const file = path.join(extensionsRoot, id, 'index.js');
    try {
      extensionSources.push({ path: `extensions/${id}/index.js`, content: await fs.readFile(file, 'utf8') });
    } catch {
      /* extension incomplète : ignorée dans le contexte */
    }
  }

  const changedFiles = new Set();
  const transcript = [];
  const messages = [
    { role: 'system', content: systemPrompt({ spec, manifest, extensions, extensionSources }) },
    { role: 'user', content: instruction }
  ];

  const context = { appId, projectDir, spec, manifest, syncProject, addField, baseUrl, changedFiles };
  let summary = '';
  let usage = null;

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const { message, usage: stepUsage } = await requestAgentChat(messages);
    usage = stepUsage || usage;
    const content = message.content || '';
    if (content.trim()) transcript.push({ type: 'assistant', text: content.trim() });
    messages.push({
      role: 'assistant',
      content,
      ...(message.tool_calls ? { tool_calls: message.tool_calls } : {})
    });

    if (!message.tool_calls?.length) {
      summary = content.trim() || 'Aucune modification proposée.';
      break;
    }

    for (const call of message.tool_calls) {
      const name = call.function?.name;
      let args = {};
      try {
        args = JSON.parse(call.function?.arguments || '{}');
      } catch {
        args = {};
      }
      let result;
      try {
        result = await executeTool(name, args, context);
      } catch (error) {
        result = { error: error.message };
      }
      transcript.push({ type: 'tool', name, args, result });
      messages.push({ role: 'tool', tool_call_id: call.id, content: clamp(JSON.stringify(result)) });

      if (name === 'finish' && result?.done) {
        summary = result.summary;
        return { summary, transcript, changedFiles: [...changedFiles], usage };
      }
    }
  }

  return {
    summary: summary || 'L’agent n’a pas terminé sa mission dans la limite d’étapes.',
    transcript,
    changedFiles: [...changedFiles],
    usage
  };
}

export { AgentError };
