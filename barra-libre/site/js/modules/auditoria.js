import { t, tl } from '../i18n.js';
import { h, disclaimer, stamp, citeList, printButton, printHeader, fmtVars, announce } from '../ui.js';
import { field, applyVisibility, visibleAnswers } from '../fields.js';
import { evaluarAuditoria, resumen } from '../logic/auditoria-rules.js';
import { bloquesPendientes } from '../logic/convenio.js';

const isTemporal = (a) => typeof a.contrato === 'string' && a.contrato.startsWith('temporal');
const isParcial = (a) => typeof a.contrato === 'string' && a.contrato.endsWith('parcial');
const yn = ['si', 'no', 'nose'];

function steps(convenio) {
  const B = { base: 'audit.q', optBase: 'audit.o' };
  const cats = convenio.categorias.map((c) => ({ value: c.id, label: tl(c.nombre) }));
  return [
    { id: 'puesto', qs: [
      { ...B, id: 'categoria', type: 'select', options: cats },
      { ...B, id: 'contrato', type: 'radio', options: ['indefinido_completo', 'indefinido_parcial', 'fijo_discontinuo', 'temporal_completo', 'temporal_parcial'] },
      { ...B, id: 'alta', type: 'radio', options: yn },
      { ...B, id: 'temporal_causa', type: 'radio', options: ['produccion', 'sustitucion', 'nose'], showIf: isTemporal },
      { ...B, id: 'temporal_meses_actual', type: 'number', min: 0, max: 120, step: 1, showIf: isTemporal },
      { ...B, id: 'temporal_meses_24', type: 'number', min: 0, max: 24, step: 1, showIf: isTemporal },
      { ...B, id: 'pacto_complementarias', type: 'radio', options: yn, showIf: isParcial },
    ] },
    { id: 'jornada', qs: [
      { ...B, id: 'horas_contrato', type: 'number', min: 1, max: 80, step: 0.5 },
      { ...B, id: 'horas_reales', type: 'number', min: 1, max: 120, step: 0.5 },
      { ...B, id: 'dias_semana', type: 'number', min: 1, max: 7, step: 0.5 },
      { ...B, id: 'horas_max_dia', type: 'number', min: 1, max: 24, step: 0.5 },
      { ...B, id: 'horas_anuales', type: 'number', min: 1, max: 5000, step: 1, optional: true, showIf: (a) => !isParcial(a) },
      { ...B, id: 'extras_pago', type: 'radio', options: ['pagadas', 'descanso', 'no', 'nose'],
        showIf: (a) => !isParcial(a) && typeof a.horas_reales === 'number' && typeof a.horas_contrato === 'number' && a.horas_reales - a.horas_contrato > 0.5 },
      { ...B, id: 'pausa', type: 'radio', options: ['si', 'no', 'no_aplica'] },
    ] },
    { id: 'noche', qs: [
      { ...B, id: 'horas_nocturnas', type: 'number', min: 0, max: 80, step: 0.5 },
      { ...B, id: 'plus_nocturnidad', type: 'radio', options: yn, showIf: (a) => a.horas_nocturnas > 0 },
      { ...B, id: 'nocturno_habitual', type: 'radio', options: ['si', 'no'], showIf: (a) => a.horas_nocturnas > 0 },
    ] },
    { id: 'festivos', qs: [
      { ...B, id: 'festivos_trabajados', type: 'number', min: 0, max: 20, step: 1 },
      { ...B, id: 'festivos_compensacion', type: 'radio', options: ['recargo', 'descanso', 'ambos', 'nada', 'nose'], showIf: (a) => a.festivos_trabajados > 0 },
    ] },
    { id: 'descansos', qs: [
      { ...B, id: 'descanso_entre', type: 'number', min: 0, max: 48, step: 0.5 },
      { ...B, id: 'descanso_motivo', type: 'radio', options: ['habitual', 'cambio_turno', 'nose'], showIf: (a) => typeof a.descanso_entre === 'number' && a.descanso_entre < 12 },
      { ...B, id: 'dias_libres_14', type: 'number', min: 0, max: 14, step: 0.5 },
      { ...B, id: 'vacaciones_dias', type: 'number', min: 0, max: 60, step: 1 },
      { ...B, id: 'vacaciones_pagadas', type: 'radio', options: ['si', 'no'] },
      { ...B, id: 'pagas_extra', type: 'number', min: 0, max: 6, step: 1 },
    ] },
    { id: 'registro', qs: [
      { ...B, id: 'registro', type: 'radio', options: ['si_accedo', 'si_no_accedo', 'no', 'nose'] },
      { ...B, id: 'resumen_mensual', type: 'radio', options: yn, showIf: isParcial },
    ] },
  ];
}

