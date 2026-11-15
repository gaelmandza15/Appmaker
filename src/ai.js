import { config } from './config.js';
import { getLibrary } from './library/catalog.js';
import { normalizeSpec } from './spec.js';

class AiError extends Error {
  constructor(message, { status = 502, code = 'AI_ERROR', cause } = {}) {
    super(message);
    this.name = 'AiError';
    this.status = status;
    this.code = code;
    this.cause = cause;
  }
}

function blockCatalog() {
  return getLibrary().blocks
    .map((block) => `- ${block.id} (${block.name}) : ${block.description} Utilisation : ${block.whenToUse}`)
    .join('\n');
}

function buildSystemPrompt() {
  return `Tu es l'architecte produit d'AppMaker, un studio qui génère des applications de gestion métier à partir de blocs réutilisables. Tu ne génères JAMAIS de HTML, CSS ou JavaScript : tu produis uniquement un plan de données JSON. Une bibliothèque de blocs assemble ensuite ce plan en une application fonctionnelle.

Ta réponse doit être UNIQUEMENT un objet JSON valide, sans markdown, sans commentaire, sans texte avant ou après. Le JSON sera parsé automatiquement.

RÈGLES PRODUIT
- L'interface est en français par défaut (sauf demande explicite d'une autre langue). Devise : EUR. Dates ISO AAAA-MM-JJ.
- 1 à 3 entités maximum, 4 à 9 champs par entité. Chaque entité doit correspondre à un vrai objet métier manipulable.
- Fournis des données d'exemple crédibles et cohérentes (6 à 8 lignes par entité) pour que l'application soit immédiatement démontrable.
- Noms de champs et clés d'entités en camelCase ASCII, sans accents, sans espaces. Les libellés sont en français naturel.
- Chaque entité a un champ d'affichage clair (labelField), de préférence un texte unique (nom, référence…).
- Utilise au maximum 6 champs avec "inTable": true par entité, dont le labelField. Les champs longs (note, description) sont inTable: false.
- Types de champs autorisés : text, textarea, number, currency, boolean, date, select, relation.
  - select exige "options" : 2 à 8 chaînes courtes.
  - relation exige "target" : la clé d'une autre entité du plan. Jamais une auto-relation, jamais une cible inexistante.
  - number/currency peuvent avoir min, max, step. currency s'affiche en euros.
- Pour les relations dans "seed", mets le libellé de la ligne cible (la valeur du labelField de l'entité cible), pas un identifiant numérique. Le runtime résoudra la relation.
- Évite les champs calculés. Le tableau de bord calcule déjà les agrégats.
- Ne crée pas d'entité "Utilisateur", "Paramètres" ou "Rapport" : ce sont des écrans, pas des objets de gestion.
- Pas de specs génériques : choisis des champs, statuts et catégories propres au métier demandé.

BLOCS DISPONIBLES
${blockCatalog()}

ÉCRANS
- Exactement 1 tableau de bord, placé en premier, pour chaque application.
- 1 écran crud (liste + formulaire + suppression) par entité, avec un titre court et un sous-titre utile.
- Dashboard : 3 à 4 KPI calculés depuis les données, une répartition (breakdown) sur un champ select, et une liste récente (recent) sur l'entité la plus événementielle.
- KPI : {label, entity, aggregation: count|sum|avg, field (obligatoire pour sum/avg, champ numérique), multiplyBy (champ numérique optionnel, ex. prix × quantité), format: number|currency|percent, filter optionnel {field, op: eq|neq|gt|gte|lt|lte|contains, value}, icon, tone: accent|success|warning|danger|neutral}.
- Pour une valeur totale en euros, utilise sum avec field = prix et multiplyBy = quantité/stock (jamais la somme des prix unitaires seuls).
- Un KPI "Alertes" peut filtrer sur un seuil fixe (ex. quantite lte 5), jamais sur un autre champ.
- Utilise des dates récentes (2026) et des libellés naturels. Les données doivent ressembler à un vrai fichier client, pas à des placeholders.
- Icônes autorisées : dashboard, package, boxes, users, user, truck, receipt, file-text, calendar, settings, plus, search, edit, trash, alert, trend, euro, list, kanban, chart, clock, check, home, briefcase, folder, tag, cart, credit-card, building, activity, layers, map-pin, phone, mail, star.

THÈME
- "theme.accent" est un hex #RRGGBB lisible, adapté à l'univers du métier (pas de gris).

STRUCTURE JSON ATTENDUE (adapte-la au besoin, ne la recopie pas telle quelle)
{
  "app": {"name": "Nom court de l'app", "tagline": "Sous-titre concret", "icon": "boxes"},
  "theme": {"accent": "#4F6BED"},
  "entities": [
    {
      "key": "produit", "name": "Produit", "namePlural": "Produits", "icon": "package", "labelField": "nom",
      "fields": [
        {"key": "nom", "label": "Nom du produit", "type": "text", "required": true, "inTable": true, "searchable": true},
        {"key": "categorie", "label": "Catégorie", "type": "select", "options": ["Informatique", "Mobilier"], "inTable": true},
        {"key": "fournisseur", "label": "Fournisseur", "type": "relation", "target": "fournisseur", "inTable": true},
        {"key": "quantite", "label": "Quantité", "type": "number", "min": 0, "inTable": true},
        {"key": "prix", "label": "Prix unitaire", "type": "currency", "inTable": true},
        {"key": "note", "label": "Note", "type": "textarea", "inTable": false}
      ]
    }
  ],
  "screens": [
    {
      "type": "dashboard", "title": "Tableau de bord",
      "kpis": [
        {"label": "Produits", "entity": "produit", "aggregation": "count", "format": "number", "icon": "package", "tone": "accent"},
        {"label": "Valeur du stock", "entity": "produit", "aggregation": "sum", "field": "prix", "multiplyBy": "quantite", "format": "currency", "icon": "euro", "tone": "success"}
      ],
      "breakdown": {"entity": "produit", "field": "categorie", "title": "Répartition des produits"},
      "recent": {"entity": "produit", "limit": 6, "title": "Produits récents"}
    },
    {"type": "crud", "entity": "produit", "title": "Produits", "subtitle": "Catalogue et niveaux de stock"}
  ],
  "seed": {"produit": [{"nom": "Clavier", "categorie": "Informatique", "fournisseur": "TechDistrib", "quantite": 42, "prix": 89.9}]}
}

Contraintes de volume : reste sous 4000 tokens. Termine toujours le JSON correctement, sans balise de code.`;
}

