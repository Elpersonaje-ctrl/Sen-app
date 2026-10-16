import { t, tl } from '../i18n.js';
import { h, disclaimer, stamp, printButton, printHeader, fmtEUR, fmtPct, fmtNum, announce } from '../ui.js';
import { field, applyVisibility, visibleAnswers } from '../fields.js';
import { calcularNomina } from '../logic/nomina-calc.js';

const B = { base: 'nomina.q', optBase: 'nomina.o' };

function questions(convenio) {
  const cats = convenio.categorias.map((c) => ({ value: c.id, label: tl(c.nombre) }));
  return {
    puesto: [
      { ...B, id: 'categoria', type: 'select', options: cats },
      { ...B, id: 'contrato', type: 'radio', options: ['indefinido', 'fijo_discontinuo', 'temporal'] },
      { ...B, id: 'contrato_inferior_anio', type: 'radio', options: ['si', 'no'], showIf: (a) => a.contrato === 'temporal' },
      { ...B, id: 'horas_contrato', type: 'number', min: 1, max: 40, step: 0.5 },
      { ...B, id: 'prorrata', type: 'radio', options: ['si', 'no'] },
    ],
    mes: [
      { ...B, id: 'horas_nocturnas_mes', type: 'number', min: 0, max: 300, step: 0.5 },
      { ...B, id: 'festivos_mes', type: 'number', min: 0, max: 10, step: 1 },
      { ...B, id: 'horas_festivos_mes', type: 'number', min: 0, max: 120, step: 0.5, showIf: (a) => a.festivos_mes > 0 },
      { ...B, id: 'dias_trabajados_mes', type: 'number', min: 0, max: 31, step: 1 },
    ],
    cobro: [
      { ...B, id: 'neto_cobrado', type: 'number', min: 0, max: 20000, step: 0.01 },
      { ...B, id: 'bruto_nomina', type: 'number', min: 0, max: 20000, step: 0.01, optional: true },
      { ...B, id: 'irpf_nomina', type: 'number', min: 0, max: 47, step: 0.01, optional: true },
    ],
  };
}

function prefill(state) {
  const N = state.nomina.inputs;
  const A = state.auditoria.answers;
  if (Object.keys(N).length || !Object.keys(A).length) return false;
  let any = false;
  if (A.categoria) { N.categoria = A.categoria; any = true; }
  if (typeof A.horas_contrato === 'number' && A.horas_contrato <= 40) { N.horas_contrato = A.horas_contrato; any = true; }
  if (A.contrato) {
    N.contrato = A.contrato.startsWith('temporal') ? 'temporal' : A.contrato === 'fijo_discontinuo' ? 'fijo_discontinuo' : 'indefinido';
    any = true;
  }
  return any;
}

export function render(root, { data, state, rerender }) {
  const S = state.nomina;
  const Q = questions(data.convenio);
  const all = [...Q.puesto, ...Q.mes, ...Q.cobro];

  root.append(
    h('p', { class: 'eyebrow no-print' }, t('nomina.eyebrow')),
    h('h1', { id: 'h-nomina', class: 'no-print' }, t('nomina.h1')),
    disclaimer('disclaimer.nomina'));

  if (S.showResult) { renderResult(root, { data, state, rerender, all }); return; }

  root.append(h('p', { class: 'lead' }, t('nomina.lead')));
  if (prefill(state)) S.prefilled = true;
  if (S.prefilled) root.append(h('p', { class: 'callout' }, t('nomina.prefilled')));

  const form = h('div');
  const onChange = () => applyVisibility(form, all, S.inputs);
  for (const [key, qs] of [['puesto', Q.puesto], ['mes', Q.mes], ['cobro', Q.cobro]]) {
    const titleId = `nomina-fs-${key}`;
    const sec = h('section', { class: 'card', 'aria-labelledby': titleId }, h('h2', { id: titleId }, t(`nomina.fs_${key}`)));
    for (const q of qs) sec.append(field(q, S.inputs, onChange));
    form.append(sec);
  }
  root.append(form);
  applyVisibility(form, all, S.inputs);

  root.append(h('div', { class: 'btn-row' },
    h('button', { type: 'button', class: 'btn btn-brass', onclick: () => {
      S.showResult = true;
      rerender();
      document.getElementById('nomina-result-title')?.focus();
      announce(t('nomina.result.title'));
    } }, t('nomina.calc'))));
}

