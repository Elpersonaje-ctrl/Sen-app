// Punto de entrada. Enrutado por hash, idioma y aviso de datos pendientes.
import { loadAll } from './data.js';
import { setLang, detectLang, getLang, applyStatic, t } from './i18n.js';
import { state, resetState } from './state.js';
import { h, clear, announce, sourceLine } from './ui.js';
import { bloquesPendientes, bloquesPendientesFiscal } from './logic/convenio.js';
import * as inicio from './modules/inicio.js';
import * as auditoria from './modules/auditoria.js';
import * as nomina from './modules/nomina.js';
import * as dudas from './modules/dudas.js';
import * as queHacer from './modules/que-hacer.js';

const ROUTES = { inicio, auditoria, nomina, dudas, 'que-hacer': queHacer };
let data = null;

function currentRoute() {
  const r = location.hash.replace(/^#/, '');
  return ROUTES[r] ? r : 'inicio';
}

function render({ focus = false } = {}) {
  const route = currentRoute();
  // Se vacían todas las vistas: no queda en el DOM ninguna respuesta de una vista oculta.
  document.querySelectorAll('.view').forEach((v) => { clear(v); v.hidden = v.dataset.view !== route; });
  document.querySelectorAll('.module-nav a').forEach((a) => {
    if (a.dataset.route === route) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const container = document.getElementById(`view-${route}`);
  ROUTES[route].render(container, { data, state, rerender: () => render() });
  document.title = route === 'inicio' ? t('app.title') : `${t(`nav.${route.replace('-', '_')}`)} · ${t('app.title')}`;
  if (focus) {
    const heading = container.querySelector('h1');
    if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
    window.scrollTo(0, 0);
  }
}

function renderStatus() {
  const box = document.getElementById('data-status');
  clear(box);
  const pend = bloquesPendientes(data.convenio);
  const pendF = bloquesPendientesFiscal(data.fiscal);
  if (!pend.length && !pendF.length) return;
  box.append(h('div', { class: 'callout callout-warn data-pending' },
    h('p', null, h('strong', null, t('status.pending_title')), ' ', t('status.pending_body')),
    h('details', null,
      h('summary', null, t('status.pending_details', { n: pend.length + pendF.length })),
      h('p', null, t('status.pending_where')),
      h('ul', null,
        pend.map((p) => h('li', null, h('code', null, `data/convenio.json → ${p}`))),
        pendF.map((p) => h('li', null, h('code', null, `data/fiscal-2026.json → ${p}`)))))));
}

function renderFooter() {
  const el = document.getElementById('footer-source');
  el.textContent = sourceLine(data.convenio);
}

function syncLangButtons() {
  document.querySelectorAll('.lang-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())));
}

async function changeLang(l) {
  await setLang(l);
  applyStatic();
  syncLangButtons();
  renderStatus();
  renderFooter();
  render();
  announce(t('lang.changed'));
}

async function boot() {
  try {
    await setLang(detectLang());
    data = await loadAll();
  } catch (err) {
    const main = document.getElementById('main');
    clear(main);
    main.append(h('div', { class: 'callout callout-danger' },
      h('p', null, h('strong', null, 'No se han podido cargar los datos. / Non se puideron cargar os datos.')),
      h('p', null, 'Si abres el archivo directamente (file://), sírvelo con un servidor local: ver README.md.'),
      h('p', null, h('code', null, String(err.message || err)))));
    return;
  }

  applyStatic();
  syncLangButtons();
  renderStatus();
  renderFooter();

  document.querySelectorAll('.lang-btn').forEach((b) => b.addEventListener('click', () => changeLang(b.dataset.lang)));

  document.getElementById('btn-wipe').addEventListener('click', () => {
    resetState();
    render();
    announce(t('privacy.wiped'));
  });

  window.addEventListener('hashchange', () => render({ focus: true }));
  render();
}

boot();
