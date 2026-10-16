// Textos de interfaz en i18n/<lang>.json. Contenidos bilingües ({es, gl}) se leen con tl().
import { fetchJSON } from './data.js';

export const LANGS = ['es', 'gl'];
const cache = {};
let dict = {};
let lang = 'es';

export async function setLang(next) {
  if (!LANGS.includes(next)) next = 'es';
  if (!cache[next]) cache[next] = await fetchJSON(`i18n/${next}.json`);
  dict = cache[next];
  lang = next;
  document.documentElement.lang = next;
}

export function getLang() { return lang; }

export function detectLang() {
  const prefs = navigator.languages || [navigator.language || 'es'];
  return prefs.some((l) => /^gl\b/i.test(l)) ? 'gl' : 'es';
}

function lookup(key) {
  return key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), dict);
}

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
}

/** Texto traducido. Si falta la clave se devuelve la propia clave (visible en desarrollo). */
export function t(key, vars) {
  const v = lookup(key);
  if (typeof v === 'string') return interpolate(v, vars);
  if (Array.isArray(v)) return v.map((s) => interpolate(String(s), vars)).join('\n\n');
  return key;
}

/** Igual que t() pero devuelve arrays tal cual (para listas de párrafos). */
export function tList(key, vars) {
  const v = lookup(key);
  if (Array.isArray(v)) return v.map((s) => interpolate(String(s), vars));
  if (typeof v === 'string') return [interpolate(v, vars)];
  return [];
}

export function has(key) { return lookup(key) !== undefined; }

/** Contenido bilingüe { es, gl } → cadena en el idioma activo. */
export function tl(obj, vars) {
  if (obj == null) return '';
  if (typeof obj === 'string') return interpolate(obj, vars);
  const v = obj[lang] ?? obj.es ?? '';
  return Array.isArray(v) ? v.map((s) => interpolate(s, vars)) : interpolate(v, vars);
}

/** Aplica traducciones a elementos estáticos con data-i18n / data-i18n-attr="attr:clave;attr2:clave2". */
export function applyStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(';').forEach((pair) => {
      const [attr, key] = pair.split(':');
      if (attr && key) el.setAttribute(attr.trim(), t(key.trim()));
    });
  });
}

export function locale() { return lang === 'gl' ? 'gl-ES' : 'es-ES'; }
