// Verificador de nómina. Funciones puras. ESTIMACIÓN ORIENTATIVA.
// Ninguna cifra del convenio está aquí: todo sale de convenio.json y fiscal-2026.json.
import { num, resolveCategoria, plusCalculable, plusExiste } from './convenio.js';

export const ET_JORNADA_COMPLETA = 40; // art. 34.1 ET: se usa solo si el convenio no fija jornada semanal
const SEMANAS_MES = 52 / 12;

const r2 = (x) => Math.round(x * 100) / 100;

/** Importe de un plus según su tipo. Devuelve null si no se puede calcular. */
export function importePlus(p, { horas = 0, dias = 0, precioHora = 0, salarioBase = 0, coef = 1 } = {}) {
  if (!plusCalculable(p)) return null;
  const v = p.valor;
  const prop = p.proporcional_jornada ? coef : 1;
  switch (p.tipo) {
    case 'importe_hora': return r2(v * horas);
    case 'importe_dia': return r2(v * dias);
    case 'importe_mensual': return r2(v * prop);
    case 'porcentaje_salario_base':
      // Recargo sobre la hora ordinaria si hay horas; si no, porcentaje del salario base del mes.
      return horas > 0 ? r2(precioHora * (v / 100) * horas) : r2(salarioBase * (v / 100) * prop);
    default: return null;
  }
}

function escala(base, tramos) {
  let cuota = 0;
  let desde = 0;
  for (const { hasta, tipo } of tramos) {
    const tope = hasta === null ? Infinity : hasta;
    if (base > desde) cuota += (Math.min(base, tope) - desde) * (tipo / 100);
    if (base <= tope) break;
    desde = tope;
  }
  return cuota;
}

export function reduccionTrabajo(rn, r) {
  if (rn <= r.umbral_inferior) return r.importe_maximo;
  if (rn <= r.umbral_medio) return Math.max(0, r.importe_maximo - r.coef_tramo_1 * (rn - r.umbral_inferior));
  if (rn <= r.umbral_superior) return Math.max(0, r.importe_tramo_2 - r.coef_tramo_2 * (rn - r.umbral_medio));
  return 0;
}

function irpfParamsOk(f) {
  const i = f?.irpf;
  if (!i || !Array.isArray(i.escala_retencion) || !i.escala_retencion.length) return false;
  const r = i.reduccion_rendimientos_trabajo || {};
  return [i.minimo_personal, i.otros_gastos_deducibles, r.umbral_inferior, r.importe_maximo, r.umbral_medio,
    r.coef_tramo_1, r.importe_tramo_2, r.umbral_superior, r.coef_tramo_2].every((x) => num(x) !== null);
}

/**
 * Estimación simplificada del tipo de retención (procedimiento general, contribuyente sin
 * descendientes ni otras circunstancias). Devuelve null si faltan parámetros.
 */
export function estimarIRPF(brutoAnual, cotAnual, fiscal, { contratoInferiorAnio = false } = {}) {
  if (!irpfParamsOk(fiscal)) return null;
  const i = fiscal.irpf;
  const rn = Math.max(0, brutoAnual - cotAnual);
  const reduccion = reduccionTrabajo(rn, i.reduccion_rendimientos_trabajo);
  const base = Math.max(0, rn - i.otros_gastos_deducibles - reduccion);
  let cuota = Math.max(0, escala(base, i.escala_retencion) - escala(i.minimo_personal, i.escala_retencion));
  const limite = num(i.limite_excluyente_sin_hijos);
  const notas = [];
  if (limite !== null) {
    if (brutoAnual <= limite) cuota = 0;
    else if (num(i.limite_cuota_porcentaje) !== null) {
      cuota = Math.min(cuota, (brutoAnual - limite) * (i.limite_cuota_porcentaje / 100));
    }
  } else {
    notas.push('irpf_sin_limite_excluyente');
  }
  let tipo = brutoAnual > 0 ? Math.round((cuota / brutoAnual) * 10000) / 100 : 0;
  const minTemp = num(i.tipo_minimo_contrato_inferior_anio);
  if (contratoInferiorAnio && minTemp !== null && tipo < minTemp && (limite === null || brutoAnual > limite)) {
    tipo = minTemp;
    notas.push('irpf_minimo_temporal');
  }
  return { tipo, base: r2(base), reduccion: r2(reduccion), rn: r2(rn), cuota: r2(cuota), notas };
}

