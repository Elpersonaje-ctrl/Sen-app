// Reglas de la auditoría. Funciones puras: reciben respuestas + convenio y devuelven hallazgos.
// Cada hallazgo: { sev: 'grave'|'revisable'|'correcto', key, vars, cites: [{norma, art}] }
// Los textos están en i18n bajo audit.findings.<key>.title / .body.
// Ninguna cifra del convenio está escrita aquí: se leen de convenio.json y, si faltan, se dice.
import { num, resolveCategoria, plusExiste, articulo } from './convenio.js';

export const ET_JORNADA_MAX_SEMANAL = 40;   // art. 34.1 ET
export const ET_DIARIA_MAX = 9;             // art. 34.3 ET
export const ET_DESCANSO_ENTRE = 12;        // art. 34.3 ET
export const RD1561_MIN_CAMBIO_TURNO = 7;   // art. 19.2 RD 1561/1995
export const ET_HORAS_EXTRA_MAX = 80;       // art. 35.2 ET
export const ET_VACACIONES_MIN = 30;        // art. 38.1 ET (días naturales)
export const ET_PAGAS_MIN = 2;              // art. 31 ET
export const ET_DESCANSO_14D = 3;           // art. 37.1 ET: 1,5 días/semana acumulables en 14 días
export const ET_NOCTURNO_MAX_MEDIA = 8;     // art. 36.1 ET
export const ET_TEMPORAL_ENCADENAMIENTO = 18; // art. 15.5 ET (meses en 24)
export const ET_PRODUCCION_MAX = 6;         // art. 15.2 ET
export const ET_PRODUCCION_MAX_CONVENIO = 12; // art. 15.2 ET (ampliable por convenio sectorial)
export const ET_COMPLEMENTARIAS_MAX = 0.6;  // art. 12.5.c ET (tope máximo vía convenio)

const ORDER = { grave: 0, revisable: 1, correcto: 2 };

const et = (art) => ({ norma: 'et', art });
const rd1561 = (art) => ({ norma: 'rd1561', art });
const rd2001 = (art) => ({ norma: 'rd2001', art });
const lgss = (art) => ({ norma: 'lgss', art });

const round1 = (x) => Math.round(x * 10) / 10;

export function semanasEfectivas(vacacionesDias) {
  const v = num(vacacionesDias) ?? ET_VACACIONES_MIN;
  return 52 - v / 7;
}