const pendKey = (k) => k.replace(/[^A-Za-z0-9]+/g, '_');

function faltanLabel(code) {
  if (code === 'categoria') return t('nomina.faltan.categoria');
  if (code === 'horas_contrato') return t('nomina.faltan.horas_contrato');
  if (code.endsWith('salario_base_mensual')) return t('nomina.faltan.salario_base_mensual');
  if (code.endsWith('pagas_extra.numero')) return t('nomina.faltan.pagas_numero');
  if (code.endsWith('pagas_extra.base_calculo')) return t('nomina.faltan.pagas_base_calculo');
  if (code.endsWith('pagas_extra.importe_fijo')) return t('nomina.faltan.pagas_importe_fijo');
  return code;
}

function renderResult(root, { data, state, rerender, all }) {
  const S = state.nomina;
  const a = visibleAnswers(all, S.inputs);
  const inp = {
    ...a,
    prorrata: a.prorrata === 'si',
    contrato_inferior_anio: a.contrato === 'temporal' && a.contrato_inferior_anio === 'si',
  };
  const r = calcularNomina(inp, data.convenio, data.fiscal);

  root.append(printHeader('nomina.result.title', data.convenio));
  root.append(h('div', { class: 'report-head' },
    h('div', { class: 'finding-head' },
      h('h2', { id: 'nomina-result-title', tabindex: '-1' }, t('nomina.result.title')),
      stamp('orientativo', t('nomina.result.tag')))));

  const editBtn = h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { S.showResult = false; rerender(); } }, t('nomina.edit'));

  if (r.faltan.length) {
    const userMissing = r.faltan.every((f) => f === 'categoria' || f === 'horas_contrato');
    root.append(h('section', { class: 'callout callout-warn' },
      h('h3', null, t('nomina.result.faltan_title')),
      userMissing ? null : h('p', null, t('nomina.result.faltan_body')),
      h('p', null, t('nomina.result.faltan_fields')),
      h('ul', null, r.faltan.map((f) => h('li', null, faltanLabel(f),
        f.includes('.') ? [' ', h('code', null, `data/convenio.json → ${f}`)] : null)))));
    root.append(h('div', { class: 'btn-row' }, editBtn));
    return;
  }

  root.append(h('div', { class: 'btn-row' }, printButton(), editBtn));

  // Devengos
  const devRows = r.lineas.map((l) => h('tr', null,
    h('th', { scope: 'row' }, lineLabel(l)),
    h('td', { class: 'num' }, fmtEUR(l.importe))));
  if (inp.prorrata) {
    devRows.push(h('tr', null,
      h('th', { scope: 'row' }, t('nomina.result.prorrata', { n: r.pagas.numero, importe: fmtEUR(r.pagas.importe) })),
      h('td', { class: 'num' }, fmtEUR(r.pagas.prorrata))));
  }
  devRows.push(h('tr', { class: 'total' }, h('th', { scope: 'row' }, t('nomina.result.total_bruto')), h('td', { class: 'num' }, fmtEUR(r.brutoMes))));
  root.append(h('div', { class: 'table-wrap' }, h('table', { class: 'calc' },
    h('caption', null, t('nomina.result.devengos')), h('tbody', null, devRows))));

  const fechas = (r.pagas.fechas || []).map((p) => [p.nombre, p.fecha_abono].filter(Boolean).join(': ')).filter(Boolean);
  root.append(h('p', { class: 'q-help' },
    t('nomina.result.pagas_info', { n: r.pagas.numero, importe: fmtEUR(r.pagas.importe) }),
    fechas.length ? ` ${t('nomina.result.pagas_fechas', { fechas: fechas.join(' · ') })}` : ''));

  // Deducciones
  const dedRows = [h('tr', null,
    h('th', { scope: 'row' }, h('span', { class: 'muted' }, t('nomina.result.base_cot'))),
    h('td', { class: 'num' }, h('span', { class: 'muted' }, fmtEUR(r.baseCotizacion))))];
  for (const c of r.cotizaciones) {
    dedRows.push(h('tr', null,
      h('th', { scope: 'row' }, `${t(`nomina.result.cot_${c.key}`)} (${fmtPct(c.tipo)})`),
      h('td', { class: 'num' }, fmtEUR(c.importe))));
  }
  if (r.irpf) {
    dedRows.push(h('tr', null,
      h('th', { scope: 'row' }, `${t(r.irpf.fuente === 'nomina' ? 'nomina.result.irpf_nomina' : 'nomina.result.irpf_estimado')} (${fmtPct(r.irpf.tipo)})`),
      h('td', { class: 'num' }, fmtEUR(r.irpf.importe))));
  }
  const totalDed = r.totalCotizacion + (r.irpf ? r.irpf.importe : 0);
  dedRows.push(h('tr', { class: 'total' }, h('th', { scope: 'row' }, t('nomina.result.total_deducciones')), h('td', { class: 'num' }, fmtEUR(totalDed))));
  root.append(h('div', { class: 'table-wrap' }, h('table', { class: 'calc' },
    h('caption', null, t('nomina.result.deducciones')), h('tbody', null, dedRows))));

  if (r.irpfEstimado && r.irpf?.fuente === 'estimado') {
    root.append(h('p', { class: 'q-help' }, t('nomina.result.irpf_detail', {
      rn: fmtEUR(r.irpfEstimado.rn), red: fmtEUR(r.irpfEstimado.reduccion), base: fmtEUR(r.irpfEstimado.base), tipo: fmtPct(r.irpfEstimado.tipo),
    })));
  }

  root.append(h('div', { class: 'card' },
    h('p', { class: 'q-help' }, t('nomina.result.neto')),
    h('p', { class: 'figure-big' }, fmtEUR(r.netoMes))));

  // Comparaciones
  root.append(compareBlock('nomina.result.compare_neto_title', r.comparaNeto, true));
  if (r.comparaBruto) root.append(compareBlock('nomina.result.compare_bruto_title', r.comparaBruto, false));

  if (r.bajoSMI) {
    root.append(h('p', { class: 'callout callout-danger' }, t('nomina.result.bajo_smi', { tabla: fmtEUR(r.bajoSMI.tabla), smi: fmtEUR(r.bajoSMI.smi) })));
  }

  const pend = [...new Set(r.pendientes)];
  if (pend.length) {
    root.append(h('section', { class: 'callout callout-warn' },
      h('h3', null, t('nomina.result.pendientes_title')),
      h('ul', null, pend.map((p) => h('li', null, t(`nomina.pend.${pendKey(p)}`))))));
  }

  const notas = [...new Set(r.notas)];
  root.append(h('section', { class: 'card' },
    h('h3', null, t('nomina.notas.title')),
    h('ul', null,
      notas.map((n) => h('li', null, t(`nomina.notas.${n}`))),
      h('li', null, t('nomina.notas.general')))));
}

