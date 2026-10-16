import { t, tList } from '../i18n.js';
import { h, disclaimer } from '../ui.js';

export function render(root) {
  const card = (route, key) => h('a', { class: 'module-card', href: `#${route}` },
    h('h3', null, t(`inicio.m_${key}_t`)),
    h('p', null, t(`inicio.m_${key}_d`)));

  root.append(
    h('p', { class: 'eyebrow' }, t('inicio.eyebrow')),
    h('h1', { id: 'h-inicio' }, t('inicio.h1')),
    h('p', { class: 'lead' }, t('inicio.lead')),
    h('div', { class: 'btn-row' }, h('a', { class: 'btn', href: '#auditoria' }, t('inicio.start'))),
    disclaimer('disclaimer.general'),
    h('h2', null, t('inicio.modules_title')),
    h('div', { class: 'module-grid' },
      card('auditoria', 'auditoria'),
      card('nomina', 'nomina'),
      card('dudas', 'dudas'),
      card('que-hacer', 'que_hacer')),
    h('hr', { class: 'rule' }),
    h('section', { class: 'card', 'aria-labelledby': 'h-privacidad' },
      h('h2', { id: 'h-privacidad' }, t('inicio.privacy_title')),
      h('ul', null, tList('inicio.privacy_list').map((s) => h('li', null, s))),
      h('p', { class: 'callout callout-warn' }, t('inicio.tip'))),
  );
}
