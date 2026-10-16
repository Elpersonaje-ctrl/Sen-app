// Carga de los JSON del propio sitio (misma procedencia). No hay ninguna otra petición de red.

export async function fetchJSON(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

export async function loadAll() {
  const [convenio, fiscal, dudas, queHacer] = await Promise.all([
    fetchJSON('data/convenio.json'),
    fetchJSON('data/fiscal-2026.json'),
    fetchJSON('content/dudas.json'),
    fetchJSON('content/que-hacer.json'),
  ]);
  return { convenio, fiscal, dudas, queHacer };
}
