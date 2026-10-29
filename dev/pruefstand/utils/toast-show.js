// Nachbau von showToast aus Yuvomis /utils/toast-show.js: Meldung, optional „Rückgängig“.
let aktuell = null;
export function showToast(text, art = 'default', dauer = 3000, onUndo = null) {
  aktuell?.remove();
  const el = document.createElement('div');
  el.className = `ps-toast ps-toast--${art}`;
  el.setAttribute('role', art === 'error' ? 'alert' : 'status');
  el.textContent = text;
  if (onUndo) {
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.textContent = 'Rückgängig';
    knopf.addEventListener('click', () => { el.remove(); onUndo(); });
    el.append(knopf);
  }
  document.body.append(el);
  aktuell = el;
  setTimeout(() => el.remove(), dauer);
}
