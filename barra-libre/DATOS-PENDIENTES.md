# Datos pendientes de cargar

Todo lo que aparece aquí está en `null` en los JSON y la aplicación lo muestra
como **pendiente**: no calcula con ello y nunca lo estima.

**Fuente de los datos del convenio:** Convenio colectivo provincial de hostelería
de Pontevedra 2024-2025 (en ultraactividad en 2026 con las tablas de 2025),
**BOP Pontevedra nº 209, 31/10/2025**.

Cuando termines un bloque, cambia su `"_pendiente": true` a `false`.
Comprueba el resultado abriendo la app: el aviso amarillo de "datos pendientes"
desaparece cuando `meta`, `articulos`, `comun` y todas las categorías están
completos.

---

## 1. `site/data/convenio.json`

### 1.1 Metadatos de vigencia — bloque `meta`

| Campo JSON | Qué sacar del BOP |
|---|---|
| `meta.vigente_desde` | Fecha de inicio de vigencia del convenio (artículo de "Vigencia" / "Ámbito temporal"). Formato `AAAA-MM-DD`. |
| `meta.vigente_hasta` | Fecha final del periodo pactado (normalmente 31/12/2025). `AAAA-MM-DD`. |
| `meta.ultraactividad.desde` | Día siguiente a `vigente_hasta`, o la fecha que fije la cláusula de denuncia/prórroga. `AAAA-MM-DD`. |
| `meta.ultraactividad.nota` | Revisar que el texto coincide con lo que diga el convenio sobre su prórroga/ultraactividad. |
| `meta.fuente.url` | URL del BOP nº 209 (PDF o anuncio). Es solo un enlace mostrado; la app no lo descarga. |
| `meta.fuente.codigo_convenio` | Código del convenio (REGCON, p. ej. `36000xxx011981`). |
| `meta.fuente.paginas_tablas` | Páginas del BOP donde están las tablas salariales 2025. |
| `meta.fecha_carga_datos` | Fecha en la que tú cargas los datos. `AAAA-MM-DD`. |

### 1.2 Números de artículo — bloque `articulos`

Cada valor es el **número de artículo del convenio** como texto (`"14"`, `"14.2"`).
Se cita literalmente en el informe de auditoría.

| Campo JSON | Materia a localizar en el texto del convenio |
|---|---|
| `articulos.jornada` | Jornada laboral (anual / semanal). |
| `articulos.distribucion_jornada` | Distribución irregular, cuadrantes, calendario. |
| `articulos.horas_extra` | Horas extraordinarias (pago o compensación). |
| `articulos.descanso_entre_jornadas` | Descanso mínimo entre jornadas (si lo regula). |
| `articulos.descanso_semanal` | Descanso semanal / días libres. |
| `articulos.nocturnidad` | Plus o complemento de nocturnidad. |
| `articulos.festivos` | Trabajo en festivos (abono o descanso compensatorio). |
| `articulos.vacaciones` | Vacaciones. |
| `articulos.pagas_extra` | Gratificaciones / pagas extraordinarias. |
| `articulos.tablas_salariales` | Artículo o anexo que remite a las tablas salariales. |
| `articulos.transporte` | Plus de transporte (si existe). |
| `articulos.manutencion` | Manutención / plus de comida (si existe). |
| `articulos.contratacion` | Contratación (temporal, parcial, fijo-discontinuo). |
| `articulos.periodo_prueba` | Periodo de prueba. |
| `articulos.preaviso_cese` | Preaviso en caso de baja voluntaria. |

### 1.3 Condiciones comunes — bloque `comun`

| Campo JSON | Qué sacar del BOP |
|---|---|
| `comun.jornada.anual_horas` | Jornada máxima anual en horas de trabajo efectivo. |
| `comun.jornada.semanal_horas` | Jornada semanal (si la fija). Se usa como jornada completa para calcular la parcialidad; si queda `null`, la app usa 40 h (máximo del art. 34.1 ET) y lo indica. |
| `comun.jornada.diaria_max_horas_ordinarias` | Máximo de horas ordinarias diarias si el convenio se aparta de las 9 h del art. 34.3 ET. |
| `comun.vacaciones.dias` | Número de días de vacaciones anuales. |
| `comun.vacaciones.tipo_dias` | `"naturales"` o `"laborables"`, según diga el artículo. |
| `comun.descanso_semanal_dias` | Días de descanso semanal (p. ej. `1.5` o `2`). |
| `comun.pagas_extra.numero` | Número de pagas extraordinarias al año. |
| `comun.pagas_extra.pagas[].nombre` | Nombre de cada paga (p. ej. "Verano", "Navidad", "Beneficios"). Añade o quita elementos del array para que haya uno por paga. |
| `comun.pagas_extra.pagas[].fecha_abono` | Fecha límite de abono de cada paga, tal como la expresa el convenio (texto, p. ej. `"15 de julio"`). |
| `comun.pagas_extra.base_calculo` | `"salario_base"`, `"salario_base_mas_antiguedad"` o `"importe_fijo"`. |
| `comun.pagas_extra.importe_fijo` | Solo si `base_calculo` es `"importe_fijo"`: importe de cada paga. |
| `comun.pagas_extra.prorrateables` | `true` si el convenio permite prorratearlas en 12 meses, `false` si no. |
| `comun.pluses.nocturnidad.tipo` | `"porcentaje_salario_base"`, `"importe_hora"` o `"importe_mensual"`. |
| `comun.pluses.nocturnidad.valor` | Porcentaje (p. ej. `25`) o importe en euros, según `tipo`. |
| `comun.pluses.nocturnidad.franja.desde` / `.hasta` | Horario nocturno del convenio (`"22:00"` / `"06:00"` si coincide con el ET). |
| `comun.pluses.nocturnidad.proporcional_jornada` | `true` si se reduce a tiempo parcial (solo relevante para `importe_mensual`). |
| `comun.pluses.festivos.tipo` | `"importe_dia"`, `"importe_hora"` o `"porcentaje_salario_base"` (recargo sobre la hora ordinaria). |
| `comun.pluses.festivos.valor` | Importe o porcentaje. |
| `comun.pluses.festivos.descanso_compensatorio_alternativo` | `true` si el convenio permite sustituir el abono por descanso. |
| `comun.pluses.festivos.proporcional_jornada` | Normalmente `false`. |
| `comun.pluses.transporte.tipo` / `.valor` | Plus de transporte: `"importe_mensual"` o `"importe_dia"` (día trabajado) y su importe. Si el convenio no tiene plus de transporte, pon `tipo: "no_existe"` y `valor: 0`. |
| `comun.pluses.transporte.proporcional_jornada` | `true` si se reduce a tiempo parcial. |
| `comun.pluses.manutencion.tipo` / `.valor` / `.proporcional_jornada` | Igual que transporte. Si se da en especie (comida en el local) y no en dinero, `tipo: "no_existe"`. |
| `comun.horas_extra.tipo` / `.valor` | Precio de la hora extra si el convenio lo fija (`"importe_hora"`, o `"porcentaje_salario_base"` como recargo sobre la hora ordinaria). Si solo remite a descanso compensatorio, deja `tipo: "no_fija_precio"`. |
| `comun.antiguedad.regulada` / `.descripcion` | Si existe complemento de antigüedad y cómo es (informativo). |

