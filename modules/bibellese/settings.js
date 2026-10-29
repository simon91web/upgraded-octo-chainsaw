// Einstellungsblatt unter Einstellungen › Module › Bibellese: „Für mich“ und „Für den Haushalt“.
// Dieselben Werte wie das Blatt „Einstellungen“ auf der Modulseite; sie wirken sofort.

import { dienst } from './lib/dienst.js';

const zeile = (titel, steuerung) => `<div style="display:flex;align-items:center;gap:12px;min-height:52px;padding:8px 0">
  <span style="flex:1">${titel}</span>${steuerung}</div>`;

export async function render(container, { section }) {
  container.replaceChildren();
  let e;
  let ich;
  try {
    [e, { ich }] = await Promise.all([dienst.einstellungen(), dienst.status()]);
  } catch (err) {
    container.insertAdjacentHTML('beforeend', `<p>Bibellese-Dienst nicht erreichbar: ${String(err.message).replace(/[<>&]/g, '')}</p>`);
    return;
  }
  const meldung = document.createElement('p');
  meldung.setAttribute('aria-live', 'polite');
  meldung.style.cssText = 'margin:4px 0 0;font-size:13px;color:var(--color-text-secondary);min-height:18px';
  const gespeichert = () => { meldung.textContent = 'Gespeichert'; setTimeout(() => { meldung.textContent = ''; }, 2000); };
  const fehler = (err) => { meldung.textContent = `Nicht gespeichert – ${err.message}`; };

  if (section === 'mine') {
    container.insertAdjacentHTML('beforeend', `<h3>Lesepläne</h3>${zeile('Gemeinsame Pläne zählen für mich, wenn ich dabei war',
      `<input type="checkbox" role="switch" id="bl-e-zaehlt"${e.person.gemeinsamZaehlt ? ' checked' : ''}>`)}
      <p style="margin:0"><a href="/m/bibellese">Meine Pläne in Bibellese öffnen</a></p>`);
    container.querySelector('#bl-e-zaehlt').addEventListener('change', (ev) => {
      dienst.einstellungenSetzen({ person: { gemeinsamZaehlt: ev.target.checked } }).then(gespeichert, fehler);
    });
  } else if (section === 'household' && ich.admin) {
    container.insertAdjacentHTML('beforeend', `<h3>Gemeinsame Pläne</h3>${zeile('Gemeinsame Pläne anlegen dürfen',
      `<select id="bl-e-anlegen"><option value="alle"${e.haushalt.gemeinsameAnlegen === 'alle' ? ' selected' : ''}>Alle</option>
        <option value="admins"${e.haushalt.gemeinsameAnlegen === 'admins' ? ' selected' : ''}>Nur Admins</option></select>`)}`);
    container.querySelector('#bl-e-anlegen').addEventListener('change', (ev) => {
      dienst.einstellungenSetzen({ haushalt: { gemeinsameAnlegen: ev.target.value } }).then(gespeichert, fehler);
    });
  }
  container.append(meldung);
}
