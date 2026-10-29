// Dashboard-Kachel „Bibellese heute“: die nächste Einheit je Plan, den ich lese, mit Abhaken.

import { showToast } from '/utils/toast-show.js';
import { dienst } from '../lib/dienst.js';
import { esc, ic } from '../lib/werkzeug.js';
import { kurzStatus, meinePlaene } from '../lib/ansicht.js';

export async function renderWidget(container) {
  const zeichne = async () => {
    const { plaene } = await dienst.plaene();
    const liste = meinePlaene({ plaene }).filter((p) => p.naechste).slice(0, 3);
    container.replaceChildren();
    container.insertAdjacentHTML('beforeend', `<div class="bl-widget">${liste.length ? liste.map((p) => {
      const [cls, text] = kurzStatus(p.stand);
      const farbe = cls === 'bl-state--warn' ? 'var(--color-warning-ink)' : cls === 'bl-state--ok' ? 'var(--color-success-ink)' : 'var(--color-text-secondary)';
      return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--color-border-subtle)">
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px">
          <span style="font-size:13px;color:var(--color-text-secondary)">${esc(p.name)}</span>
          <span style="font-size:16px;font-weight:600">${esc(p.naechste.text)}</span>
          <span style="font-size:13px;font-weight:500;color:${farbe}">${esc(text)}</span></div>
        ${p.darfAbhaken ? `<button type="button" class="btn btn--secondary btn--sm" data-plan="${p.id}">${ic('check')}Gelesen</button>` : ''}</div>`;
    }).join('') : `<p style="color:var(--color-text-secondary)">Noch kein Plan. <a href="/m/bibellese">Bibellese öffnen</a></p>`}</div>`);
    window.lucide?.createIcons({ el: container });
    for (const knopf of container.querySelectorAll('button[data-plan]')) {
      knopf.addEventListener('click', async () => {
        knopf.disabled = true;
        knopf.textContent = 'Wird gespeichert …';
        const p = liste.find((x) => x.id === Number(knopf.dataset.plan));
        try {
          const r = await dienst.abhaken({ planId: p.id });
          showToast(`${p.naechste.text} gelesen`, 'success', 5000, async () => { await dienst.lesungLoeschen(r.lesung); await zeichne(); });
          await zeichne();
        } catch (err) {
          showToast(err.message, 'error', 6000);
          await zeichne();
        }
      });
    }
  };
  try {
    await zeichne();
  } catch (err) {
    container.replaceChildren();
    container.insertAdjacentHTML('beforeend', `<p style="color:var(--color-text-secondary)">${esc(err.message)}</p>`);
  }
}