function buildUserPrompt(prompt) {
  return `CONCEPTION DEMANDÉE
"""
${prompt}
"""

Produis le plan JSON complet de l'application. Elle doit être opérationnelle dès la génération, avec des données d'exemple françaises cohérentes.`;
}

function buildRefinePrompt(spec, instruction, originalPrompt) {
  return `PLAN ACTUEL DE L'APPLICATION
${JSON.stringify(spec, null, 2)}

DEMANDE INITIALE
"""
${originalPrompt || spec.app.tagline}
"""

MODIFICATION DEMANDÉE
"""
${instruction}
"""

Renvoie le plan JSON COMPLET mis à jour, en conservant tout ce qui n'est pas concerné par la modification. Conserve les données d'exemple existantes et adapte-les seulement si nécessaire.`;
}

function extractJson(text) {
  let cleaned = String(text || '').trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    if (start === -1) throw new AiError('La réponse de l’IA ne contient pas de JSON exploitable.', { code: 'INVALID_JSON' });
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < cleaned.length; i += 1) {
      const char = cleaned[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === '{') depth += 1;
      else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(cleaned.slice(start, i + 1));
          } catch {
            break;
          }
        }
      }
    }
    throw new AiError('Le JSON renvoyé par l’IA est incomplet ou invalide.', { code: 'INVALID_JSON' });
  }
}