function compara(cobrado, esperado) {
  if (num(cobrado) === null || !esperado) return null;
  const diff = r2(cobrado - esperado);
  const pct = (diff / esperado) * 100;
  let sev = 'correcto';
  if (pct < -5) sev = 'grave';
  else if (pct < -1) sev = 'revisable';
  return { cobrado, esperado: r2(esperado), diff, pct: Math.round(pct * 10) / 10, sev };
}

/**
 * inp: {
 *   categoria, horas_contrato, contrato: 'indefinido'|'fijo_discontinuo'|'temporal',
 *   contrato_inferior_anio: bool, prorrata: bool,
 *   horas_nocturnas_mes, festivos_mes, horas_festivos_mes, dias_trabajados_mes,
 *   neto_cobrado, bruto_nomina, irpf_nomina
 * }
 */
export function calcularNomina(inp, conv, fiscal) {
  const out = { faltan: [], pendientes: [], notas: [], lineas: [], cotizaciones: [] };
  const cat = resolveCategoria(conv, inp.categoria);
  if (!cat) { out.faltan.push('categoria'); return out; }

  const hc = num(inp.horas_contrato);
  if (hc === null || hc <= 0) { out.faltan.push('horas_contrato'); return out; }

  const sb = cat.salario_base_mensual;
  if (sb === null) out.faltan.push(`categorias[${cat.id}].salario_base_mensual`);

  const pe = cat.pagas_extra || {};
  const nPagas = num(pe.numero);
  if (nPagas === null) out.faltan.push('comun.pagas_extra.numero');
  if (!pe.base_calculo) out.faltan.push('comun.pagas_extra.base_calculo');
  if (pe.base_calculo === 'importe_fijo' && num(pe.importe_fijo) === null) out.faltan.push('comun.pagas_extra.importe_fijo');
  if (out.faltan.length) return out;

  let jc = cat.jornada_semanal_horas;
  if (jc === null) { jc = ET_JORNADA_COMPLETA; out.notas.push('jornada_supuesta_40'); }
  const coef = Math.min(hc / jc, 1);
  out.coef = coef;
  out.jornadaCompleta = jc;

  const base = r2(sb * coef);
  out.lineas.push({ key: 'salario_base', importe: base, vars: { tabla: sb, pct: Math.round(coef * 1000) / 10 } });

  const precioHora = sb / (jc * SEMANAS_MES);
  const ctx = { precioHora, salarioBase: base, coef };

  const hn = num(inp.horas_nocturnas_mes) ?? 0;
  if (hn > 0) addPlus(out, 'nocturnidad', cat.pluses.nocturnidad, { ...ctx, horas: hn }, { horas: hn });

  const fd = num(inp.festivos_mes) ?? 0;
  const fh = num(inp.horas_festivos_mes) ?? 0;
  if (fd > 0 || fh > 0) addPlus(out, 'festivos', cat.pluses.festivos, { ...ctx, horas: fh, dias: fd }, { dias: fd, horas: fh });

  const dt = num(inp.dias_trabajados_mes) ?? 0;
  addPlus(out, 'transporte', cat.pluses.transporte, { ...ctx, dias: dt }, { dias: dt }, { silentIfMissing: false });
  addPlus(out, 'manutencion', cat.pluses.manutencion, { ...ctx, dias: dt }, { dias: dt }, { silentIfMissing: false });

  const devengos = r2(out.lineas.reduce((s, l) => s + l.importe, 0));

  // Pagas extra
  let importePaga;
  if (pe.base_calculo === 'importe_fijo') importePaga = r2(pe.importe_fijo * coef);
  else {
    importePaga = base;
    if (pe.base_calculo === 'salario_base_mas_antiguedad') out.notas.push('pagas_sin_antiguedad');
  }
  const prorrata = r2((nPagas * importePaga) / 12);
  out.pagas = { numero: nPagas, importe: importePaga, prorrata, fechas: pe.pagas || [] };

  const brutoMes = r2(devengos + (inp.prorrata ? prorrata : 0));
  out.devengos = devengos;
  out.brutoMes = brutoMes;

  // Cotización: la prorrata de pagas extra cotiza siempre, se cobre o no prorrateada.
  let baseCot = r2(devengos + prorrata);
  const bases = fiscal?.seguridad_social?.bases || {};
  const bmax = num(bases.base_maxima_mensual);
  const bmin = num(bases.base_minima_mensual);
  if (bmax !== null && baseCot > bmax) { baseCot = bmax; out.notas.push('base_maxima'); }
  if (bmin !== null && coef >= 1 && baseCot < bmin) { baseCot = bmin; out.notas.push('base_minima'); }
  if (bmax === null || bmin === null) out.pendientes.push('fiscal:seguridad_social.bases');
  out.baseCotizacion = baseCot;

  const tipos = fiscal?.seguridad_social?.tipos_trabajador || {};
  const desempleoKey = inp.contrato === 'temporal' ? 'desempleo_temporal' : 'desempleo_indefinido';
  for (const [key, tk] of [['cc', 'contingencias_comunes'], ['desempleo', desempleoKey], ['fp', 'formacion_profesional'], ['mei', 'mei']]) {
    const tipo = num(tipos[tk]);
    if (tipo === null) { out.pendientes.push(`fiscal:seguridad_social.tipos_trabajador.${tk}`); continue; }
    out.cotizaciones.push({ key, tipo, importe: r2(baseCot * (tipo / 100)) });
  }
  const totalCot = r2(out.cotizaciones.reduce((s, c) => s + c.importe, 0));
  out.totalCotizacion = totalCot;

  // IRPF
  const brutoAnual = r2(devengos * 12 + nPagas * importePaga);
  out.brutoAnual = brutoAnual;
  const est = estimarIRPF(brutoAnual, totalCot * 12, fiscal, { contratoInferiorAnio: !!inp.contrato_inferior_anio });
  out.irpfEstimado = est;
  if (est) out.notas.push(...est.notas);
  const irpfNomina = num(inp.irpf_nomina);
  let tipoIrpf = null;
  let irpfFuente = null;
  if (irpfNomina !== null) { tipoIrpf = irpfNomina; irpfFuente = 'nomina'; }
  else if (est) { tipoIrpf = est.tipo; irpfFuente = 'estimado'; }
  else out.pendientes.push('fiscal:irpf');
  out.irpf = tipoIrpf === null ? null : { tipo: tipoIrpf, fuente: irpfFuente, importe: r2(brutoMes * (tipoIrpf / 100)) };

  out.netoMes = r2(brutoMes - totalCot - (out.irpf ? out.irpf.importe : 0));

  // SMI (art. 27 ET): salario de tabla a jornada completa frente al SMI anual
  const smiAnual = num(fiscal?.salario_minimo?.anual);
  if (smiAnual !== null) {
    const tablaAnualCompleta = sb * 12 + nPagas * (pe.base_calculo === 'importe_fijo' ? pe.importe_fijo : sb);
    if (tablaAnualCompleta < smiAnual) out.bajoSMI = { tabla: r2(tablaAnualCompleta), smi: smiAnual };
  } else {
    out.pendientes.push('fiscal:salario_minimo');
  }

  out.comparaNeto = compara(num(inp.neto_cobrado), out.netoMes);
  out.comparaBruto = compara(num(inp.bruto_nomina), brutoMes);
  return out;
}

function addPlus(out, key, p, ctx, vars, { silentIfMissing = false } = {}) {
  if (p && p.tipo === 'no_existe') return;
  if (!plusCalculable(p)) {
    if (!silentIfMissing) out.pendientes.push(`plus:${key}`);
    return;
  }
  const importe = importePlus(p, ctx);
  if (importe === null) { out.pendientes.push(`plus:${key}`); return; }
  if (importe === 0 && !plusExiste(p)) return;
  out.lineas.push({ key: `plus_${key}`, importe, vars: { ...vars, tipo: p.tipo, valor: p.valor } });
}
