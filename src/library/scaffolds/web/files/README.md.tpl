# {{APP_NAME}}

> {{APP_TAGLINE}}

Application métier générée le {{GENERATED_DATE}} avec **AppMaker** à partir de la demande :

> « {{PROMPT}} »

Aucune dépendance, aucun build : HTML, CSS et JavaScript natifs.

## Démarrage

Les fichiers utilisent des modules ES ; servez-les via HTTP (pas d’ouverture directe en `file://`) :

```bash
npx serve .
# ou
python -m http.server 8080
```

Puis ouvrez `http://localhost:8080`.

Les données sont persistées dans le `localStorage` du navigateur sous la clé
`{{STORAGE_KEY}}`. Pour repartir des données d’exemple, supprimez cette clé depuis
les outils de développement du navigateur.

## Structure

```text
.
├── index.html          Coquille de l’application
├── favicon.svg
├── assets/
│   ├── app.css         Design system et styles des blocs
│   ├── ui.js           Icônes, formats, modales, toasts
│   ├── db.js           Couche de persistance (localStorage)
│   └── app.js          Configuration, navigation, formulaires, écrans
├── data/spec.json      Plan de données de l’application
├── data/schema.sql     Schéma SQLite prêt pour Tauri
├── appmaker.json       Métadonnées de génération
└── README.md
```

## Modèle de données

{{ENTITY_LIST}}

## Écrans

{{SCREEN_LIST}}

## Personnaliser

- **Couleur principale** : variable `--accent` dans `assets/app.css`.
- **Champs et libellés** : `data/spec.json`, puis les définitions équivalentes dans `APP` (`assets/app.js`).
- **Données d’exemple** : dans `data/spec.json` (`seed`) et dans `assets/app.js`.
- **Comportements** : le runtime CRUD (recherche, tri, formulaire, validation) est dans `assets/app.js` ; la persistance dans `assets/db.js`.
- **Nouveau bloc d’écran** : ajoutez un renderer dans `assets/app.js` et exposez-le dans `RENDERERS`.

## Aller vers Tauri + SQLite

La persistance est isolée derrière la classe `DataStore` (`assets/db.js`). Pour une
application de bureau :

1. embarquez ces fichiers dans un projet Tauri v2 (WebView) ;
2. ajoutez le plugin officiel `tauri-plugin-sql` côté Rust et `@tauri-apps/plugin-sql` côté JS ;
3. remplacez `load()` / `save()` par des requêtes sur une base SQLite, puis migrez les
   tables décrites dans `data/spec.json` avec `data/schema.sql`.

Les signatures publiques (`all`, `get`, `insert`, `update`, `remove`) sont prévues pour
que les écrans n’aient pas à changer. Le prototype actuel s’exécute intégralement dans
le navigateur avec un stockage local — la couche desktop reste à brancher.

## Blocs AppMaker utilisés

{{BLOCK_LIST}}

---

Généré par AppMaker · identifiant `{{APP_ID}}`.
