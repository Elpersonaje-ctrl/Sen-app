# Barra Libre (nombre provisional)

Herramienta web **anónima** para que camareros/as y demás personal de hostelería
de la provincia de Pontevedra comprueben si sus condiciones cumplen el convenio
provincial y el Estatuto de los Trabajadores.

- **Cero backend.** Todo se calcula en el navegador.
- **Cero recogida de datos.** Sin analítica, cookies, fuentes ni scripts externos,
  sin campos de texto libre y sin `localStorage`. El estado vive solo en memoria
  y se pierde al recargar (la interfaz lo avisa y tiene un botón «Borrar»).
- **Sin build ni dependencias.** HTML + CSS + JS vanilla (ES modules).
- Bilingüe castellano / galego.

> ⚠️ **Antes de publicar:** las cifras del convenio están todas en `null`.
> Cárgalas a mano desde el BOP Pontevedra nº 209 (31/10/2025) siguiendo
> [`DATOS-PENDIENTES.md`](DATOS-PENDIENTES.md). Mientras falten, la app lo
> indica con un aviso y no calcula nada que dependa de ellas.

## Estructura

```
barra-libre/
├── README.md
├── DATOS-PENDIENTES.md        ← qué cifra sacar del BOP para cada campo JSON
├── tests/logic.test.mjs       ← pruebas de la lógica (node --test)
└── site/                      ← ESTO es lo que se despliega
    ├── index.html             ← CSP estricta: solo recursos propios, form-action 'none'
    ├── _headers               ← cabeceras de seguridad para Cloudflare Pages
    ├── favicon.svg
    ├── css/main.css           ← diseño mobile-first
    ├── css/print.css          ← «Imprimir informe / guardar PDF»
    ├── data/
    │   ├── convenio.json      ← tablas y condiciones del convenio (pendientes)
    │   └── fiscal-2026.json   ← cotización SS e IRPF, con fuente y fecha
    ├── content/
    │   ├── dudas.json         ← árbol de decisión del módulo Dudas
    │   └── que-hacer.json     ← pasos, recursos y plazos
    ├── i18n/es.json, gl.json  ← todos los textos de interfaz
    └── js/
        ├── app.js             ← arranque, rutas (#hash), idioma, aviso de datos
        ├── i18n.js, data.js, state.js, ui.js, fields.js
        ├── logic/             ← funciones puras, sin DOM (probadas en Node)
        │   ├── convenio.js        lectura/herencia de categorías
        │   ├── auditoria-rules.js reglas → hallazgos con severidad y cita
        │   └── nomina-calc.js     bruto, cotización, IRPF estimado, comparación
        └── modules/           ← inicio, auditoria, nomina, dudas, que-hacer
```

## Probar en local

Los ES modules no funcionan abriendo `index.html` con doble clic (`file://`).
Sirve la carpeta con cualquier servidor estático:

```sh
cd barra-libre/site
python3 -m http.server 8000
# abre http://localhost:8000
```

Pruebas de la lógica (Node 18+; no hay dependencias que instalar):

```sh
node --test barra-libre/tests/logic.test.mjs
```

Las pruebas usan un convenio con cifras **ficticias** solo para verificar el
cálculo, y además comprueban que el `convenio.json` publicado no contiene cifras.

## Despliegue en Cloudflare Pages

No hay paso de compilación: se sube la carpeta `site/` tal cual.

### Opción A — conectado al repositorio (se redespliega en cada push)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git** y elige este repositorio y la rama.
2. Configuración de compilación:
   - **Framework preset:** `None`
   - **Build command:** *(vacío)*
   - **Build output directory:** `barra-libre/site`
   - **Root directory:** *(vacío / raíz del repo)*
3. **Save and Deploy.**

### Opción B — subida directa, sin Git

1. **Workers & Pages** → **Create** → **Pages** → **Upload assets**.
2. Arrastra el contenido de `barra-libre/site/` (o un .zip de esa carpeta).

O desde la terminal con Wrangler:

```sh
npx wrangler pages deploy barra-libre/site --project-name barra-libre
```

### Después de desplegar

- **Desactiva Web Analytics** del proyecto (Pages → proyecto → *Metrics* /
  *Web Analytics*). Si se activa, Cloudflare inyecta un script de analítica;
  la CSP lo bloquearía, pero es mejor no activarlo.
- No actives *Zaraz* ni otras inyecciones de scripts en el dominio.
- `_headers` añade CSP, `Referrer-Policy: no-referrer`, `Permissions-Policy`
  y `X-Frame-Options`. Compruébalo con las herramientas de desarrollador
  (pestaña *Network* → cabeceras de respuesta).
- Verificación de privacidad: abre la web con *DevTools → Network* y recorre
  los módulos. Solo deben aparecer peticiones al propio dominio (HTML, CSS, JS
  y JSON). Ninguna más.

### GitHub Pages (alternativa)

Publica la carpeta `barra-libre/site` (por ejemplo, con una Action que suba
ese directorio como artefacto de Pages). GitHub Pages ignora `_headers`, pero la
CSP del `<meta>` de `index.html` sigue garantizando que no se carga ni se envía
nada a terceros.

## Actualizar datos

| Qué | Dónde | Nota |
|---|---|---|
| Tablas salariales, pluses, jornada, vacaciones, pagas, artículos | `site/data/convenio.json` | Ver `DATOS-PENDIENTES.md`. Cambia `_pendiente` a `false` al terminar cada bloque. |
| Tipos de cotización, bases, SMI, parámetros IRPF | `site/data/fiscal-2026.json` | Para 2027, copia el archivo como `fiscal-2027.json` y cambia la ruta en `site/js/data.js`. |
| Textos de interfaz | `site/i18n/es.json`, `gl.json` | Ambos deben tener las mismas claves (lo comprueba el test). |
| Árbol de dudas | `site/content/dudas.json` | `{{comun.jornada.anual_horas}}` inserta datos del convenio. |
| Recursos y plazos | `site/content/que-hacer.json` | Revisar enlaces marcados `_verificar`. |

Tras cambiar un JSON, valida que sigue siendo JSON correcto
(`python3 -m json.tool archivo.json`) y ejecuta los tests.

## Criterios de diseño

- Verde bosque y latón; sellos de tinta para la severidad
  (**grave / revisable / correcto**); serif del sistema para titulares y sans
  del sistema para la interfaz (sin descargar fuentes).
- Navegación inferior fija en móvil, objetivos táctiles ≥ 44 px, foco visible,
  saltar al contenido, contraste AA, `prefers-reduced-motion`.
- Descargo de responsabilidad visible en cada módulo. No es asesoramiento jurídico.

## Limitaciones conocidas

- El IRPF es una estimación simplificada (persona sin descendientes ni otras
  circunstancias). El usuario puede introducir el % de su nómina para usarlo.
- No se calculan antigüedad, horas extra en nómina, embargos ni anticipos.
- La lista de categorías de `convenio.json` es orientativa y debe ajustarse a las
  filas reales de la tabla del BOP.
