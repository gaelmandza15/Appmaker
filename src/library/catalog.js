import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Bibliothèque illisible (${path.relative(process.cwd(), file)}): ${error.message}`);
  }
}

function readManifests(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const manifestPath = path.join(dir, entry.name, 'manifest.json');
      if (!fs.existsSync(manifestPath)) return null;
      return { ...readJson(manifestPath), dir: path.join(dir, entry.name) };
    })
    .filter(Boolean);
}

let cache = null;

export function getLibrary() {
  if (cache) return cache;
  const blocks = readManifests(path.join(root, 'blocks'));
  const scaffolds = readManifests(path.join(root, 'scaffolds'));
  const recipesDir = path.join(root, 'recipes');
  const recipes = fs.existsSync(recipesDir)
    ? fs.readdirSync(recipesDir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => readJson(path.join(recipesDir, file)))
    : [];
  cache = { blocks, scaffolds, recipes };
  return cache;
}

export function getBlock(id) {
  return getLibrary().blocks.find((block) => block.id === id) || null;
}

export function getScaffoldPath(id) {
  const scaffold = getLibrary().scaffolds.find((entry) => entry.id === id);
  if (!scaffold) throw new Error(`Scaffold inconnu: ${id}`);
  return scaffold.dir;
}

export function getLibrarySummary() {
  const library = getLibrary();
  return {
    blocks: library.blocks.map(({ id, name, description, icon, status }) => ({ id, name, description, icon, status: status || 'ready' })),
    scaffolds: library.scaffolds.map(({ id, name, description, status }) => ({ id, name, description, status: status || 'ready' })),
    recipes: library.recipes.map(({ id, name, description }) => ({ id, name, description }))
  };
}