export function render(root, { data, state, rerender }) {
  const S = state.auditoria;
  const all = steps(data.convenio);

  root.append(
    h('p', { class: 'eyebrow no-print' }, t('audit.eyebrow')),
    h('h1', { id: 'h-auditoria', class: 'no-print' }, t('audit.h1')),
    disclaimer('disclaimer.auditoria'));

  if (S.showReport) { renderReport(root, { data, state, rerender, all }); return; }

  root.append(h('p', { class: 'lead' }, t('audit.lead')));

  const total = all.length;
  const step = all[Math.min(S.step, total - 1)];
  const titleId = 'audit-step-title';

  root.append(
    h('ol', { class: 'progress', 'aria-hidden': 'true' },
      all.map((s, i) => h('li', { class: i < S.step ? 'done' : i === S.step ? 'current' : null }))),
    h('p', { class: 'progress-label' }, t('audit.progress', { n: S.step + 1, total, title: t(`audit.steps.${step.id}`) })),
    h('h2', { id: titleId, tabindex: '-1' }, t(`audit.steps.${step.id}`)));

  const form = h('div', { class: 'step', role: 'group', 'aria-labelledby': titleId });
  const onChange = () => applyVisibility(form, step.qs, S.answers);
  for (const q of step.qs) form.append(field(q, S.answers, onChange));
  root.append(form);
  applyVisibility(form, step.qs, S.answers);

  const go = (delta) => {
    S.step = Math.max(0, Math.min(total - 1, S.step + delta));
    rerender();
    document.getElementById(titleId)?.focus();
  };

  root.append(h('div', { class: 'btn-row' },
    S.step > 0 ? h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => go(-1) }, t('audit.prev')) : null,
    h('span', { class: 'spacer' }),
    S.step < total - 1
      ? h('button', { type: 'button', class: 'btn', onclick: () => go(1) }, t('audit.next'))
      : h('button', { type: 'button', class: 'btn btn-brass', onclick: () => {
        S.showReport = true;
        rerender();
        document.getElementById('report-title')?.focus();
        announce(t('audit.report.title'));
      } }, t('audit.see_report'))));
}

function renderReport(root, { data, state, rerender, all }) {
  const S = state.auditoria;
  const qs = all.flatMap((s) => s.qs);
  const answers = visibleAnswers(qs, S.answers);
  const findings = evaluarAuditoria(answers, data.convenio);
  const sum = resumen(findings);

  root.append(printHeader('audit.report.title', data.convenio));

  const head = h('section', { class: 'report-head', 'aria-labelledby': 'report-title' },
    h('h2', { id: 'report-title', tabindex: '-1' }, t('audit.report.title')),
    h('p', null, t('audit.report.intro')),
    h('ul', { class: 'report-summary' },
      h('li', null, stamp('grave'), t('audit.report.summary_grave', { n: sum.grave })),
      h('li', null, stamp('revisable'), t('audit.report.summary_revisable', { n: sum.revisable })),
      h('li', null, stamp('correcto'), t('audit.report.summary_correcto', { n: sum.correcto }))),
    h('p', { class: 'q-help' }, t('audit.report.legend')));
  root.append(head);

  if (bloquesPendientes(data.convenio).length) {
    root.append(h('p', { class: 'callout callout-warn' }, t('audit.report.pending_note')));
  }

  root.append(h('div', { class: 'btn-row' },
    printButton(),
    h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { S.showReport = false; rerender(); } }, t('audit.edit'))));

  if (!findings.length) {
    root.append(h('p', { class: 'callout' }, t('audit.report.empty')));
  } else {
    root.append(h('ol', { class: 'findings' }, findings.map((f) => {
      const vars = fmtVars(f.vars);
      const base = `audit.findings.${f.key}`;
      return h('li', { class: `finding sev-${f.sev}` },
        h('div', { class: 'finding-head' },
          h('h3', null, t(`${base}.title`, vars)),
          stamp(f.sev)),
        h('p', null, t(`${base}.body`, vars)),
        citeList(f.cites));
    })));
  }

  // Resumen de respuestas (útil en el PDF)
  const rows = [];
  for (const s of all) {
    for (const q of s.qs) {
      if (q.showIf && !q.showIf(S.answers)) continue;
      const v = answers[q.id];
      rows.push(h('tr', null,
        h('th', { scope: 'row' }, t(`audit.q.${q.id}.label`)),
        h('td', null, v === undefined ? h('span', { class: 'pending-tag' }, t('audit.report.not_answered')) : answerLabel(q, v))));
    }
  }
  root.append(h('details', { class: 'card', open: true },
    h('summary', null, h('strong', null, t('audit.report.answers_title'))),
    h('div', { class: 'table-wrap' }, h('table', { class: 'calc' }, h('tbody', null, rows)))));

  root.append(
    h('section', { class: 'card no-print' },
      h('h2', null, t('audit.report.next_title')),
      h('p', null, t('audit.report.next_body')),
      h('div', { class: 'btn-row' },
        h('a', { class: 'btn', href: '#que-hacer' }, t('audit.go_que_hacer')),
        h('a', { class: 'btn btn-ghost', href: '#nomina' }, t('audit.go_nomina')))),
    h('div', { class: 'btn-row' },
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => {
        S.answers = {}; S.step = 0; S.showReport = false; rerender();
      } }, t('audit.restart'))));
}

function answerLabel(q, v) {
  if (q.type === 'number') {
    const unitKey = `audit.q.${q.id}.unit`;
    const unit = t(unitKey);
    return unit === unitKey ? String(v) : `${v} ${unit}`;
  }
  if (q.type === 'select') return q.options.find((o) => o.value === v)?.label ?? v;
  const k = `audit.o.${q.id}.${v}`;
  const s = t(k);
  return s === k ? t(`opt.${v}`) : s;
}
