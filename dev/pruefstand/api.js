// Nachbau von Yuvomis /api.js für den Prüfstand: nur `api.get` gegen /api/v1.
export const api = {
  get: async (pfad, { signal } = {}) => {
    const r = await fetch(`/api/v1${pfad}`, { credentials: 'same-origin', signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  },
};