function lineLabel(l) {
  if (l.key === 'salario_base') return t('nomina.result.salario_base', { pct: fmtNum(l.vars.pct, 1), tabla: fmtNum(l.vars.tabla, 2) });
  return t(`nomina.result.${l.key}`);
}

function compareBlock(titleKey, c, isNeto) {
  if (!c) {
    return isNeto ? h('p', { class: 'callout' }, t('nomina.result.no_compare')) : null;
  }
  const vars = { diff: fmtEUR(Math.abs(c.diff)), pct: fmtNum(Math.abs(c.pct), 1) };
  let msg;
  if (Math.abs(c.pct) <= 1) msg = t('nomina.result.compare_equal');
  else if (c.diff < 0) msg = t('nomina.result.compare_less', vars);
  else msg = t('nomina.result.compare_more', vars);
  const extra = c.sev === 'grave' ? t('nomina.result.compare_grave')
    : c.sev === 'revisable' ? t('nomina.result.compare_revisable')
      : c.diff > 0 && c.pct > 1 && isNeto ? t('nomina.result.compare_more_note') : null;
  return h('section', { class: `finding sev-${c.sev}` },
    h('div', { class: 'finding-head' }, h('h3', null, t(titleKey)), stamp(c.sev)),
    h('p', null, msg),
    extra ? h('p', null, extra) : null);
}
