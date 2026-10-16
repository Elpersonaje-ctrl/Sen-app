// Lectura del convenio.json. Funciones puras (sin DOM) para poder probarlas en Node.

export const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Combina la categoría con el bloque 'comun' (la categoría manda si tiene valor). */
export function resolveCategoria(conv, id) {
  if (!conv || !Array.isArray(conv.categorias)) return null;
  const c = conv.categorias.find((x) => x.id === id);
  if (!c) return null;
  const comun = conv.comun || {};
  const cp = c.pluses || {};
  const pp = comun.pluses || {};
  return {
    id: c.id,
    nombre: c.nombre,
    nivel: c.nivel,
    grupo_profesional: c.grupo_profesional,
    salario_base_mensual: num(c.salario_base_mensual),
    jornada_anual_horas: num(c.jornada_anual_horas) ?? num(comun.jornada?.anual_horas),
    jornada_semanal_horas: num(comun.jornada?.semanal_horas),
    diaria_max_horas: num(comun.jornada?.diaria_max_horas_ordinarias),
    vacaciones: c.vacaciones ?? comun.vacaciones ?? null,
    descanso_semanal_dias: num(comun.descanso_semanal_dias),
    pagas_extra: c.pagas_extra ?? comun.pagas_extra ?? null,
    pluses: {
      nocturnidad: cp.nocturnidad ?? pp.nocturnidad ?? null,
      festivos: cp.festivos ?? pp.festivos ?? null,
      transporte: cp.transporte ?? pp.transporte ?? null,
      manutencion: cp.manutencion ?? pp.manutencion ?? null,
    },
    horas_extra: comun.horas_extra ?? null,
  };
}

/** El convenio contempla este plus (aunque su importe pueda estar pendiente). */
export function plusExiste(p) {
  return !!p && typeof p.tipo === 'string' && p.tipo !== 'no_existe' && p.tipo !== 'no_fija_precio';
}

/** El plus está completamente cargado y se puede calcular. */
export function plusCalculable(p) {
  return plusExiste(p) && num(p.valor) !== null;
}

/** El dato del plus está cargado (existe con valor, o consta expresamente que no existe). */
export function plusCargado(p) {
  return !!p && (p.tipo === 'no_existe' || p.tipo === 'no_fija_precio' || plusCalculable(p));
}

export function articulo(conv, materia) {
  const a = conv?.articulos?.[materia];
  return a === undefined || a === '' ? null : a;
}

/** Lista de bloques marcados como pendientes (para el aviso general). */
export function bloquesPendientes(conv) {
  const out = [];
  if (!conv) return ['convenio.json'];
  if (conv.meta?._pendiente) out.push('meta');
  if (conv.articulos?._pendiente) out.push('articulos');
  const comun = conv.comun || {};
  for (const k of ['jornada', 'vacaciones', 'pagas_extra', 'horas_extra']) {
    if (comun[k]?._pendiente) out.push(`comun.${k}`);
  }
  if (comun.descanso_semanal_dias === null) out.push('comun.descanso_semanal_dias');
  for (const [k, p] of Object.entries(comun.pluses || {})) {
    if (p?._pendiente) out.push(`comun.pluses.${k}`);
  }
  for (const c of conv.categorias || []) {
    if (c._pendiente || c.salario_base_mensual === null) out.push(`categorias[${c.id}]`);
  }
  return out;
}

export function bloquesPendientesFiscal(f) {
  const out = [];
  if (!f) return ['fiscal-2026.json'];
  if (f.seguridad_social?.bases?._pendiente) out.push('seguridad_social.bases');
  if (f.salario_minimo?._pendiente) out.push('salario_minimo');
  for (const k of f.irpf?._pendiente_parcial || []) out.push(`irpf.${k}`);
  return out;
}
