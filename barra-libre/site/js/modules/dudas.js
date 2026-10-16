import { t, tl } from '../i18n.js';
import { h, disclaimer, citeList, md } from '../ui.js';
import { articulo } from '../logic/convenio.js';

/** Sustituye {{ruta.del.convenio}} por su valor; si es null, «dato pendiente». */
function fillConvenio(text, convenio) {
  return text.replace(/\{\{([\w.]+)\}\}/g, (m, path) => {
    const v = path.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), convenio);
    return v === null || v === undefined || v === '' ? t('dudas.pendiente') : String(v);
  });
}

function resolveCites(citas, convenio) {
  return (citas || []).map((c) => (c.norma === 'convenio' && typeof c.art === 'string' && c.art.startsWith('@')
    ? { norma: 'convenio', art: articulo(convenio, c.art.slice(1)) }
    : c));
}

export function render(root, { data, state, rerender }) {
  const S = state.dudas;
  const { temas, nodos } = data.dudas;

  root.append(
    h('p', { class: 'eyebrow' }, t('dudas.eyebrow')),
    h('h1', { id: 'h-dudas' }, t('dudas.h1')),
    disclaimer('disclaimer.dudas'));

  const focusNode = () => document.getElementById('duda-node')?.focus();

  if (!S.topic) {
    root.append(
      h('p', { class: 'lead' }, t('dudas.lead')),
      h('h2', null, t('dudas.topics')),
      h('ul', { class: 'topic-list' }, temas.map((tema) => h('li', null,
        h('button', { type: 'button', class: 'btn topic-btn choice-btn', onclick: () => {
          S.topic = tema.id;
          S.path = [{ node: tema.inicio }];
          rerender();
          focusNode();
        } }, tl(tema.titulo))))));
    return;
  }

  const tema = temas.find((x) => x.id === S.topic);
  const current = S.path[S.path.length - 1];
  const node = nodos[current.node];

  // Recorrido (migas)
  const crumbs = [tl(tema.titulo)];
  for (let i = 0; i < S.path.length - 1; i += 1) {
    const step = S.path[i];
    const opt = nodos[step.node]?.opciones?.[step.choice];
    if (opt) crumbs.push(tl(opt.texto));
  }
  root.append(h('nav', { 'aria-label': t('dudas.path') },
    h('ol', { class: 'crumbs' }, crumbs.map((c) => h('li', null, c)))));

  if (!node) {
    root.append(h('p', { class: 'callout callout-danger' }, `Nodo no encontrado: ${current.node}`));
  } else if (node.pregunta) {
    root.append(
      h('h2', { id: 'duda-node', tabindex: '-1' }, tl(node.pregunta)),
      h('ul', { class: 'topic-list' }, node.opciones.map((o, i) => h('li', null,
        h('button', { type: 'button', class: 'btn choice-btn', onclick: () => {
          current.choice = i;
          S.path.push({ node: o.ir });
          rerender();
          focusNode();
        } }, tl(o.texto))))));
  } else {
    const parrafos = (tl(node.respuesta) || []).map((p) => fillConvenio(p, data.convenio));
    const last = S.path.length >= 2 ? nodos[S.path[S.path.length - 2].node]?.opciones?.[S.path[S.path.length - 2].choice] : null;
    root.append(h('section', { class: 'card answer', 'aria-labelledby': 'duda-node' },
      h('h2', { id: 'duda-node', tabindex: '-1' }, last ? tl(last.texto) : tl(tema.titulo)),
      md(parrafos),
      citeList(resolveCites(node.citas, data.convenio))));
  }

  root.append(h('div', { class: 'btn-row' },
    h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => {
      if (S.path.length > 1) { S.path.pop(); delete S.path[S.path.length - 1].choice; } else { S.topic = null; S.path = []; }
      rerender();
      focusNode();
    } }, `← ${t('dudas.back')}`),
    h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { S.topic = null; S.path = []; rerender(); } }, t('dudas.restart'))));
}
