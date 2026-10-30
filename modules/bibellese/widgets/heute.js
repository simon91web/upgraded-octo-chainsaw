// Dashboard-Kachel „Bibellese heute“: die nächste Einheit je Plan, den ich lese, mit Abhaken.
//
// Yuvomi gibt nur den Rahmen (.widget); Kopf und Körper baut die Kachel selbst mit Yuvomis Klassen
// (.widget__header, .widget__body), damit Polster, Siegel und „Alle“ wie bei den eigenen Kacheln sitzen.
// Die style.css des Moduls gilt auf dem Dashboard nicht, darum stehen die Zeilenstile hier.
// Die Stellentexte rechnet die Kachel wie die Seite selbst (Kern und Bibeldaten des Moduls).
//
// Hat die Einheit Nebenstellen, klappt nach „Gelesen“ in der Zeile die Nachfrage „Was hast du gelesen?“
// auf (Mockup mockup/kachel-haken.html, Variante B): alles vorausgewählt, dann „Eintragen“.

import { showToast } from '/utils/toast-show.js';
import { dienst, ladeBibelDaten } from '../lib/dienst.js';
import { esc, ic, stelleHtml } from '../lib/werkzeug.js';
import { kurzStatus, meinePlaene, naechsteTexte, gelesenText, hatNeben } from '../lib/ansicht.js';

const kopf = `<div class="widget__header">
    <h3 class="widget__title">
      <span class="module-seal module-seal--sm" style="--seal-accent: var(--module-bibellese, #9A6B3F)" aria-hidden="true">${ic('book-open')}</span>
      <span class="widget__title-text">Bibellese</span>
    </h3>
    <a href="/m/bibellese" data-route="/m/bibellese" class="widget__link" aria-label="Alle: Bibellese">Alle</a>
  </div>`;

const symbol = (name, farbe = 'var(--color-text-secondary)') => `<i data-lucide="${name}" aria-hidden="true" style="flex:none;width:13px;height:13px;margin-top:2px;color:${farbe}"></i>`;
const ZEILE = 'display:flex;align-items:flex-start;gap:6px;width:100%;font-size:13px;line-height:1.35;overflow-wrap:break-word';

// Zweiter Strang (Feder, dunkel) und Parallelstellen (Spalten, grau) leiser unter der Hauptstelle.
const neben = (icon, text, farbe) => (text ? `<span style="${ZEILE};color:${farbe}">${symbol(icon)}<span style="min-width:0">${stelleHtml(text)}</span></span>` : '');

// Haken wie auf der Karte; der Kreis behält in beiden Zuständen seinen Platz.
const haken = (an, fest = false) => `<span style="width:20px;height:20px;flex:none;border-radius:50%;display:grid;place-items:center;margin-top:-2px;color:var(--color-success);${
  fest ? 'background:color-mix(in srgb, var(--color-success) 12%, transparent)' : `box-shadow:inset 0 0 0 1.5px ${an ? 'var(--color-success)' : 'var(--color-border-control)'}`}">
  <i data-lucide="check" aria-hidden="true" style="width:12px;height:12px;stroke-width:3;${an ? '' : 'visibility:hidden'}"></i></span>`;

function schalter(teil, text, an) {
  const farbe = !an ? 'var(--color-text-tertiary)' : teil === 'zweit' ? 'var(--color-text-primary);font-weight:500' : 'var(--color-text-secondary)';
  return `<button type="button" data-teil="${teil}" aria-pressed="${an}" title="${an ? 'Mitgelesen – tippen zum Herausnehmen' : 'Nicht mitgelesen – tippen zum Mitzählen'}"
    style="${ZEILE};border:0;background:none;padding:7px 0;text-align:left;font-family:inherit;cursor:pointer;color:${farbe}">
    ${symbol(teil === 'zweit' ? 'feather' : 'columns-2', an ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)')}<span style="flex:1;min-width:0">${stelleHtml(text)}</span>${haken(an)}</button>`;
}

const leer = (text) => `<div class="card-empty-row widget__empty"><span class="card-empty-row__text">${esc(text)}</span></div>`;