export function evaluarAuditoria(a, conv) {
  const F = [];
  const add = (sev, key, vars, cites) => F.push({ sev, key, vars: vars || {}, cites: cites || [] });
  const conA = (materia) => ({ norma: 'convenio', art: articulo(conv, materia) });

  const cat = resolveCategoria(conv, a.categoria);
  const contrato = a.contrato || null;
  const parcial = !!contrato && contrato.endsWith('parcial');
  const temporal = !!contrato && contrato.startsWith('temporal');
  const semanas = semanasEfectivas(a.vacaciones_dias);

  const hc = num(a.horas_contrato);
  const hr = num(a.horas_reales);
  const dias = num(a.dias_semana);

  // --- Alta y contrato ---
  if (a.alta === 'no') add('grave', 'alta.no', {}, [lgss('139'), et('8.2')]);
  else if (a.alta === 'nose') add('revisable', 'alta.nose', {}, [lgss('139')]);
  else if (a.alta === 'si') add('correcto', 'alta.si', {}, [lgss('139')]);

  // --- Jornada pactada ---
  const anualConvenio = cat ? cat.jornada_anual_horas : num(conv?.comun?.jornada?.anual_horas);
  if (hc !== null) {
    if (hc > ET_JORNADA_MAX_SEMANAL) {
      add('grave', 'contrato.excede_40', { horas: hc }, [et('34.1'), conA('jornada')]);
    } else if (!parcial && anualConvenio !== null && hc * semanas > anualConvenio + 1) {
      add('grave', 'contrato.excede_convenio',
        { anual: Math.round(hc * semanas), convenio: anualConvenio }, [conA('jornada'), et('34.1')]);
    } else if (anualConvenio === null) {
      add('correcto', 'contrato.ok_pendiente', { horas: hc }, [et('34.1'), conA('jornada')]);
    } else {
      add('correcto', 'contrato.ok', { horas: hc, convenio: anualConvenio }, [et('34.1'), conA('jornada')]);
    }
  }

  // --- Horas por encima del contrato ---
  const nocturnoHabitual = a.nocturno_habitual === 'si';
  if (hc !== null && hr !== null) {
    const extraSem = hr - hc;
    if (extraSem <= 0.5) {
      add('correcto', 'extras.no', { horas: hr }, [et('35')]);
    } else if (parcial) {
      if (a.pacto_complementarias === 'si') {
        if (extraSem > hc * ET_COMPLEMENTARIAS_MAX) {
          add('grave', 'parcial.complementarias_exceso',
            { extra: round1(extraSem), contrato: hc, pct: Math.round((extraSem / hc) * 100) },
            [et('12.5.c'), conA('contratacion')]);
        } else {
          add('revisable', 'parcial.complementarias_pacto',
            { extra: round1(extraSem), pct: Math.round((extraSem / hc) * 100) },
            [et('12.5'), conA('contratacion')]);
        }
      } else {
        add('grave', 'parcial.extras', { extra: round1(extraSem) }, [et('12.4.c'), et('12.5')]);
      }
    } else {
      const anual = Math.round(extraSem * semanas);
      if (anual > ET_HORAS_EXTRA_MAX) {
        add('grave', 'extras.mas_80', { anual, semanal: round1(extraSem) }, [et('35.2')]);
      }
      if (a.extras_pago === 'no') {
        add('grave', 'extras.no_pagadas', { semanal: round1(extraSem), anual }, [et('35.1'), conA('horas_extra')]);
      } else if (a.extras_pago === 'nose' || !a.extras_pago) {
        add('revisable', 'extras.pago_nose', { semanal: round1(extraSem), anual }, [et('35.1'), et('35.5'), conA('horas_extra')]);
      } else if (anual <= ET_HORAS_EXTRA_MAX) {
        add('correcto', 'extras.ok', { semanal: round1(extraSem), anual }, [et('35.1'), et('35.2')]);
      }
      if (nocturnoHabitual) add('grave', 'noct.extras', { semanal: round1(extraSem) }, [et('36.1')]);
    }

    // Jornada real anual frente a la del convenio
    if (!parcial && anualConvenio !== null) {
      const realAnual = num(a.horas_anuales) ?? round1(hr * semanas);
      if (realAnual > anualConvenio + 1) {
        add('revisable', 'anual.excede', { real: Math.round(realAnual), convenio: anualConvenio, diff: Math.round(realAnual - anualConvenio) },
          [conA('jornada'), et('34.1'), et('35.1')]);
      }
    }
  }

  // --- Jornada diaria ---
  const hmax = num(a.horas_max_dia);
  const diariaMax = cat?.diaria_max_horas ?? num(conv?.comun?.jornada?.diaria_max_horas_ordinarias) ?? ET_DIARIA_MAX;
  if (hmax !== null) {
    if (hmax > diariaMax) add('revisable', 'diaria.excede', { horas: hmax, max: diariaMax }, [et('34.3'), conA('distribucion_jornada')]);
    else add('correcto', 'diaria.ok', { horas: hmax, max: diariaMax }, [et('34.3')]);
  }

  // --- Pausa en jornada continuada ---
  if (a.pausa === 'no') add('grave', 'pausa.no', {}, [et('34.4')]);
  else if (a.pausa === 'si') add('correcto', 'pausa.si', {}, [et('34.4')]);

  // --- Nocturnidad ---
  const hn = num(a.horas_nocturnas);
  if (hn !== null && hn > 0) {
    const plusConvenio = plusExiste(cat?.pluses?.nocturnidad ?? conv?.comun?.pluses?.nocturnidad);
    if (a.plus_nocturnidad === 'no') {
      if (plusConvenio) add('grave', 'noct.sin_plus_convenio', { horas: hn }, [et('36.2'), conA('nocturnidad')]);
      else add('revisable', 'noct.sin_plus', { horas: hn }, [et('36.2'), conA('nocturnidad')]);
    } else if (a.plus_nocturnidad === 'nose') {
      add('revisable', 'noct.nose', { horas: hn }, [et('36.2'), conA('nocturnidad')]);
    } else if (a.plus_nocturnidad === 'si') {
      add('correcto', 'noct.ok', { horas: hn }, [et('36.2'), conA('nocturnidad')]);
    }
  }
  if (nocturnoHabitual && hr !== null && dias) {
    const media = hr / dias;
    if (media > ET_NOCTURNO_MAX_MEDIA) add('grave', 'noct.mas_8', { media: round1(media) }, [et('36.1')]);
  }

  // --- Festivos ---
  const ft = num(a.festivos_trabajados);
  if (ft !== null && ft > 0) {
    const c = a.festivos_compensacion;
    const cites = [et('37.2'), rd2001('47'), conA('festivos')];
    if (c === 'nada') add('grave', 'fest.nada', { dias: ft }, cites);
    else if (c === 'nose' || !c) add('revisable', 'fest.nose', { dias: ft }, cites);
    else add('correcto', 'fest.ok', { dias: ft }, cites);
  }

  // --- Descanso entre jornadas ---
  const de = num(a.descanso_entre);
  if (de !== null) {
    if (de >= ET_DESCANSO_ENTRE) {
      add('correcto', 'entre.ok', { horas: de }, [et('34.3')]);
    } else if (a.descanso_motivo === 'cambio_turno' && de >= RD1561_MIN_CAMBIO_TURNO) {
      add('revisable', 'entre.cambio_turno', { horas: de }, [et('34.3'), rd1561('19.2')]);
    } else {
      add('grave', 'entre.menos_12', { horas: de }, [et('34.3'), rd1561('19.2'), conA('descanso_entre_jornadas')]);
    }
  }

  // --- Descanso semanal ---
  const dl = num(a.dias_libres_14);
  if (dl !== null) {
    const semConv = cat?.descanso_semanal_dias ?? num(conv?.comun?.descanso_semanal_dias);
    const minConv = semConv !== null ? semConv * 2 : null;
    if (dl < 2) {
      add('grave', 'semanal.minimo', { dias: dl }, [et('37.1'), conA('descanso_semanal')]);
    } else if (minConv !== null && dl < minConv) {
      add('grave', 'semanal.bajo_convenio', { dias: dl, convenio: minConv }, [conA('descanso_semanal'), et('37.1')]);
    } else if (dl < ET_DESCANSO_14D) {
      add('revisable', 'semanal.acumulable', { dias: dl }, [et('37.1'), rd1561('6'), conA('descanso_semanal')]);
    } else {
      add('correcto', 'semanal.ok', { dias: dl }, [et('37.1'), conA('descanso_semanal')]);
    }
  }

  // --- Vacaciones ---
  const vd = num(a.vacaciones_dias);
  if (vd !== null) {
    const vc = cat?.vacaciones ?? conv?.comun?.vacaciones;
    const vcDias = num(vc?.dias);
    if (vd < ET_VACACIONES_MIN) {
      add('grave', 'vac.menos_30', { dias: vd }, [et('38.1'), conA('vacaciones')]);
    } else if (vcDias !== null && vc.tipo_dias === 'naturales' && vd < vcDias) {
      add('grave', 'vac.bajo_convenio', { dias: vd, convenio: vcDias }, [conA('vacaciones'), et('38.1')]);
    } else if (vcDias !== null && vc.tipo_dias === 'laborables') {
      add('revisable', 'vac.convenio_laborables', { dias: vd, convenio: vcDias }, [conA('vacaciones'), et('38.1')]);
    } else if (vcDias === null) {
      add('correcto', 'vac.ok_pendiente', { dias: vd }, [et('38.1'), conA('vacaciones')]);
    } else {
      add('correcto', 'vac.ok', { dias: vd, convenio: vcDias }, [et('38.1'), conA('vacaciones')]);
    }
  }
  if (a.vacaciones_pagadas === 'si') add('grave', 'vac.compensadas', {}, [et('38.1')]);

  // --- Pagas extra ---
  const np = num(a.pagas_extra);
  if (np !== null) {
    const pc = num((cat?.pagas_extra ?? conv?.comun?.pagas_extra)?.numero);
    if (np < ET_PAGAS_MIN) add('grave', 'pagas.menos_2', { n: np }, [et('31'), conA('pagas_extra')]);
    else if (pc !== null && np < pc) add('grave', 'pagas.bajo_convenio', { n: np, convenio: pc }, [conA('pagas_extra'), et('31')]);
    else if (pc === null) add('correcto', 'pagas.ok_pendiente', { n: np }, [et('31'), conA('pagas_extra')]);
    else add('correcto', 'pagas.ok', { n: np, convenio: pc }, [et('31'), conA('pagas_extra')]);
  }

  // --- Registro horario ---
  if (a.registro === 'no') add('grave', 'registro.no', {}, [et('34.9')]);
  else if (a.registro === 'si_no_accedo') add('revisable', 'registro.sin_acceso', {}, [et('34.9')]);
  else if (a.registro === 'nose') add('revisable', 'registro.nose', {}, [et('34.9')]);
  else if (a.registro === 'si_accedo') add('correcto', 'registro.ok', {}, [et('34.9')]);

  if (parcial) {
    if (a.resumen_mensual === 'no') add('grave', 'parcial.resumen', {}, [et('12.4.c')]);
    else if (a.resumen_mensual === 'nose') add('revisable', 'parcial.resumen_nose', {}, [et('12.4.c')]);
    else if (a.resumen_mensual === 'si') add('correcto', 'parcial.resumen_ok', {}, [et('12.4.c')]);
  }

  // --- Contratos temporales ---
  if (temporal) {
    const m24 = num(a.temporal_meses_24);
    const mAct = num(a.temporal_meses_actual);
    if (m24 !== null && m24 > ET_TEMPORAL_ENCADENAMIENTO) {
      add('grave', 'temp.encadenamiento', { meses: m24 }, [et('15.5')]);
    }
    if (a.temporal_causa === 'produccion' && mAct !== null) {
      if (mAct > ET_PRODUCCION_MAX_CONVENIO) add('grave', 'temp.produccion_12', { meses: mAct }, [et('15.2'), et('15.4'), conA('contratacion')]);
      else if (mAct > ET_PRODUCCION_MAX) add('revisable', 'temp.produccion_6', { meses: mAct }, [et('15.2'), conA('contratacion')]);
    }
    if (a.temporal_causa === 'nose') add('revisable', 'temp.causa_nose', {}, [et('15.1'), et('15.4')]);
  }

  F.sort((x, y) => ORDER[x.sev] - ORDER[y.sev]);
  return F;
}

export function resumen(findings) {
  const r = { grave: 0, revisable: 0, correcto: 0 };
  for (const f of findings) r[f.sev] += 1;
  return r;
}
