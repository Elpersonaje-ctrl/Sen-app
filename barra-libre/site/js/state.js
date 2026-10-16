// Estado de la aplicación: SOLO en memoria. Nada se escribe en localStorage,
// sessionStorage, cookies ni IndexedDB. Al recargar la página, todo desaparece.

function initial() {
  return {
    auditoria: { step: 0, answers: {}, showReport: false },
    nomina: { inputs: {}, showResult: false },
    dudas: { topic: null, path: [] },
  };
}

export const state = initial();

export function resetState() {
  const fresh = initial();
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, fresh);
}
