// Dashboard-Kachel „Bibellese heute“: die nächste Einheit je Plan, den ich lese, mit Abhaken.
//
// Yuvomi gibt nur den Rahmen (.widget); Kopf und Körper baut die Kachel selbst mit Yuvomis Klassen
// (.widget__header, .widget__body), damit Polster, Siegel und „Alle“ wie bei den eigenen Kacheln sitzen.
// Die style.css des Moduls gilt auf dem Dashboard nicht, darum stehen die Zeilenstile hier.

import { showToast } from '/utils/toast-show.js';
import { dienst } from '../lib/dienst.js';
import { esc, ic, stelleHtml } from '../lib/werkzeug.js';
import { kurzStatus, meinePlaene } from '../lib/ansicht.js';

const kopf = `<div class="widget__header">
    <h3 class="widget__title">
      <span class="module-seal module-seal--sm" style="--seal-accent: var(--module-bibellese, #9A6B3F)" aria-hidden="true">${ic('book-open')}</span>
      <span class="widget__title-text">Bibellese</span>
    </h3>
    <a href="/m/bibellese" data-route="/m/bibellese" class="widget__link" aria-label="Alle: Bibellese">Alle</a>
  </div>`;

// Zweiter Strang und Parallelstellen leiser unter der Hauptstelle; „Gelesen“ zählt hier immer alles.
const neben = (icon, text, farbe) => (text ? `<span style="display:flex;align-items:flex-start;gap:6px;font-size:13px;line-height:1.35;overflow-wrap:break-word;color:${farbe}">
  <i data-lucide="${icon}" aria-hidden="true" style="flex:none;width:13px;height:13px;margin-top:2px;color:var(--color-text-secondary)"></i><span style="min-width:0">${stelleHtml(text)}</span></span>` : '');

const leer = (text) => `<div class="card-empty-row widget__empty"><span class="card-empty-row__text">${esc(text)}</span></div>`;

export async function renderWidget(container) {
  const zeichne = async () => {
    const { plaene } = await dienst.plaene();
    const liste = meinePlaene({ plaene }).filter((p) => p.naechste).slice(0, 3);
    const zeilen = liste.map((p, i) => {
      const [cls, text] = kurzStatus(p.stand);
      const farbe = cls === 'bl-state--warn' ? 'var(--color-warning-ink)' : cls === 'bl-state--ok' ? 'var(--color-success-ink)' : 'var(--color-text-secondary)';
      const teile = p.naechste.teile ?? { haupt: p.naechste.text };
      return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;${i ? 'border-top:1px solid var(--color-border-subtle)' : ''}">
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
          <span style="font-size:13px;color:var(--color-text-secondary)">${esc(p.name)}</span>
          <span style="font-size:16px;font-weight:600;line-height:1.3;overflow-wrap:break-word">${stelleHtml(teile.haupt)}</span>
          ${neben('feather', teile.zweit, 'var(--color-text-primary);font-weight:500')}
          ${neben('columns-2', teile.dazu && `dazu ${teile.dazu}`, 'var(--color-text-secondary)')}
          <span style="font-size:13px;font-weight:500;color:${farbe}">${esc(text)}</span></div>
        ${p.darfAbhaken ? `<button type="button" class="btn btn--secondary btn--sm" style="flex:none" data-plan="${p.id}">${ic('check')}Gelesen</button>` : ''}</div>`;
    }).join('');
    container.replaceChildren();
    container.insertAdjacentHTML('beforeend', `${kopf}<div class="widget__body">${zeilen || ''}</div>`);
    if (!zeilen) container.querySelector('.widget__body').insertAdjacentHTML('beforeend', leer('Noch kein Leseplan'));
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
    container.insertAdjacentHTML('beforeend', `${kopf}<div class="widget__body">${leer(err.message)}</div>`);
    window.lucide?.createIcons({ el: container });
  }
}
