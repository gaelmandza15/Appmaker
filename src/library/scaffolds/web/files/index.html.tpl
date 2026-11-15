<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="{{ACCENT}}">
  <meta name="description" content="{{APP_TAGLINE}}">
  <meta name="generator" content="AppMaker">
  <title>{{APP_NAME}}</title>
  <link rel="icon" type="image/svg+xml" href="./favicon.svg">
  <link rel="stylesheet" href="./assets/app.css">
</head>
<body>
  <div id="app">
    <div class="boot-screen">
      <div class="boot-mark">{{APP_INITIAL}}</div>
      <div class="boot-copy">
        <strong>Chargement de {{APP_NAME}}</strong>
        <span>Préparation des données locales…</span>
      </div>
    </div>
  </div>
  <div id="modal-root"></div>
  <div id="toast-root" class="toast-root" aria-live="polite"></div>
  <noscript>Veuillez activer JavaScript pour utiliser cette application.</noscript>
  <script type="module" src="./assets/app.js"></script>
</body>
</html>
