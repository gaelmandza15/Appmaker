import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Navigateur d’essai pour l’agent.
 *
 * Un navigateur headless pilote l’aperçu réel : l’agent peut naviguer, cliquer,
 * remplir, lire le DOM, relire la console et prendre des captures. C’est la
 * différence entre « le fichier est écrit » et « la fonctionnalité marche ».
 * Playwright est chargé à la demande : sans lui, le studio fonctionne, seul
 * l’outil de vérification visuelle se déclare indisponible.
 */

const BROWSER_PATHS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
];

let chromium = null;
let loadError = null;

async function loadChromium() {
  if (chromium || loadError) return chromium;
  try {
    ({ chromium } = await import('playwright-core'));
  } catch (error) {
    loadError = error;
  }
  return chromium;
}

function findBrowserExecutable() {
  return BROWSER_PATHS.find((candidate) => existsSync(candidate)) || null;
}

export async function browserStatus() {
  const available = Boolean(await loadChromium());
  const executable = findBrowserExecutable();
  return {
    available: available && Boolean(executable),
    executable,
    detail: !available
      ? 'Installez playwright-core (npm i playwright-core) pour la vérification visuelle.'
      : (!executable ? 'Aucun navigateur Chromium (Edge ou Chrome) détecté.' : 'Navigateur prêt.')
  };
}

class Session {
  constructor(appId, screenshotDir) {
    this.appId = appId;
    this.screenshotDir = screenshotDir;
    this.browser = null;
    this.page = null;
    this.consoleErrors = [];
  }

  async ensure(baseUrl) {
    if (this.page) return this.page;
    const engine = await loadChromium();
    if (!engine) throw new Error(loadError?.message || 'playwright-core indisponible');
    const executablePath = findBrowserExecutable();
    if (!executablePath) throw new Error('aucun navigateur Chromium détecté (Edge ou Chrome)');
    this.browser = await engine.launch({ executablePath, headless: true });
    const context = await this.browser.newContext({ viewport: { width: 1360, height: 900 } });
    this.page = await context.newPage();
    this.page.on('console', (message) => {
      if (message.type() === 'error') this.consoleErrors.push(message.text().slice(0, 300));
    });
    this.page.on('pageerror', (error) => this.consoleErrors.push(`pageerror: ${String(error.message).slice(0, 300)}`));
    await this.page.goto(`${baseUrl}/preview/${this.appId}/`, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(1200);
    return this.page;
  }

  async close() {
    if (this.browser) await this.browser.close().catch(() => {});
    this.browser = null;
    this.page = null;
  }
}

const sessions = new Map();

function sessionFor(appId) {
  if (!sessions.has(appId)) {
    sessions.set(appId, new Session(appId, null));
  }
  return sessions.get(appId);
}

export function closeBrowserSessions() {
  for (const session of sessions.values()) session.close();
  sessions.clear();
}

/** Décrit la page courante de façon compacte et actionnable. */
async function describePage(page) {
  return page.evaluate(() => {
    const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
    const headings = Array.from(document.querySelectorAll('h1, h2')).slice(0, 6).map(text);
    const nav = Array.from(document.querySelectorAll('.nav-item .nav-text')).map(text);
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'))
      .filter((el) => el.offsetParent !== null)
      .slice(0, 40)
      .map((el) => (el.getAttribute('aria-label') || text(el) || '').slice(0, 60))
      .filter(Boolean);
    const inputs = Array.from(document.querySelectorAll('input, textarea, select'))
      .filter((el) => el.offsetParent !== null)
      .slice(0, 30)
      .map((el) => ({ name: el.name || el.id || '', type: el.tagName.toLowerCase() }));
    const rows = document.querySelectorAll('tbody tr').length;
    return {
      url: location.href,
      hash: location.hash,
      headings,
      nav,
      buttons: [...new Set(buttons)],
      inputs,
      rows,
      bodyText: document.body.innerText.slice(0, 1500)
    };
  });
}

/**
 * Exécute une action de vérification dans l’aperçu.
 * Les sélecteurs sont volontairement simples : texte/aria, jamais du CSS exotique.
 */
export async function runUiAction({ appId, baseUrl, action, selectors = {} }) {
  const session = sessionFor(appId);
  const page = await session.ensure(baseUrl);
  const result = { action };

  const clickByLabel = async (label) => {
    const candidates = [
      page.getByRole('button', { name: label, exact: false }).first(),
      page.getByRole('link', { name: label, exact: false }).first(),
      page.getByLabel(label, { exact: false }).first(),
      page.getByText(label, { exact: false }).first()
    ];
    for (const locator of candidates) {
      if (await locator.count()) {
        await locator.click({ timeout: 4000 });
        await page.waitForTimeout(600);
        return true;
      }
    }
    return false;
  };

  if (action === 'goto') {
    const hash = String(selectors.hash || '').trim();
    if (!/^#\/[A-Za-z0-9_-]+$/.test(hash)) throw new Error('hash invalide (attendu : #/cle)');
    await page.evaluate((next) => { location.hash = next; }, hash);
    await page.waitForTimeout(800);
  } else if (action === 'click') {
    const label = String(selectors.text || '').trim();
    if (!label) throw new Error('cliquez par libellé : texte visible ou aria-label');
    result.clicked = await clickByLabel(label);
    if (!result.clicked) throw new Error(`Aucun élément cliquable « ${label} »`);
  } else if (action === 'fill') {
    const field = String(selectors.field || '').trim();
    if (!field) throw new Error('précisez le champ à remplir (nom, id ou libellé)');
    const locator = page.locator(`[name="${field}"], #${field}`).first();
    if (await locator.count()) {
      await locator.fill(String(selectors.value ?? ''));
    } else {
      const byLabel = page.getByLabel(field, { exact: false }).first();
      if (!(await byLabel.count())) throw new Error(`Champ « ${field} » introuvable`);
      await byLabel.fill(String(selectors.value ?? ''));
    }
    await page.waitForTimeout(200);
    result.filled = field;
  } else if (action === 'reload') {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
  } else if (action === 'screenshot') {
    const dir = path.join(process.cwd(), 'data', 'agent-shots');
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${appId}-${Date.now()}.png`);
    await page.screenshot({ path: file, fullPage: true });
    result.screenshot = path.relative(process.cwd(), file);
  } else if (action !== 'inspect') {
    throw new Error(`Action inconnue : ${action}`);
  }

  result.page = await describePage(page);
  result.consoleErrors = session.consoleErrors.slice(-8);
  return result;
}

/** Capture de la page courante, utilisée par la vérification automatique. */
export async function capturePreview(appId, baseUrl) {
  const session = sessionFor(appId);
  const page = await session.ensure(baseUrl);
  return describePage(page);
}
