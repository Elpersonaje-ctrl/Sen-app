import { t, tl } from '../i18n.js';
import { h, disclaimer, citeList, md, externalLink } from '../ui.js';

export function render(root, { data }) {
  const { pasos, plazos } = data.queHacer;

  root.append(
    h('p', { class: 'eyebrow' }, t('qh.eyebrow')),
    h('h1', { id: 'h-que-hacer' }, t('qh.h1')),
    h('p', { class: 'lead' }, t('qh.lead')),
    disclaimer('disclaimer.que_hacer'));

  root.append(h('ol', { class: 'steps' }, pasos.map((p) => h('li', null,
    h('h2', null, tl(p.titulo)),
    md(tl(p.cuerpo)),
    p.enlaces && p.enlaces.length
      ? h('ul', null, p.enlaces.map((e) => h('li', null, externalLink(tl(e.texto), e.url))))
      : null,
    p._verificar && p.enlaces ? h('p', { class: 'q-help' }, t('qh.verificar')) : null,
    citeList(p.citas)))));

  root.append(
    h('h2', { id: 'h-plazos' }, t('qh.plazos')),
    h('ul', { class: 'deadline-list', 'aria-labelledby': 'h-plazos' }, plazos.map((p) => h('li', null,
      h('span', { class: 'plazo' }, tl(p.plazo)),
      h('div', null, md([tl(p.que)]), citeList(p.citas))))));
}
