// Utilidades de interfaz. Todo el DOM se construye con createElement: nunca innerHTML con datos.
import { t, tl, locale } from './i18n.js';

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

let uid = 0;
export function nextId(prefix = 'id') { uid += 1; return `${prefix}-${uid}`; }

// ---------- Formato ----------

export function fmtEUR(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(locale(), { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n);
}
export function fmtNum(n, decimals = 0) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(locale(), { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
}
export function fmtPct(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${fmtNum(n, 2)} %`;
}

/** Formatea las variables numéricas de un hallazgo para interpolarlas en texto. */
export function fmtVars(vars = {}) {
  const out = {};
  for (const [k, v] of Object.entries(vars)) {
    if (typeof v === 'number') out[k] = Number.isInteger(v) ? fmtNum(v) : fmtNum(v, 1);
    else out[k] = v;
  }
  return out;
}

// ---------- Componentes ----------

export function disclaimer(key = 'disclaimer.general') {
  return h('aside', { class: 'disclaimer', 'aria-label': t('disclaimer.label') },
    h('span', { class: 'disclaimer-mark', 'aria-hidden': 'true' }, '!'),
    h('p', null, t(key)));
}

export function stamp(sev, label) {
  return h('span', { class: `stamp stamp-${sev}` }, label ?? t(`sev.${sev}`));
}

/** Cita normativa: { norma: 'et'|'convenio'|'rd1561'|'rd2001'|'lgss'|'lrjs', art: '34.3' | null } */
export function citeText(c) {
  const norma = t(`norma.${c.norma}`);
  if (c.art === null || c.art === undefined || c.art === '') return `${norma}, ${t('norma.art_pendiente')}`;
  return `${norma}, ${t('norma.art', { art: c.art })}`;
}

export function citeList(cites) {
  if (!cites || !cites.length) return null;
  return h('ul', { class: 'cites', 'aria-label': t('report.cites_label') },
    cites.map((c) => h('li', { class: c.art == null ? 'pending-tag' : null }, citeText(c))));
}

export function printButton(labelKey = 'print.button') {
  return h('button', { type: 'button', class: 'btn btn-brass no-print', onclick: () => window.print() }, t(labelKey));
}

/** Cabecera que solo aparece en papel/PDF. */
export function printHeader(titleKey, convenio) {
  const fecha = new Intl.DateTimeFormat(locale(), { dateStyle: 'long' }).format(new Date());
  return h('div', { class: 'print-only print-header' },
    h('p', { class: 'print-title' }, `Barra Libre — ${t(titleKey)}`),
    h('p', null, t('print.generated', { fecha })),
    convenio ? h('p', null, sourceLine(convenio)) : null,
    h('p', null, t('print.privacy')),
    h('p', null, t('disclaimer.general')));
}

export function sourceLine(convenio) {
  const m = convenio.meta;
  return t('footer.source', {
    nombre: tl(m.nombre),
    periodo: m.periodo_pactado,
    tablas: m.tablas_aplicadas,
    boletin: m.fuente.boletin,
    numero: m.fuente.numero,
    fecha: m.fuente.fecha_publicacion,
  });
}

/**
 * Markdown mínimo y seguro: párrafos, **negrita**, listas con "- " y enlaces [texto](https://…).
 * Los enlaces abren fuera y sin referrer. No interpreta HTML.
 */
export function md(input) {
  const blocks = Array.isArray(input) ? input : String(input ?? '').split(/\n{2,}/);
  const frag = document.createDocumentFragment();
  for (const block of blocks) {
    const lines = String(block).split('\n');
    if (lines.every((l) => /^\s*-\s+/.test(l))) {
      frag.append(h('ul', null, lines.map((l) => h('li', null, inline(l.replace(/^\s*-\s+/, ''))))));
    } else {
      frag.append(h('p', null, inline(lines.join(' '))));
    }
  }
  return frag;
}

function inline(text) {
  const out = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(h('strong', null, m[1]));
    else out.push(externalLink(m[2], m[3]));
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function externalLink(label, href) {
  return h('a', { href, target: '_blank', rel: 'noopener noreferrer external' },
    label, h('span', { class: 'visually-hidden' }, ` (${t('a11y.external')})`));
}

/** Región de anuncios para lectores de pantalla. */
let liveEl;
export function announce(msg) {
  if (!liveEl) {
    liveEl = h('div', { class: 'visually-hidden', 'aria-live': 'polite', role: 'status' });
    document.body.append(liveEl);
  }
  liveEl.textContent = '';
  setTimeout(() => { liveEl.textContent = msg; }, 50);
}