function friendlyHttpError(status, detail) {
  if (status === 401) return new AiError('La clé API DeepSeek est invalide ou expirée. Vérifiez le fichier .env.', { status: 502, code: 'AUTH_ERROR' });
  if (status === 402) return new AiError('Le compte DeepSeek n’a plus de crédit disponible.', { status: 502, code: 'QUOTA_ERROR' });
  if (status === 429) return new AiError('DeepSeek limite temporairement les requêtes. Réessayez dans quelques secondes.', { status: 503, code: 'RATE_LIMIT' });
  if (status >= 500) return new AiError('Le service DeepSeek est momentanément indisponible.', { status: 503, code: 'UPSTREAM' });
  return new AiError(`Erreur de l’API DeepSeek (${status})${detail ? ` : ${detail}` : ''}`, { code: 'UPSTREAM' });
}

async function requestChat(messages, { temperature = 0.4, maxTokens = 5000, retries = 1 } = {}) {
  if (!config.apiKey) {
    throw new AiError('Aucune clé DeepSeek n’est configurée. Ajoutez DEEPSEEK_API_KEY dans le fichier .env.', { status: 503, code: 'NO_KEY' });
  }

  let attempt = 0;
  while (true) {
    attempt += 1;
    try {
      const response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' }
        }),
        signal: AbortSignal.timeout(150000)
      });

      const raw = await response.text();
      if (!response.ok) {
        let detail = '';
        try { detail = JSON.parse(raw)?.error?.message || ''; } catch { /* ignore */ }
        const error = friendlyHttpError(response.status, detail);
        if (response.status === 429 || response.status >= 500) {
          if (attempt <= retries) {
            await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
            continue;
          }
        }
        throw error;
      }

      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new AiError('Réponse illisible de DeepSeek.', { code: 'BAD_RESPONSE' });
      }
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new AiError('DeepSeek a renvoyé une réponse vide.', { code: 'EMPTY_RESPONSE' });
      return { content, usage: data.usage || null, model: data.model || config.model };
    } catch (error) {
      if (error instanceof AiError) {
        if ((error.code === 'RATE_LIMIT' || error.code === 'UPSTREAM') && attempt <= retries) {
          await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
          continue;
        }
        throw error;
      }
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        if (attempt <= retries) continue;
        throw new AiError('DeepSeek met trop de temps à répondre. Réessayez.', { status: 504, code: 'TIMEOUT' });
      }
      if (attempt <= retries) {
        await new Promise((resolve) => setTimeout(resolve, 900 * attempt));
        continue;
      }
      throw new AiError(`Impossible de joindre DeepSeek : ${error.message}`, { status: 502, code: 'NETWORK' });
    }
  }
}

async function planWithRetry(messages, prompt, attempt = 1) {
  const result = await requestChat(messages, { temperature: attempt === 1 ? 0.45 : 0.2, maxTokens: 5200 });
  try {
    const parsed = extractJson(result.content);
    const spec = normalizeSpec(parsed, { prompt });
    return { spec, usage: result.usage, model: result.model };
  } catch (error) {
    const isPlanError = error.code === 'INVALID_JSON' || !(error instanceof AiError);
    if (attempt < 2 && isPlanError) {
      const retryMessages = [
        ...messages,
        { role: 'assistant', content: result.content.slice(0, 600) },
        { role: 'user', content: `Ta réponse était inexploitable (${error.message}). Renvoie UNIQUEMENT le JSON complet et valide, sans markdown, en respectant exactement le schéma.` }
      ];
      return planWithRetry(retryMessages, prompt, attempt + 1);
    }
    throw error;
  }
}

export async function generatePlan(prompt) {
  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: buildUserPrompt(prompt) }
  ];
  return planWithRetry(messages, prompt);
}

export async function refinePlan({ spec, instruction, originalPrompt }) {
  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: buildRefinePrompt(spec, instruction, originalPrompt) }
  ];
  return planWithRetry(messages, originalPrompt || instruction);
}

export { AiError };
