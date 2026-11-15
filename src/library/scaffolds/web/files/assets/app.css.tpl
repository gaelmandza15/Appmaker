:root {
  color-scheme: light;
  --accent: {{ACCENT}};
  --accent-strong: color-mix(in srgb, var(--accent) 84%, #111827);
  --accent-soft: color-mix(in srgb, var(--accent) 9%, #ffffff);
  --accent-soft-2: color-mix(in srgb, var(--accent) 17%, #ffffff);
  --accent-ring: color-mix(in srgb, var(--accent) 26%, transparent);
  --ink: #151927;
  --ink-2: #424858;
  --muted: #7d8396;
  --muted-2: #9ba0b1;
  --line: #e8eaf1;
  --line-strong: #d9dce7;
  --canvas: #f4f5f9;
  --card: #ffffff;
  --sidebar: #101320;
  --success: #16a34a;
  --danger: #dc2626;
  --font: "Segoe UI", "Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  --radius: 16px;
  --shadow-sm: 0 1px 2px rgba(18, 22, 36, 0.04), 0 5px 16px rgba(18, 22, 36, 0.035);
  --shadow-md: 0 18px 44px rgba(18, 22, 36, 0.12);
  --shadow-lg: 0 30px 80px rgba(13, 16, 28, 0.24);
}

*, *::before, *::after { box-sizing: border-box; }
html { min-width: 320px; }
body {
  margin: 0;
  min-height: 100vh;
  background: var(--canvas);
  color: var(--ink);
  font-family: var(--font);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
body.modal-open { overflow: hidden; }
button, input, select, textarea { font: inherit; }
button { color: inherit; }
a { color: inherit; text-decoration: none; }
svg { display: block; flex: none; }
h1, h2, h3, p { margin: 0; }
table { border-collapse: collapse; border-spacing: 0; }
::selection { background: var(--accent-soft-2); }

::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #d7dae4; border: 3px solid transparent; border-radius: 999px; background-clip: padding-box; }
::-webkit-scrollbar-thumb:hover { background: #c3c7d5; border: 2px solid transparent; background-clip: padding-box; }

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}

/* ---------- Shell ---------- */
.app-shell { display: flex; min-height: 100vh; }
.sidebar {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  width: 252px;
  height: 100vh;
  flex: 0 0 252px;
  padding: 22px 16px 18px;
  overflow-y: auto;
  background:
    radial-gradient(420px 260px at -20% -10%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 70%),
    linear-gradient(180deg, #141827 0%, #0d101a 100%);
  color: #fff;
}
.brand { display: flex; align-items: center; gap: 11px; padding: 2px 6px; min-width: 0; }
.brand-mark {
  width: 40px; height: 40px; flex: none;
  display: grid; place-items: center;
  border-radius: 12px;
  background: linear-gradient(145deg, color-mix(in srgb, var(--accent) 78%, #ffffff 6%), color-mix(in srgb, var(--accent) 58%, #0b0e18));
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 8px 20px color-mix(in srgb, var(--accent) 28%, transparent);
  color: #fff;
}
.brand-copy { min-width: 0; }
.brand-copy strong {
  display: block; font-size: 14.5px; font-weight: 650; letter-spacing: -0.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.brand-copy span {
  display: block; margin-top: 1px; font-size: 11px; color: #858ca2;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.sidebar-nav { margin-top: 30px; }
.nav-label {
  padding: 0 12px; margin-bottom: 8px;
  color: #5f6680; font-size: 9.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
}
.nav-list { display: flex; flex-direction: column; gap: 3px; }
.nav-item {
  position: relative;
  display: flex; align-items: center; gap: 11px;
  min-height: 40px; padding: 0 12px;
  border-radius: 10px;
  color: #9aa1b7; font-size: 13px; font-weight: 550;
  transition: background 0.16s ease, color 0.16s ease;
}
.nav-item svg { color: #737b92; transition: color 0.16s ease; }
.nav-item:hover { color: #eef0f7; background: rgba(255,255,255,0.045); }
.nav-item:hover svg { color: #cfd4e2; }
.nav-item.is-active {
  color: #fff;
  background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 30%, transparent), rgba(255,255,255,0.035));
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06);
}
.nav-item.is-active svg { color: #fff; }
.nav-item .nav-text { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nav-count {
  min-width: 22px; padding: 2px 7px;
  border-radius: 999px;
  background: rgba(255,255,255,0.07);
  color: #aab0c4; font-size: 10.5px; font-weight: 650; text-align: center;
  font-variant-numeric: tabular-nums;
}
.nav-item.is-active .nav-count { background: rgba(255,255,255,0.16); color: #fff; }
.sidebar-foot { margin-top: auto; padding-top: 24px; }
.storage-card {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 12px;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  background: rgba(255,255,255,0.035);
}
.storage-dot {
  width: 8px; height: 8px; flex: none; border-radius: 50%;
  background: #34d399; box-shadow: 0 0 0 4px rgba(52,211,153,0.1);
}
.storage-dot.is-memory { background: #fbbf24; box-shadow: 0 0 0 4px rgba(251,191,36,0.1); }
.storage-card strong { display: block; color: #d8dbe7; font-size: 11px; font-weight: 600; }
.storage-card small { display: block; margin-top: 1px; color: #6e768d; font-size: 10px; }
.sidebar-meta { margin-top: 14px; padding: 0 4px; color: #4f566d; font-size: 10px; letter-spacing: 0.01em; }
.nav-scrim { display: none; }

.workspace { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.topbar {
  position: sticky; top: 0; z-index: 30;
  display: flex; align-items: center; gap: 14px;
  min-height: 64px; padding: 0 32px;
  background: rgba(244,245,249,0.82);
  border-bottom: 1px solid rgba(232,234,241,0.85);
  backdrop-filter: blur(16px);
}
.menu-btn { display: none; }
.topbar .menu-btn { display: none; }
.crumbs { display: flex; align-items: center; gap: 9px; min-width: 0; font-size: 12px; }
.crumbs .crumb-app { color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
.crumbs .crumb-slash { color: #c4c8d3; }
.crumbs strong { color: var(--ink-2); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.topbar-actions { margin-left: auto; display: flex; align-items: center; gap: 14px; }
.status-pill {
  display: inline-flex; align-items: center; gap: 7px;
  height: 30px; padding: 0 11px;
  border: 1px solid var(--line); border-radius: 999px;
  background: rgba(255,255,255,0.7);
  color: var(--muted); font-size: 11px; font-weight: 550;
}
.status-pill::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,0.1); }
.status-pill.is-memory::before { background: #f59e0b; box-shadow: 0 0 0 3px rgba(245,158,11,0.12); }
.avatar {
  width: 32px; height: 32px; flex: none;
  display: grid; place-items: center;
  border-radius: 50%;
  background: linear-gradient(145deg, var(--accent), color-mix(in srgb, var(--accent) 62%, #111827));
  color: #fff; font-size: 11px; font-weight: 700; letter-spacing: 0.02em;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.24);
}
.content {
  width: 100%; max-width: 1440px; margin: 0 auto;
  padding: 30px 32px 56px;
}
.page { animation: page-in 0.35s cubic-bezier(0.22, 0.8, 0.35, 1) both; }
@keyframes page-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 24px; }
.page-title { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.page-head h1 { font-size: 26px; line-height: 1.2; font-weight: 690; letter-spacing: -0.028em; color: #11141f; }
.page-sub { margin-top: 6px; color: var(--muted); font-size: 13px; max-width: 640px; }
.page-actions { display: flex; align-items: center; gap: 9px; flex: none; padding-top: 2px; }
.date-chip {
  display: inline-flex; align-items: center; gap: 7px;
  height: 34px; padding: 0 12px;
  border: 1px solid var(--line); border-radius: 10px;
  background: rgba(255,255,255,0.7);
  color: var(--muted); font-size: 11.5px; font-weight: 550;
  white-space: nowrap;
}
.count-chip {
  display: inline-flex; align-items: center;
  height: 24px; padding: 0 9px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 11.5px; font-weight: 650;
  font-variant-numeric: tabular-nums;
}

/* ---------- Buttons ---------- */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  min-height: 40px; padding: 0 16px;
  border: 1px solid transparent; border-radius: 10px;
  font-size: 12.5px; font-weight: 600; line-height: 1;
  cursor: pointer; white-space: nowrap;
  transition: background 0.16s ease, border-color 0.16s ease, transform 0.16s ease, box-shadow 0.16s ease;
}
.btn:active { transform: translateY(1px); }
.btn-primary {
  background: var(--accent); color: #fff;
  box-shadow: 0 5px 14px color-mix(in srgb, var(--accent) 24%, transparent), inset 0 1px 0 rgba(255,255,255,0.16);
}
.btn-primary:hover { background: var(--accent-strong); box-shadow: 0 7px 18px color-mix(in srgb, var(--accent) 30%, transparent); }
.btn-ghost { background: #fff; border-color: var(--line-strong); color: var(--ink-2); }
.btn-ghost:hover { background: #fafbfe; border-color: #c9cddb; }
.btn-danger { background: #dc2626; color: #fff; }
.btn-danger:hover { background: #b91c1c; }
.btn-sm { min-height: 34px; padding: 0 12px; font-size: 12px; border-radius: 9px; }
.icon-btn {
  width: 32px; height: 32px; flex: none;
  display: inline-grid; place-items: center;
  border: 1px solid transparent; border-radius: 9px;
  background: transparent; color: var(--muted);
  cursor: pointer; transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.icon-btn:hover { background: #f2f4f9; color: var(--ink); }
.icon-btn.is-danger:hover { background: #fef2f2; color: var(--danger); }
.icon-btn:focus-visible, .btn:focus-visible, .nav-item:focus-visible, .th-sort:focus-visible {
  outline: 2px solid var(--accent); outline-offset: 2px;
}
a.icon-btn { text-decoration: none; }

/* ---------- Panels ---------- */
.panel {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 20px 22px 0; }
.panel-head h2 { font-size: 14.5px; font-weight: 650; letter-spacing: -0.012em; color: var(--ink); }
.panel-head p { margin-top: 3px; color: var(--muted-2); font-size: 11.5px; }
.panel-link {
  display: inline-flex; align-items: center; gap: 5px;
  margin-top: 3px; color: var(--accent-strong); font-size: 11.5px; font-weight: 600;
  opacity: 0.9;
}
.panel-link:hover { opacity: 1; }

/* ---------- Modal & forms ---------- */
.modal-backdrop {
  position: fixed; inset: 0; z-index: 100;
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
  background: rgba(13, 16, 27, 0.55);
  backdrop-filter: blur(5px);
  animation: fade-in 0.18s ease both;
}
.modal {
  width: min(680px, 100%);
  max-height: min(88vh, 860px);
  overflow-y: auto;
  background: #fff;
  border: 1px solid rgba(255,255,255,0.7);
  border-radius: 20px;
  box-shadow: var(--shadow-lg);
  animation: modal-in 0.24s cubic-bezier(0.2, 0.8, 0.3, 1) both;
}
.modal-head { display: flex; align-items: flex-start; gap: 16px; padding: 24px 26px 16px; }
.modal-head-copy { flex: 1; min-width: 0; }
.modal-eyebrow { color: var(--accent-strong); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.11em; margin-bottom: 4px; }
.modal-head h2 { font-size: 19px; font-weight: 680; letter-spacing: -0.022em; color: var(--ink); }
.modal-head p { margin-top: 5px; color: var(--muted); font-size: 12px; }
.modal-body { padding: 6px 26px 26px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.field { min-width: 0; }
.field.is-wide { grid-column: 1 / -1; }
.field > label { display: block; margin-bottom: 6px; color: var(--ink-2); font-size: 11.5px; font-weight: 600; }
.field-required { color: var(--danger); margin-left: 2px; }
.input, .select, .textarea {
  width: 100%;
  border: 1px solid #dfe2eb;
  border-radius: 10px;
  background: #fff;
  color: var(--ink);
  font-size: 13px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}
.input, .select { height: 42px; padding: 0 12px; }
.select {
  appearance: none;
  padding-right: 34px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23828797' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 11px center;
  cursor: pointer;
}
.textarea { min-height: 94px; padding: 10px 12px; resize: vertical; line-height: 1.55; }
.input::placeholder, .textarea::placeholder { color: #b4b8c6; }
.input:hover, .select:hover, .textarea:hover { border-color: #cbd0dd; }
.input:focus, .select:focus, .textarea:focus {
  outline: none; border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-ring);
  background: #fff;
}
.input.is-invalid, .select.is-invalid, .textarea.is-invalid { border-color: #ef8787; box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1); }
.field-error { margin-top: 5px; color: var(--danger); font-size: 10.5px; font-weight: 500; }
.field-hint { margin-top: 5px; color: var(--muted-2); font-size: 10.5px; }
.input-affix { position: relative; }
.input-affix .input { padding-right: 38px; }
.input-affix .affix { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--muted-2); font-size: 11.5px; font-weight: 550; pointer-events: none; }
.checkbox-row { display: flex; align-items: center; gap: 10px; height: 42px; }
.switch { position: relative; display: inline-flex; align-items: center; gap: 9px; cursor: pointer; user-select: none; font-size: 12px; color: var(--ink-2); }
.switch input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.switch-track {
  position: relative; width: 38px; height: 22px; flex: none;
  border-radius: 999px; background: #e2e5ee;
  transition: background 0.16s ease;
}
.switch-track::after {
  content: ""; position: absolute; top: 3px; left: 3px;
  width: 16px; height: 16px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 3px rgba(15,18,30,0.2);
  transition: transform 0.18s ease;
}
.switch input:checked + .switch-track { background: var(--accent); }
.switch input:checked + .switch-track::after { transform: translateX(16px); }
.switch input:focus-visible + .switch-track { box-shadow: 0 0 0 3px var(--accent-ring); }
.modal-actions {
  display: flex; align-items: center; justify-content: flex-end; gap: 9px;
  margin-top: 22px; padding-top: 17px;
  border-top: 1px solid var(--line);
}
.modal-actions .btn-danger { margin-right: auto; }
.danger-copy { color: var(--ink-2); font-size: 13px; line-height: 1.6; }
.danger-copy strong { color: var(--ink); font-weight: 650; }

/* ---------- Toasts ---------- */
.toast-root { position: fixed; right: 22px; bottom: 22px; z-index: 200; display: flex; flex-direction: column; align-items: flex-end; gap: 9px; pointer-events: none; }
.toast {
  display: flex; align-items: center; gap: 9px;
  padding: 11px 15px 11px 13px;
  border-radius: 11px;
  background: #141827;
  color: #f4f5fa;
  box-shadow: 0 16px 34px rgba(10, 13, 23, 0.28);
  font-size: 12px; font-weight: 500;
  animation: toast-in 0.24s cubic-bezier(0.2, 0.8, 0.3, 1) both;
  pointer-events: auto;
}
.toast svg { color: #4ade80; }
.toast.is-error svg { color: #f87171; }
.toast.is-leaving { animation: toast-out 0.2s ease both; }

/* ---------- Boot ---------- */
.boot-screen {
  min-height: 100vh;
  display: flex; align-items: center; justify-content: center; gap: 15px;
  background:
    radial-gradient(700px 420px at 50% 30%, var(--accent-soft), transparent 70%),
    var(--canvas);
}
.boot-mark {
  width: 52px; height: 52px;
  display: grid; place-items: center;
  border-radius: 15px;
  background: linear-gradient(145deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #10131f));
  color: #fff; font-size: 20px; font-weight: 700;
  box-shadow: 0 14px 30px color-mix(in srgb, var(--accent) 35%, transparent);
  animation: boot-pulse 1.6s ease-in-out infinite;
}
.boot-copy strong { display: block; font-size: 14px; font-weight: 650; color: var(--ink); }
.boot-copy span { display: block; margin-top: 3px; font-size: 11.5px; color: var(--muted); }
.error-screen { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
.error-card { max-width: 480px; padding: 28px; background: #fff; border: 1px solid var(--line); border-radius: 16px; text-align: center; box-shadow: var(--shadow-sm); }
.error-card h1 { margin-top: 12px; font-size: 18px; }
.error-card p { margin-top: 8px; color: var(--muted); font-size: 12.5px; }

@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes modal-in { from { opacity: 0; transform: translateY(14px) scale(0.985); } to { opacity: 1; transform: none; } }
@keyframes toast-in { from { opacity: 0; transform: translateY(8px) scale(0.97); } to { opacity: 1; transform: none; } }
@keyframes toast-out { to { opacity: 0; transform: translateY(5px); } }
@keyframes boot-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.045); } }

/* ---------- Responsive ---------- */
@media (max-width: 1060px) {
  .content { padding: 26px 24px 48px; }
  .topbar { padding: 0 24px; }
}
@media (max-width: 900px) {
  .sidebar {
    position: fixed; left: 0; top: 0; z-index: 60;
    transform: translateX(-102%);
    transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.3, 1);
    box-shadow: 24px 0 60px rgba(10, 13, 23, 0.25);
  }
  body.nav-open .sidebar { transform: none; }
  .nav-scrim {
    display: block; position: fixed; inset: 0; z-index: 55;
    background: rgba(13, 16, 27, 0.45); backdrop-filter: blur(2px);
    animation: fade-in 0.2s ease both;
  }
  .menu-btn { display: inline-grid; }
  .topbar .menu-btn { display: inline-grid; }
  .workspace { width: 100%; }
  .topbar { padding: 0 20px; }
  .content { padding: 24px 20px 44px; }
}
@media (max-width: 640px) {
  .topbar { min-height: 58px; gap: 10px; padding: 0 15px; }
  .content { padding: 20px 15px 40px; }
  .crumbs .crumb-app, .crumbs .crumb-slash { display: none; }
  .status-pill { display: none; }
  .page-head { flex-direction: column; align-items: stretch; gap: 14px; margin-bottom: 20px; }
  .page-head h1 { font-size: 23px; }
  .page-actions { padding-top: 0; }
  .page-actions .btn-primary { flex: 1; }
  .modal-backdrop { padding: 0; align-items: flex-end; }
  .modal { width: 100%; max-height: 94vh; border-radius: 20px 20px 0 0; }
  .modal-head { padding: 21px 20px 13px; }
  .modal-body { padding: 4px 20px 22px; }
  .form-grid { grid-template-columns: 1fr; gap: 14px; }
  .field.is-wide { grid-column: 1; }
  .modal-actions { flex-wrap: wrap; }
  .modal-actions .btn { flex: 1; }
  .toast-root { left: 15px; right: 15px; bottom: 15px; align-items: stretch; }
  .toast { justify-content: flex-start; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
