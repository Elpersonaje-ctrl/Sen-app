// Pruebas de la lógica pura. Ejecutar con: node --test barra-libre/tests/
// ATENCIÓN: el convenio de prueba usa cifras FICTICIAS y redondas solo para verificar
// el cálculo. No tienen relación con el convenio real de Pontevedra.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluarAuditoria } from '../site/js/logic/auditoria-rules.js';
import { calcularNomina, estimarIRPF, reduccionTrabajo } from '../site/js/logic/nomina-calc.js';
import { resolveCategoria, bloquesPendientes } from '../site/js/logic/convenio.js';

const load = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const convenioReal = load('../site/data/convenio.json');
const fiscal = load('../site/data/fiscal-2026.json');

function convenioFicticio() {
  const c = structuredClone(convenioReal);
  c.comun.jornada.semanal_horas = 40;
  c.comun.jornada.anual_horas = 1800;
  c.comun.vacaciones = { dias: 30, tipo_dias: 'naturales' };
  c.comun.pagas_extra = { numero: 2, pagas: [{ nombre: 'A', fecha_abono: 'x' }], base_calculo: 'salario_base', prorrateables: true };
  c.comun.pluses.nocturnidad = { tipo: 'importe_hora', valor: 1, proporcional_jornada: false };
  c.comun.pluses.transporte = { tipo: 'no_existe', valor: 0 };
  c.comun.pluses.manutencion = { tipo: 'no_existe', valor: 0 };
  c.categorias.find((x) => x.id === 'camarero').salario_base_mensual = 1000;
  return c;
}

test('el convenio publicado no contiene cifras inventadas: todo pendiente', () => {
  for (const cat of convenioReal.categorias) {
    assert.equal(cat.salario_base_mensual, null, cat.id);
    assert.equal(cat.nivel, null, cat.id);
  }
  assert.equal(convenioReal.comun.jornada.anual_horas, null);
  assert.equal(convenioReal.comun.vacaciones.dias, null);
  assert.equal(convenioReal.comun.pagas_extra.numero, null);
  assert.ok(bloquesPendientes(convenioReal).length > 0);
});

test('nómina sin datos del convenio: no calcula y dice qué falta', () => {
  const r = calcularNomina({ categoria: 'camarero', horas_contrato: 40 }, convenioReal, fiscal);
  assert.ok(r.faltan.includes('categorias[camarero].salario_base_mensual'));
  assert.ok(r.faltan.includes('comun.pagas_extra.numero'));
  assert.equal(r.netoMes, undefined);
});

test('auditoría sin datos del convenio: aplica mínimos del ET y cita artículo pendiente', () => {
  const f = evaluarAuditoria({
    contrato: 'indefinido_completo', horas_contrato: 40, horas_reales: 50, extras_pago: 'no',
    descanso_entre: 8, descanso_motivo: 'habitual', vacaciones_dias: 22, registro: 'no',
  }, convenioReal);
  const keys = f.map((x) => x.key);
  assert.ok(keys.includes('extras.no_pagadas'));
  assert.ok(keys.includes('extras.mas_80'));
  assert.ok(keys.includes('entre.menos_12'));
  assert.ok(keys.includes('vac.menos_30'));
  assert.ok(keys.includes('registro.no'));
  const conv = f.find((x) => x.key === 'extras.no_pagadas').cites.find((c) => c.norma === 'convenio');
  assert.equal(conv.art, null);
  assert.equal(f[0].sev, 'grave');
  // ordenado por gravedad
  const order = { grave: 0, revisable: 1, correcto: 2 };
  for (let i = 1; i < f.length; i += 1) assert.ok(order[f[i - 1].sev] <= order[f[i].sev]);
});

test('auditoría: tiempo parcial con horas de más sin pacto es grave', () => {
  const f = evaluarAuditoria({ contrato: 'indefinido_parcial', horas_contrato: 20, horas_reales: 35, pacto_complementarias: 'no', resumen_mensual: 'no' }, convenioReal);
  const keys = f.map((x) => x.key);
  assert.ok(keys.includes('parcial.extras'));
  assert.ok(keys.includes('parcial.resumen'));
});

test('auditoría: descanso reducido por cambio de turno ≥ 7 h es revisable', () => {
  const f = evaluarAuditoria({ descanso_entre: 9, descanso_motivo: 'cambio_turno' }, convenioReal);
  assert.equal(f[0].key, 'entre.cambio_turno');
  assert.equal(f[0].sev, 'revisable');
});