export async function renderWidget(container) {
  // Ohne Bibeldaten (Ladefehler) bleibt der Text des Dienstes, ungeteilt.
  const T = await ladeBibelDaten().catch(() => ({}));
  // Herausnehmen kann erst ein Dienst ab Schnittstellenstufe 2; ein älterer zählt immer alles.
  const aktuell = ((await dienst.status().catch(() => ({}))).api ?? 1) >= 2;
  let liste = [];
  let frage = null; // Plan-Id, deren Nachfrage offen ist
  let ohne = new Set();

  function reihe(p, i) {
    const [cls, text] = kurzStatus(p.stand);
    const farbe = cls === 'bl-state--warn' ? 'var(--color-warning-ink)' : cls === 'bl-state--ok' ? 'var(--color-success-ink)' : 'var(--color-text-secondary)';
    const t = naechsteTexte(T, p);
    const rand = i ? 'border-top:1px solid var(--color-border-subtle);' : '';
    if (frage === p.id) {
      return `<div style="${rand}display:flex;flex-direction:column;gap:6px;padding:10px 0" role="group" aria-labelledby="bl-w-frage-${p.id}">
        <span style="font-size:13px;color:var(--color-text-secondary)">${esc(p.name)}</span>
        <span id="bl-w-frage-${p.id}" style="font-size:15px;font-weight:600;margin-top:2px">Was hast du gelesen?</span>
        <div>
          <div style="${ZEILE};font-weight:600;padding:7px 0"><span style="flex:1;min-width:0">${stelleHtml(t.haupt)}</span>${haken(true, true)}</div>
          ${t.zweit ? schalter('zweit', t.zweit, !ohne.has('zweit')) : ''}
          ${t.dazu ? schalter('dazu', `dazu ${t.dazu}`, !ohne.has('dazu')) : ''}
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px">
          <button type="button" class="btn btn--ghost btn--sm" data-akt="abbrechen">Abbrechen</button>
          <button type="button" class="btn btn--primary btn--sm" data-akt="eintragen" data-plan="${p.id}">${ic('check')}Eintragen</button></div></div>`;
    }
    return `<div style="${rand}display:flex;align-items:center;gap:12px;padding:10px 0">
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
        <span style="font-size:13px;color:var(--color-text-secondary)">${esc(p.name)}</span>
        <span style="font-size:16px;font-weight:600;line-height:1.3;overflow-wrap:break-word">${stelleHtml(t.haupt)}</span>
        ${neben('feather', t.zweit, 'var(--color-text-primary);font-weight:500')}
        ${neben('columns-2', t.dazu && `dazu ${t.dazu}`, 'var(--color-text-secondary)')}
        <span style="font-size:13px;font-weight:500;color:${farbe}">${esc(text)}</span></div>
      ${p.darfAbhaken ? `<button type="button" class="btn btn--secondary btn--sm" style="flex:none" data-akt="gelesen" data-plan="${p.id}">${ic('check')}Gelesen</button>` : ''}</div>`;
  }

  function malen() {
    container.replaceChildren();
    container.insertAdjacentHTML('beforeend', `${kopf}<div class="widget__body">${liste.map(reihe).join('')}</div>`);
    if (!liste.length) container.querySelector('.widget__body').insertAdjacentHTML('beforeend', leer('Noch kein Leseplan'));
    window.lucide?.createIcons({ el: container });
  }

  async function laden() {
    const { plaene } = await dienst.plaene();
    liste = meinePlaene({ plaene }).filter((p) => p.naechste).slice(0, 3);
    malen();
  }

  async function eintragen(p, knopf) {
    knopf.disabled = true;
    knopf.textContent = 'Wird gespeichert …';
    const weg = aktuell ? ohne : new Set();
    try {
      const r = await dienst.abhaken({ planId: p.id, ohne: [...weg] });
      showToast(`${gelesenText(naechsteTexte(T, p), weg)} gelesen`, 'success', 5000, async () => { await dienst.lesungLoeschen(r.lesung); await laden(); });
    } catch (err) {
      showToast(err.message, 'error', 6000);
    }
    frage = null;
    ohne = new Set();
    await laden();
  }

  // Ein Hörer für die ganze Kachel; sie zeichnet sich bei jeder Änderung neu.
  container.addEventListener('click', async (ev) => {
    const teil = ev.target.closest('[data-teil]');
    if (teil) {
      if (ohne.has(teil.dataset.teil)) ohne.delete(teil.dataset.teil); else ohne.add(teil.dataset.teil);
      malen();
      container.querySelector(`[data-teil="${teil.dataset.teil}"]`)?.focus();
      return;
    }
    const knopf = ev.target.closest('[data-akt]');
    if (!knopf) return;
    const p = liste.find((x) => x.id === Number(knopf.dataset.plan));
    if (knopf.dataset.akt === 'abbrechen') { frage = null; ohne = new Set(); malen(); return; }
    if (knopf.dataset.akt === 'eintragen') { await eintragen(p, knopf); return; }
    if (knopf.dataset.akt === 'gelesen') {
      // Mit Nebenstellen erst fragen; ohne trägt der Tipp sofort ein.
      if (aktuell && hatNeben(naechsteTexte(T, p))) {
        frage = p.id;
        ohne = new Set();
        malen();
        container.querySelector('[data-akt="eintragen"]')?.focus();
        return;
      }
      await eintragen(p, knopf);
    }
  });
  container.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && frage !== null) { frage = null; ohne = new Set(); malen(); }
  });

  try {
    await laden();
  } catch (err) {
    container.replaceChildren();
    container.insertAdjacentHTML('beforeend', `${kopf}<div class="widget__body">${leer(err.message)}</div>`);
    window.lucide?.createIcons({ el: container });
  }
}
