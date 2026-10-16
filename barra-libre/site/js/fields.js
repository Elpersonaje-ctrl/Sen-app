// Campos de formulario accesibles. Solo números, radios y desplegables: no existe ningún campo de texto libre.
import { t, has } from './i18n.js';
import { h, nextId } from './ui.js';

/**
 * q = { id, type: 'radio'|'number'|'select', base: 'audit.q', optBase: 'audit.o',
 *       options: [valor] | [{ value, label }], min, max, step, optional, showIf(answers) }
 * store = objeto donde se guardan las respuestas (en memoria).
 * onChange() se llama tras cada cambio válido.
 */
export function field(q, store, onChange) {
  const base = `${q.base}.${q.id}`;
  const label = t(`${base}.label`) + (q.optional ? ` ${t('common.optional')}` : '');
  const help = has(`${base}.help`) ? t(`${base}.help`) : null;
  const helpId = help ? nextId('help') : null;
  const wrap = h('div', { class: 'q-wrap', dataset: { q: q.id } });

  if (q.type === 'radio') {
    const name = nextId(`r-${q.id}`);
    const fs = h('fieldset', { class: 'q', 'aria-describedby': helpId },
      h('legend', null, label),
      help ? h('p', { class: 'q-help', id: helpId }, help) : null);
    const opts = h('div', { class: 'options' });
    for (const o of q.options) {
      const value = typeof o === 'object' ? o.value : o;
      const text = typeof o === 'object' ? o.label : optionLabel(q, value);
      const input = h('input', {
        type: 'radio', name, value,
        checked: store[q.id] === value,
        onchange: () => { store[q.id] = value; onChange(q.id); },
      });
      opts.append(h('label', { class: 'option' }, input, h('span', null, text)));
    }
    fs.append(opts);
    wrap.append(fs);
    return wrap;
  }

  const id = nextId(`f-${q.id}`);
  const labelEl = h('label', { class: 'q-label', for: id }, label);

  if (q.type === 'select') {
    const sel = h('select', {
      id, 'aria-describedby': helpId,
      onchange: (e) => {
        if (e.target.value) store[q.id] = e.target.value; else delete store[q.id];
        onChange(q.id);
      },
    }, h('option', { value: '' }, has(`${base}.placeholder`) ? t(`${base}.placeholder`) : '—'));
    for (const o of q.options) {
      sel.append(h('option', { value: o.value, selected: store[q.id] === o.value }, o.label));
    }
    wrap.append(h('div', { class: 'q' }, labelEl, help ? h('p', { class: 'q-help', id: helpId }, help) : null, sel));
    return wrap;
  }

  // number
  const errId = nextId('err');
  const err = h('p', { class: 'field-error', id: errId, hidden: true });
  const unit = has(`${base}.unit`) ? t(`${base}.unit`) : '';
  const input = h('input', {
    id, type: 'number', inputmode: 'decimal', autocomplete: 'off',
    min: q.min, max: q.max, step: q.step ?? 'any',
    value: store[q.id] ?? '',
    'aria-describedby': [helpId, errId].filter(Boolean).join(' '),
    oninput: (e) => {
      const raw = e.target.value.trim().replace(',', '.');
      if (raw === '') {
        delete store[q.id];
        setError(false);
        onChange(q.id);
        return;
      }
      const v = Number(raw);
      if (!Number.isFinite(v) || (q.min !== undefined && v < q.min) || (q.max !== undefined && v > q.max)) {
        delete store[q.id];
        setError(true);
        onChange(q.id);
        return;
      }
      store[q.id] = v;
      setError(false);
      onChange(q.id);
    },
  });
  function setError(on) {
    input.setAttribute('aria-invalid', on ? 'true' : 'false');
    err.hidden = !on;
    err.textContent = on ? t('common.invalid_range', { min: q.min, max: q.max }) : '';
  }
  wrap.append(h('div', { class: 'q' },
    labelEl,
    help ? h('p', { class: 'q-help', id: helpId }, help) : null,
    h('div', { class: 'field-number' }, input, unit ? h('span', { class: 'unit', 'aria-hidden': 'true' }, unit) : null),
    err));
  return wrap;
}

function optionLabel(q, value) {
  const k = `${q.optBase}.${q.id}.${value}`;
  if (has(k)) return t(k);
  return t(`opt.${value}`);
}

/** Muestra/oculta preguntas condicionales según las respuestas actuales. */
export function applyVisibility(container, questions, store) {
  for (const q of questions) {
    const el = container.querySelector(`[data-q="${q.id}"]`);
    if (!el) continue;
    el.hidden = q.showIf ? !q.showIf(store) : false;
  }
}

/** Respuestas solo de las preguntas visibles (las ocultas no cuentan). */
export function visibleAnswers(questions, store) {
  const out = {};
  for (const q of questions) {
    if (q.showIf && !q.showIf(store)) continue;
    if (store[q.id] !== undefined) out[q.id] = store[q.id];
  }
  return out;
}