### 1.4 Tablas salariales 2025 — array `categorias`

La lista de categorías incluida es **orientativa** (nombres del V Acuerdo Laboral
Estatal de Hostelería). **Ajústala a las filas reales de la tabla del BOP**:
añade, quita o renombra categorías. Cada `id` debe ser único, en minúsculas y sin
espacios.

Para **cada** categoría:

| Campo JSON | Qué sacar del BOP |
|---|---|
| `categorias[].nombre.es` / `.gl` | Nombre exacto de la categoría en la tabla (castellano y gallego). |
| `categorias[].grupo_profesional` | Grupo profesional (texto, p. ej. `"II"`). |
| `categorias[].nivel` | Nivel salarial de la tabla. |
| `categorias[].salario_base_mensual` | **Salario base mensual 2025** a jornada completa, en euros brutos (número, punto decimal: `1234.56`). |
| `categorias[].pluses.nocturnidad` | `null` si es igual que `comun`. Si la tabla fija un importe propio para esta categoría, copia el objeto completo de `comun.pluses.nocturnidad` con su valor. |
| `categorias[].pluses.festivos` | Ídem. |
| `categorias[].pluses.transporte` | Ídem. |
| `categorias[].pluses.manutencion` | Ídem. |
| `categorias[].jornada_anual_horas` | `null` salvo que la categoría tenga jornada distinta. |
| `categorias[].vacaciones` | `null` salvo excepción; si la hay, objeto `{ "dias": …, "tipo_dias": … }`. |
| `categorias[].pagas_extra` | `null` salvo excepción; si la hay, objeto con la misma forma que `comun.pagas_extra`. |

Categorías incluidas ahora (ids): `jefe_sala`, `segundo_jefe_sala`,
`jefe_sector`, `camarero`, `barman`, `sumiller`, `ayudante_camarero`,
`jefe_cocina`, `cocinero`, `ayudante_cocina`, `auxiliar_cocina`,
`camarero_pisos`.

---

## 2. `site/data/fiscal-2026.json`

No son datos del convenio. Los valores marcados `_verificar` están tomados de la
norma citada y conviene contrastarlos con la publicación oficial de 2026.

| Campo JSON | Qué comprobar / cargar | Estado |
|---|---|---|
| `seguridad_social.tipos_trabajador.*` | Tipos a cargo del trabajador en la Orden de cotización 2026 (CC 4,70 · desempleo 1,55 / 1,60 · FP 0,10 · MEI 0,15). | `_verificar` |
| `seguridad_social.bases.base_minima_mensual` | Base mínima de cotización 2026 del grupo de cotización habitual en hostelería (grupos 8-10: base diaria × 30). | **pendiente** |
| `seguridad_social.bases.base_maxima_mensual` | Base máxima de cotización 2026. | **pendiente** |
| `salario_minimo.mensual_14_pagas` | SMI 2026 mensual (14 pagas). | **pendiente** |
| `salario_minimo.anual` | SMI 2026 anual. | **pendiente** |
| `irpf.escala_retencion` | Escala del art. 101 LIRPF vigente en 2026. | `_verificar` |
| `irpf.minimo_personal` | Mínimo personal (art. 57 LIRPF). | `_verificar` |
| `irpf.otros_gastos_deducibles` | Art. 19.2.f LIRPF. | `_verificar` |
| `irpf.reduccion_rendimientos_trabajo.*` | Umbrales e importes del art. 20 LIRPF vigentes en 2026. | `_verificar` |
| `irpf.limite_excluyente_sin_hijos` | Límite excluyente de retención (art. 81 RIRPF), situación 3 sin descendientes. | **pendiente** |

Actualiza `meta.fecha_revision` y `meta.revisado_por` cuando lo revises.

---

## 3. Contenido textual a revisar (no son cifras)

- `site/content/que-hacer.json`: comprobar que siguen vigentes las URLs de la
  Inspección de Trabajo y del SMAC y añadir, si se quiere, sedes de los
  sindicatos en la provincia (campo `_verificar` en cada bloque).