test('auditoría: nocturnidad sin plus es grave solo si el convenio contempla el plus', () => {
  const a = { horas_nocturnas: 10, plus_nocturnidad: 'no' };
  assert.equal(evaluarAuditoria(a, convenioReal)[0].key, 'noct.sin_plus');
  assert.equal(evaluarAuditoria(a, convenioFicticio())[0].key, 'noct.sin_plus_convenio');
});

test('auditoría: compara con jornada anual del convenio cuando está cargada', () => {
  const f = evaluarAuditoria({ contrato: 'indefinido_completo', horas_contrato: 40, horas_reales: 45, extras_pago: 'pagadas' }, convenioFicticio());
  assert.ok(f.some((x) => x.key === 'anual.excede'));
});

test('resolveCategoria hereda de comun', () => {
  const c = resolveCategoria(convenioFicticio(), 'camarero');
  assert.equal(c.salario_base_mensual, 1000);
  assert.equal(c.jornada_anual_horas, 1800);
  assert.equal(c.pagas_extra.numero, 2);
});

test('reducción por rendimientos del trabajo', () => {
  const r = fiscal.irpf.reduccion_rendimientos_trabajo;
  assert.equal(reduccionTrabajo(10000, r), r.importe_maximo);
  assert.equal(reduccionTrabajo(30000, r), 0);
  const mid = reduccionTrabajo(16000, r);
  assert.ok(mid < r.importe_maximo && mid > 0);
});

test('IRPF estimado: 0 por debajo del mínimo, positivo y < 15 % en salario medio', () => {
  assert.equal(estimarIRPF(8000, 520, fiscal).tipo, 0);
  const e = estimarIRPF(18000, 1170, fiscal);
  assert.ok(e.tipo > 0 && e.tipo < 15, String(e.tipo));
});

test('nómina con convenio ficticio: cálculo completo', () => {
  const r = calcularNomina({
    categoria: 'camarero', horas_contrato: 20, contrato: 'temporal', prorrata: true,
    horas_nocturnas_mes: 10, neto_cobrado: 500,
  }, convenioFicticio(), fiscal);
  assert.deepEqual(r.faltan, []);
  assert.equal(r.coef, 0.5);
  assert.equal(r.lineas[0].importe, 500); // 1000 × 50 %
  assert.equal(r.lineas.find((l) => l.key === 'plus_nocturnidad').importe, 10);
  assert.equal(r.pagas.prorrata, 83.33); // 2 × 500 / 12
  assert.equal(r.brutoMes, 593.33);
  assert.equal(r.baseCotizacion, 593.33);
  const des = r.cotizaciones.find((c) => c.key === 'desempleo');
  assert.equal(des.tipo, 1.6);
  assert.ok(r.netoMes > 0 && r.netoMes < r.brutoMes);
  assert.ok(r.comparaNeto);
  assert.ok(r.pendientes.includes('fiscal:seguridad_social.bases'));
});

test('nómina: IRPF de la nómina sustituye al estimado', () => {
  const r = calcularNomina({ categoria: 'camarero', horas_contrato: 40, contrato: 'indefinido', irpf_nomina: 10 }, convenioFicticio(), fiscal);
  assert.equal(r.irpf.fuente, 'nomina');
  assert.equal(r.irpf.importe, 100);
});

test('i18n: es y gl tienen exactamente las mismas claves', () => {
  const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
  const es = new Set(keys(load('../site/i18n/es.json')));
  const gl = new Set(keys(load('../site/i18n/gl.json')));
  assert.deepEqual([...es].filter((k) => !gl.has(k)), []);
  assert.deepEqual([...gl].filter((k) => !es.has(k)), []);
});

test('i18n: cada hallazgo posible tiene título y texto', async () => {
  const es = load('../site/i18n/es.json');
  const src = readFileSync(new URL('../site/js/logic/auditoria-rules.js', import.meta.url), 'utf8');
  const used = [...src.matchAll(/add\('\w+', '([\w.]+)'/g)].map((m) => m[1]);
  assert.ok(used.length > 30);
  for (const k of used) {
    const node = k.split('.').reduce((o, p) => o?.[p], es.audit.findings);
    assert.ok(node?.title && node?.body, k);
  }
});

test('dudas: todos los nodos enlazados existen y las respuestas son bilingües', () => {
  const d = load('../site/content/dudas.json');
  for (const tema of d.temas) assert.ok(d.nodos[tema.inicio], tema.id);
  for (const [id, n] of Object.entries(d.nodos)) {
    if (n.opciones) for (const o of n.opciones) assert.ok(d.nodos[o.ir], `${id} → ${o.ir}`);
    else assert.ok(n.respuesta.es.length && n.respuesta.gl.length === n.respuesta.es.length, id);
  }
});
