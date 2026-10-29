// Blätter (Dialoge): mobil von unten, am Laptop mittig. Nie Blatt auf Blatt.

import { esc, ic, NBSP, zahl, min, einheiten, lesungenText, fmtDatum, kurzDatum, plusTage } from './werkzeug.js';
import { ART, RHYTHMEN, rhythmusText, rezeptText, buchDetail, meinePlaene } from './ansicht.js';

export const SCHRITTE = ['Was', 'Wo anfangen', 'Parallelen', 'Wie viel', 'Für wen'];
const LESARTEN = [['still', 'Still', 200], ['langsam', 'Langsam', 150], ['vorlesen', 'Vorlesen', 130]];

export function blatt(S) {
  if (S.ui?.art !== 'blatt') return '';
  const p = S.plaene.find((x) => String(x.id) === String(S.ui.plan));
  const inhalt = {
    eintragen: blattEintragen, plan: blattPlan, gelesenAm: blattGelesenAm, aufholen: blattAufholen, ziel: blattZiel,
    einstellungen: blattEinstellungen, buch: (s) => buchDetail(s, s.ui.wert, { ohneRahmen: true }), assistent: blattAssistent,
  }[S.ui.was](S, p);
  const titel = {
    eintragen: S.ui.edit ? 'Eintrag bearbeiten' : 'Eintrag', plan: p?.name ?? 'Plan', gelesenAm: 'An einem anderen Tag gelesen',
    aufholen: 'Aufholen', ziel: 'Ziel verschieben', einstellungen: 'Bibellese', buch: S.bibel.hat(S.ui.wert) ? S.bibel.buch(S.ui.wert).name : '',
    assistent: 'Neuer Leseplan',
  }[S.ui.was];
  const schritt = S.ui.was === 'assistent' ? `<span class="bl-sheet__step">${S.assistent.schritt} von ${SCHRITTE.length}</span>` : '';
  const rein = S.ui.gezeigt ? '' : ' is-rein';
  S.ui.gezeigt = true;
  return `<div class="bl-sheet-layer${rein}"><div class="bl-sheet-backdrop" data-akt="schliessen"></div>
    <div class="bl-sheet${S.ui.was === 'assistent' ? ' bl-sheet--wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(titel)}"><div class="bl-sheet__grip"></div>
      <div class="bl-sheet__head"><h2>${esc(titel)}</h2>${schritt}<button type="button" class="btn btn--ghost btn--icon" data-akt="schliessen" aria-label="Schließen">${ic('x')}</button></div>
      ${S.ui.fehlerText ? `<div class="bl-alert" role="alert">${ic('circle-alert')}<p>${esc(S.ui.fehlerText)}</p></div>` : ''}
      ${inhalt}</div></div>`;
}

// ------------------------------------------------------------------ Eintrag

function blattEintragen(S) {
  const edit = S.ui.edit ? [...S.lesungenAlle, ...S.lesungenFilter].find((l) => l.id === S.ui.edit) : null;
  const gemeinsame = meinePlaene(S).filter((p) => p.art === 'gemeinsam' && p.darfAbhaken);
  const ziel = S.ui.ziel ?? 'ich';
  const w = S.ui.werte ?? {}; // Eingaben bleiben nach einer Fehlermeldung stehen
  const erste = edit?.stuecke[0];
  const letzte = edit?.stuecke.at(-1);
  const buchId = w.buch ?? erste?.b ?? S.ui.buchVorschlag ?? 'Gen';
  const von = w.von ?? erste?.von[0] ?? 1;
  const bis = w.bis ?? letzte?.bis[0] ?? von;
  const opt = (t) => S.bibel.buecher.filter((b) => b.testament === t).map((b) => `<option value="${b.id}"${b.id === buchId ? ' selected' : ''}>${esc(b.name)}</option>`).join('');
  const planEintrag = edit?.quelle === 'plan';
  return `<form data-form="eintrag" novalidate>
    ${edit || !gemeinsame.length ? '' : `<div class="bl-field"><span class="bl-field__label">Logbuch</span><div><div class="bl-seg" role="group" aria-label="Logbuch">${[['ich', 'Für mich'], ...gemeinsame.map((p) => [String(p.id), p.name])].map(([id, l]) =>
      `<button type="button" aria-pressed="${ziel === id}" data-akt="logbuch-wahl" data-wert="${id}">${esc(l)}</button>`).join('')}</div></div></div>`}
    ${planEintrag ? `<p class="bl-lead">${esc(edit.text)}</p>` : `
    <div class="bl-field"><label for="bl-buch">Buch</label><select id="bl-buch" name="buch"><optgroup label="Altes Testament">${opt('AT')}</optgroup><optgroup label="Neues Testament">${opt('NT')}</optgroup></select></div>
    <div class="bl-field-row"><div class="bl-field"><label for="bl-von">Kapitel von</label><input id="bl-von" name="von" type="number" inputmode="numeric" min="1" value="${esc(von)}"></div>
      <div class="bl-field"><label for="bl-bis">bis</label><input id="bl-bis" name="bis" type="number" inputmode="numeric" min="1" value="${esc(bis)}"></div></div>`}
    <div class="bl-field__error" aria-live="polite">${S.ui.fehler ? `${ic('circle-alert')}${esc(S.ui.fehler)}` : ''}</div>
    <div class="bl-field-row"><div class="bl-field"><label for="bl-datum">Datum</label><input id="bl-datum" name="datum" type="date" max="${S.heute}" value="${esc(w.datum ?? edit?.datum ?? S.ui.datum ?? S.heute)}"></div>
      <div class="bl-field"><label for="bl-zeit">Uhrzeit</label><input id="bl-zeit" name="zeit" type="time" value="${esc(w.zeit ?? edit?.uhrzeit ?? '')}"></div></div>
    <div class="bl-field"><label for="bl-notiz">Notiz</label><textarea id="bl-notiz" name="notiz" maxlength="2000" placeholder="z. B. Gedanken, Fragen, Gebetsanliegen">${esc(w.notiz ?? edit?.notiz ?? '')}</textarea></div>
    <div class="bl-sheet__foot"><button type="button" class="btn btn--ghost" data-akt="schliessen">Abbrechen</button>
      <button type="button" class="btn btn--primary" data-akt="eintrag-speichern"${S.busy === 'eintrag' ? ' aria-busy="true" disabled' : ''}>${S.busy === 'eintrag' ? 'Wird gespeichert …' : edit ? 'Speichern' : 'Eintragen'}</button></div></form>`;
}

// ------------------------------------------------------------------ Plan

function blattPlan(S, p) {
  if (!p) return '<p>Plan nicht gefunden.</p>';
  const d = S.planDetail[p.id];
  const st = p.stand;
  const fremd = !p.eigen && p.art !== 'gemeinsam';
  const zeilen = d ? d.einheiten.slice(Math.max(0, st.gelesen - 3), st.gelesen + 12).map((e) => {
    const fertig = e.nr <= st.gelesen;
    const naechste = e.nr === st.gelesen + 1;
    return `<div class="bl-row${naechste ? ' bl-row--next' : ''}"><span class="bl-ring${fertig ? ' bl-ring--done' : ''}${naechste ? ' bl-ring--next' : ''}" role="img" aria-label="${fertig ? 'gelesen' : 'offen'}">${fertig ? ic('check') : ''}</span>
      <div class="bl-row__main"><span class="bl-row__title">${esc(e.text)}</span><span class="bl-row__meta">${min(e.minuten)}</span></div><span class="bl-row__end">${e.nr}</span></div>`;
  }).join('') : '<div class="bl-row"><span class="bl-row__meta">Lädt …</span></div>';
  const verschoben = st.ziel && st.zielUrspruenglich && st.zielUrspruenglich !== st.ziel;
  const e = d && st.verzug > 0 && p.darfAendern ? einteilenVorschau(p, d) : null;
  const lesart = LESARTEN.find(([, , w]) => w === p.woerterJeMinute)?.[1] ?? `${p.woerterJeMinute} Wörter je Min.`;
  const wer = p.art === 'gemeinsam' ? ART.gemeinsam.lang : `${ART[p.art].name}${fremd ? ` · ${esc(S.mitglieder.find((m) => m.id === p.besitzer)?.display_name ?? '')}` : ''}`;
  return `<p class="bl-footnote">${esc(rezeptText(S, p))}</p>
    <div class="bl-inset bl-rows">
      <div class="bl-row"><div class="bl-row__main"><span class="bl-row__title">Für wen</span></div><span class="bl-value">${ic(ART[p.art].icon)}${wer}</span></div>
      ${st.ziel ? `<button type="button" class="bl-row" data-akt="blatt" data-was="ziel" data-plan="${p.id}"${p.darfAendern ? '' : ' disabled title="Das Ziel verschieben darf, wer den Plan angelegt hat, und Admins."'}>
        <div class="bl-row__main"><span class="bl-row__title">Ziel</span>${verschoben ? `<span class="bl-row__meta">ursprünglich ${fmtDatum(st.zielUrspruenglich)}</span>` : ''}</div>
        <span class="bl-value bl-tabnum">${fmtDatum(st.ziel)}${p.darfAendern ? ic('chevron-right') : ''}</span></button>` : ''}
      <div class="bl-row"><div class="bl-row__main"><span class="bl-row__title">Lesetage · Lesart</span></div><span class="bl-value">${rhythmusText(p.lesetage)} · ${lesart}</span></div>
      <div class="bl-row"><div class="bl-row__main"><span class="bl-row__title">Stand</span></div><span class="bl-value bl-tabnum">Version ${p.version} · ${lesungenText(st.anzahl)}</span></div>
      ${e?.moeglich ? `<button type="button" class="bl-row bl-row--link" data-akt="neu-einteilen" data-plan="${p.id}">Neu einteilen: Lesungen ${min(e.nachher)} statt ${min(e.vorher)}${ic('chevron-right')}</button>` : ''}
    </div>
    <div class="bl-inset bl-rows">${zeilen}</div>
    <div class="bl-sheet__foot">
      ${p.darfAendern && p.eigen !== false ? `<button type="button" class="btn btn--ghost bl-danger" data-akt="plan-loeschen" data-plan="${p.id}">${ic('trash-2')}Plan löschen</button>` : ''}
      ${fremd ? (p.uebernommen ? `<span class="bl-state bl-state--ok">${ic('check')}Übernommen</span>`
        : S.ich.darfSchreiben ? `<button type="button" class="btn btn--primary" data-akt="uebernehmen" data-plan="${p.id}">Übernehmen</button>` : '') : ''}
    </div>`;
}

/** „Neu einteilen“: Lesungen ab dem Lesezeichen etwas länger, damit das Ziel hält. */
export function einteilenVorschau(p, d) {
  const st = p.stand;
  const rest = d.einheiten.slice(st.gelesen);
  const minuten = rest.reduce((s, e) => s + e.minuten, 0);
  return { moeglich: st.vorrat > 0 && st.vorrat < rest.length, vorher: minuten / rest.length, nachher: st.vorrat > 0 ? minuten / st.vorrat : 0 };
}

function blattGelesenAm(S, p) {
  return `<p class="bl-lead">${esc(p?.naechste?.text ?? '')}</p>
    <div class="bl-field"><label for="bl-am">Gelesen am</label><input id="bl-am" name="am" type="date" max="${S.heute}" value="${plusTage(S.heute, -1)}"></div>
    <div class="bl-sheet__foot"><button type="button" class="btn btn--ghost" data-akt="schliessen">Abbrechen</button>
      <button type="button" class="btn btn--primary" data-akt="gelesen-am" data-plan="${p.id}">${ic('check')}Gelesen</button></div>`;
}

// ------------------------------------------------------------------ Aufholen

/** Kein eigener Modus: zeigt, was Aufholen kostet, und lässt gleich weiterlesen. */
function blattAufholen(S, p) {
  const st = p.stand;
  const d = S.planDetail[p.id];
  const sichtbar = Math.min(S.ui.anzahl, 5);
  const zeilen = d ? Array.from({ length: sichtbar }, (_, i) => {
    const nr = S.ui.start + i + 1;
    const e = d.einheiten[nr - 1];
    if (!e) return '';
    const fertig = nr <= st.gelesen;
    const naechste = nr === st.gelesen + 1;
    const wann = i === 0 && S.ui.heuteOffen ? 'heute' : 'zum Aufholen';
    return `<div class="bl-row${naechste ? ' bl-row--next' : ''}"><span class="bl-ring${fertig ? ' bl-ring--done' : ''}${naechste ? ' bl-ring--next' : ''}" role="img" aria-label="${fertig ? 'gelesen' : 'offen'}">${fertig ? ic('check') : ''}</span>
      <div class="bl-row__main"><span class="bl-row__title">${esc(e.text)}</span><span class="bl-row__meta">Einheit ${nr} · ${wann}</span></div></div>`;
  }).join('') : '<div class="bl-row"><span class="bl-row__meta">Lädt …</span></div>';
  const mehr = S.ui.anzahl > sichtbar ? `<div class="bl-row"><span class="bl-row__meta" style="padding-left:32px">und ${S.ui.anzahl - sichtbar} weitere</span></div>` : '';
  let satz;
  if (st.verzug === 0) satz = `<p class="bl-lead bl-state bl-state--ok">${ic('circle-check')}Wieder im Plan · Ziel ${fmtDatum(st.ziel)}</p>`;
  else if (st.grosserVerzug) satz = `<p class="bl-lead">In zwei Wochen aufgeholt hieße ${Math.ceil(st.verzug / 14)} Einheiten mehr am Tag.</p>`;
  else {
    const t = st.wiederImPlan;
    const wann = t === S.heute ? 'heute' : t === plusTage(S.heute, 1) ? 'morgen' : `am ${kurzDatum(t, S.heute)}`;
    satz = `<p class="bl-lead">Mit ${st.verzug === 1 ? 'einer' : 'je einer'} Einheit mehr bist du ${wann} wieder im Plan.</p>`;
  }
  const busy = S.busy === p.id;
  const haupt = st.verzug === 0
    ? '<button type="button" class="btn btn--primary" data-akt="schliessen">Fertig</button>'
    : `<button type="button" class="btn btn--primary" data-akt="gelesen-blatt" data-plan="${p.id}"${busy ? ' aria-busy="true" disabled' : ''}>${busy ? 'Wird gespeichert …' : `${ic('check')}Gelesen`}</button>`;
  const e = d && st.verzug > 0 && p.darfAendern ? einteilenVorschau(p, d) : null;
  const dritter = e?.moeglich
    ? `<div class="bl-group-label">Oder ohne Mehrlesen</div>
      <div class="bl-inset bl-rows"><div class="bl-row"><div class="bl-row__main"><span class="bl-row__title">Neu einteilen</span>
        <span class="bl-row__meta bl-tabnum">Lesungen ${min(e.nachher)} statt ${min(e.vorher)} · Ziel bleibt ${fmtDatum(st.ziel)}</span></div>
        <button type="button" class="btn btn--secondary btn--sm" data-akt="neu-einteilen" data-plan="${p.id}">Einteilen</button></div></div>` : '';
  return `${satz}<div class="bl-inset bl-rows">${zeilen}${mehr}</div>${dritter}
    <div class="bl-sheet__foot">${p.darfAendern ? `<button type="button" class="btn btn--secondary" data-akt="blatt" data-was="ziel" data-plan="${p.id}">Ziel verschieben</button>` : ''}${haupt}</div>`;
}

// ------------------------------------------------------------------ Ziel

/** Was ein Ziel bewirkt: „im Plan“, „7 Einheiten Vorsprung“ oder „2 Einheiten im Verzug“. */
export function zielVorschau(S, p, ziel) {
  if (!ziel || ziel <= S.heute) return 'Das Ziel muss nach heute liegen.';
  const s = S.kern.stand({ einheiten: { length: p.stand.anzahl }, lesetage: p.lesetage, ziel },
    { gelesen: p.stand.gelesen, heuteGelesen: p.stand.heuteGelesen, heute: S.heute });
  if (s.verzug > 0) return `Danach: ${einheiten(s.verzug)} im Verzug`;
  if (s.vorsprung > 0) return `Danach: ${einheiten(s.vorsprung)} Vorsprung`;
  return 'Danach: im Plan';
}

function blattZiel(S, p) {
  const st = p.stand;
  const mitVerzug = st.verzug > 0;
  const art = S.ui.zielArt ?? (mitVerzug ? 'verzug' : 'datum');
  const datumWert = S.ui.datumWert ?? (mitVerzug ? st.ende : plusTage(st.ziel, 7));
  const tage = mitVerzug ? Math.round((Date.parse(st.ende) - Date.parse(st.ziel)) / 86400000) : 0;
  const gewaehlt = art === 'verzug' ? st.ende : datumWert;
  const verlauf = p.zielVerlauf?.length
    ? `<div class="bl-group-label">Verlauf</div><div class="bl-inset bl-rows">${p.zielVerlauf.map((z) =>
        `<div class="bl-row"><div class="bl-row__main"><span class="bl-row__title bl-tabnum">${fmtDatum(z.von)} → ${fmtDatum(z.nach)}</span><span class="bl-row__meta">am ${fmtDatum(z.am)}</span></div></div>`).join('')}</div>`
    : '';
  return `<form data-form="ziel" novalidate>
    <p class="bl-footnote">${esc(p.name)}</p>
    <div class="bl-inset bl-rows">
      <div class="bl-row"><div class="bl-row__main"><span class="bl-row__title">Jetziges Ziel</span>${st.zielUrspruenglich && st.zielUrspruenglich !== st.ziel ? `<span class="bl-row__meta">ursprünglich ${fmtDatum(st.zielUrspruenglich)}</span>` : ''}</div>
        <span class="bl-value bl-tabnum">${fmtDatum(st.ziel)}</span></div>
    </div>
    <div class="bl-group-label">Neues Ziel</div>
    <div class="bl-inset bl-rows">
      ${mitVerzug ? `<label class="bl-row bl-choice"><input type="radio" name="art" value="verzug"${art === 'verzug' ? ' checked' : ''}>
        <div class="bl-row__main"><span class="bl-row__title">Um den Verzug</span><span class="bl-row__meta bl-tabnum">um ${tage} ${tage === 1 ? 'Tag' : 'Tage'} auf ${fmtDatum(st.ende)}</span></div></label>` : ''}
      <label class="bl-row bl-choice"><input type="radio" name="art" value="datum"${art === 'datum' ? ' checked' : ''}>
        <div class="bl-row__main"><span class="bl-row__title">Anderes Datum</span></div>
        <input class="bl-inline-field" type="date" name="datum" min="${plusTage(S.heute, 1)}" value="${esc(datumWert)}" aria-label="Neues Ziel"></label>
    </div>
    <p class="bl-preview bl-tabnum" data-vorschau aria-live="polite">${zielVorschau(S, p, gewaehlt)}</p>
    ${verlauf}
    <div class="bl-sheet__foot"><button type="button" class="btn btn--ghost" data-akt="schliessen">Abbrechen</button>
      <button type="button" class="btn btn--primary" data-akt="ziel-setzen" data-plan="${p.id}">Ziel verschieben</button></div></form>`;
}

// ------------------------------------------------------------------ Einstellungen

function blattEinstellungen(S) {
  const e = S.einstellungen ?? { person: { gemeinsamZaehlt: true }, haushalt: { gemeinsameAnlegen: 'alle' } };
  const ok = (key) => `<span class="bl-saved${S.saved === key ? ' bl-saved--on' : ''}"${S.saved === key ? '' : ' aria-hidden="true"'}>${ic('check')}Gespeichert</span>`;
  const anlegen = S.ich.admin
    ? `<div class="bl-seg" role="group" aria-label="Gemeinsame Pläne anlegen">${[['alle', 'Alle'], ['admins', 'Nur Admins']].map(([w, l]) =>
      `<button type="button" aria-pressed="${e.haushalt.gemeinsameAnlegen === w}" data-akt="einst-anlegen" data-wert="${w}">${l}</button>`).join('')}</div>`
    : `<span class="bl-value">${e.haushalt.gemeinsameAnlegen === 'admins' ? 'Nur Admins' : 'Alle'}</span>`;
  return `<div class="bl-group-label">Für mich</div>
    <div class="bl-inset bl-rows">
      <button type="button" class="bl-row" data-akt="tab" data-wert="plaene"><div class="bl-row__main"><span class="bl-row__title">Meine Pläne</span></div>
        <span class="bl-value">${meinePlaene(S).filter((p) => p.art !== 'gemeinsam').length}${ic('chevron-right')}</span></button>
      <div class="bl-row"><div class="bl-row__main"><span class="bl-row__title">Gemeinsame Pläne zählen für mich, wenn ich dabei war</span></div>${ok('gemeinsamZaehlt')}
        <button type="button" class="bl-switch" role="switch" aria-checked="${e.person.gemeinsamZaehlt}" data-akt="einst-zaehlt" aria-label="Gemeinsame Pläne zählen für mich"></button></div>
    </div>
    <div class="bl-group-label">Für den Haushalt</div>
    <div class="bl-inset bl-rows">
      <div class="bl-row"><div class="bl-row__main"><span class="bl-row__title">Gemeinsame Pläne anlegen</span></div>${ok('anlegen')}${anlegen}</div>
    </div>
    <div class="bl-inset bl-rows" style="margin-top:16px"><a class="bl-row bl-row--link" href="/settings/modules/ext/bibellese">In den Yuvomi-Einstellungen öffnen${ic('chevron-right')}</a></div>`;
}

// ------------------------------------------------------------------ Assistent „Neuer Leseplan“

export function neuerAssistent(S) {
  return {
    schritt: 1, auswahl: 'bibel', gruppe: 'evang', buecher: ['John'], weisheit: false,
    startArt: 'anfang', start: null, parallelen: { geschichte: true, lieder: true, gesetz: false },
    modus: 'datum', bis: plusTage(S.heute, 364), minuten: 10, rhythmus: 'taeglich', lesart: 'still',
    name: '', art: 'privat', beginn: S.heute,
  };
}

/** Antworten des Assistenten → Rezept für den Kern und den Dienst (LESEPLAN.md §9). */
export function rezeptAus(S, a) {
  const auswahl = a.auswahl === 'gruppe' ? `gruppe:${a.gruppe}` : a.auswahl === 'buecher' ? a.buecher : a.auswahl;
  const mitWeisheit = a.weisheit && ['bibel', 'at'].includes(a.auswahl);
  const start = a.startArt === 'buch' && a.start ? a.start : undefined;
  const straenge = mitWeisheit
    ? [{ buecher: auswahl, ohne: S.weisheit, ...(start ? { start } : {}) }, { buecher: S.weisheit }]
    : [{ buecher: auswahl, ...(start ? { start } : {}) }];
  const lesetage = RHYTHMEN.find((r) => r.id === a.rhythmus).tage;
  return {
    straenge,
    einteilung: 'kapitel-sinn',
    parallelen: Object.entries(a.parallelen).filter(([, an]) => an).map(([k]) => k),
    lesetage,
    ziel: a.modus === 'datum' && lesetage ? { datum: a.bis } : { minuten: a.minuten },
    woerter_je_minute: LESARTEN.find(([id]) => id === a.lesart)[2],
    begonnen_am: a.beginn,
  };
}

export function nameVorschlag(S, a) {
  if (a.auswahl === 'bibel') return a.weisheit ? 'Bibel mit Weisheit' : 'Ganze Bibel';
  if (a.auswahl === 'at') return a.weisheit ? 'Altes Testament mit Weisheit' : 'Altes Testament';
  if (a.auswahl === 'nt') return 'Neues Testament';
  if (a.auswahl === 'gruppe') return S.bibel.gruppen.find((g) => g.id === a.gruppe).name;
  const b = a.buecher.map((id) => S.bibel.buch(id));
  if (!b.length) return 'Neuer Plan';
  return b.length <= 2 ? b.map((x) => x.name).join(' und ') : `${b[0].name} und ${b.length - 1} weitere`;
}

const radioZeile = (name, wert, aktiv, titel, meta = '', extra = '') => `<label class="bl-row bl-choice">
  <input type="radio" name="${name}" value="${wert}"${aktiv ? ' checked' : ''}>
  <div class="bl-row__main"><span class="bl-row__title">${titel}</span>${meta ? `<span class="bl-row__meta">${meta}</span>` : ''}</div>${extra}</label>`;

const schalterZeile = (key, an, titel, meta = '', gesperrt = '') => `<div class="bl-row">
  <div class="bl-row__main"><span class="bl-row__title">${titel}</span>${meta ? `<span class="bl-row__meta">${meta}</span>` : ''}</div>
  <button type="button" class="bl-switch" role="switch" aria-checked="${an}" data-akt="assistent-schalter" data-was="${key}" aria-label="${titel}"${gesperrt ? ` disabled title="${gesperrt}"` : ''}></button></div>`;

const segAssistent = (S, key, optionen) => `<div class="bl-seg" role="group">${optionen.map(([w, l, gesperrt]) =>
  `<button type="button" aria-pressed="${S.assistent[key] === w}" data-akt="assistent-wert" data-was="${key}" data-wert="${w}"${gesperrt ? ` disabled title="${gesperrt}"` : ''}>${l}</button>`).join('')}</div>`;

function schrittInhalt(S) {
  const a = S.assistent;
  const B = S.bibel.buecher;
  const anzahl = (bs) => `${zahl(bs.length)} ${bs.length === 1 ? 'Buch' : 'Bücher'}`;
  if (a.schritt === 1) {
    const buecherWahl = a.auswahl === 'buecher' ? `<div class="bl-tiles bl-tiles--pick">${B.map((b) =>
      `<button type="button" class="bl-tile" aria-pressed="${a.buecher.includes(b.id)}" data-akt="assistent-buch" data-wert="${b.id}" title="${esc(b.name)}">${esc(b.abk)}</button>`).join('')}</div>` : '';
    const mitWeisheitMoeglich = ['bibel', 'at'].includes(a.auswahl);
    return `<h3 class="bl-wizard__q">Was möchtest du lesen?</h3>
      <div class="bl-inset bl-rows">
        ${radioZeile('auswahl', 'bibel', a.auswahl === 'bibel', 'Ganze Bibel', anzahl(B))}
        ${radioZeile('auswahl', 'at', a.auswahl === 'at', 'Altes Testament', anzahl(B.filter((b) => b.testament === 'AT')))}
        ${radioZeile('auswahl', 'nt', a.auswahl === 'nt', 'Neues Testament', anzahl(B.filter((b) => b.testament === 'NT')))}
        ${radioZeile('auswahl', 'gruppe', a.auswahl === 'gruppe', 'Eine Buchgruppe', '',
          `<select name="gruppe" class="bl-inline-field" aria-label="Buchgruppe">${S.bibel.gruppen.map((g) => `<option value="${g.id}"${a.gruppe === g.id ? ' selected' : ''}>${esc(g.name)}</option>`).join('')}</select>`)}
        ${radioZeile('auswahl', 'buecher', a.auswahl === 'buecher', 'Einzelne Bücher', a.auswahl === 'buecher' ? `${a.buecher.length} gewählt` : '')}
      </div>${buecherWahl}
      <div class="bl-inset bl-rows" style="margin-top:12px">
        ${schalterZeile('weisheit', a.weisheit && mitWeisheitMoeglich, 'Weisheitsliteratur nebenher', 'Hiob bis Hohelied als zweiter Strang', mitWeisheitMoeglich ? '' : 'Nur mit ganzer Bibel oder Altem Testament')}
        <div class="bl-row"><div class="bl-row__main"><span class="bl-row__title">Reihenfolge</span></div>
          <div class="bl-seg" role="group"><button type="button" aria-pressed="true">Kanonisch</button><button type="button" disabled title="Die chronologische Reihenfolge wird noch erstellt">Chronologisch</button></div></div>
      </div>`;
  }
  if (a.schritt === 2) {
    const auswahl = S.kern.buecherDerAuswahl(S.bibel, rezeptAus(S, a).straenge[0].buecher, a.weisheit && ['bibel', 'at'].includes(a.auswahl) ? S.weisheit : []);
    return `<h3 class="bl-wizard__q">Wo fängst du an?</h3>
      <div class="bl-inset bl-rows">
        ${radioZeile('startArt', 'anfang', a.startArt === 'anfang', 'Am Anfang', esc(auswahl[0]?.name ?? ''))}
        ${radioZeile('startArt', 'buch', a.startArt === 'buch', 'Bei einem Buch', 'Was davor liegt, kommt am Ende',
          `<select name="start" class="bl-inline-field" aria-label="Startbuch">${auswahl.map((b) => `<option value="${b.id}"${a.start === b.id ? ' selected' : ''}>${esc(b.name)}</option>`).join('')}</select>`)}
      </div>`;
  }
  if (a.schritt === 3) {
    const zahlArt = (art) => S.bibel.parallelen.filter((g) => g.art === art).length;
    return `<h3 class="bl-wizard__q">Parallelstellen zusammen lesen?</h3>
      <div class="bl-inset bl-rows">
        ${schalterZeile('p-geschichte', a.parallelen.geschichte, 'Geschichte', `${zahlArt('geschichte')} Gruppen, z. B. 1Kö 8 mit 2Chr 5–7`)}
        ${schalterZeile('p-lieder', a.parallelen.lieder, 'Lieder', `${zahlArt('lieder')} Gruppen, z. B. 2Sam 22 mit Ps 18`)}
        ${schalterZeile('p-gesetz', a.parallelen.gesetz, 'Gesetz', `${zahlArt('gesetz')} Gruppen, z. B. die Zehn Gebote`)}
        ${schalterZeile('p-evangelien', false, 'Evangelien', 'Kommt in einem zweiten Schritt', 'Die Synopse der Evangelien wird noch erfasst')}
      </div>`;
  }
  if (a.schritt === 4) {
    const frei = a.rhythmus === 'frei';
    const modus = frei ? 'minuten' : a.modus;
    return `<h3 class="bl-wizard__q">Wie viel und wann?</h3>
      <div class="bl-inset bl-rows">
        <div class="bl-row"><div class="bl-row__main"><span class="bl-row__title">Lesetage</span></div>
          ${segAssistent(S, 'rhythmus', RHYTHMEN.map((r) => [r.id, r.id === 'frei' ? 'Frei' : r.name]))}</div>
        <div class="bl-row"><div class="bl-row__main"><span class="bl-row__title">Festlegen über</span></div>
          ${segAssistent(S, 'modus', [['datum', 'Zieldatum', frei ? 'Ohne festen Rhythmus gibt es kein Zieldatum' : ''], ['minuten', 'Minuten']])}</div>
        ${modus === 'datum'
          ? `<label class="bl-row"><div class="bl-row__main"><span class="bl-row__title">Fertig bis</span></div><input class="bl-inline-field" type="date" name="bis" min="${plusTage(S.heute, 7)}" value="${esc(a.bis)}"></label>`
          : `<div class="bl-row"><div class="bl-row__main"><span class="bl-row__title">Minuten je Lesung</span></div>${segAssistent(S, 'minuten', [[5, '5'], [10, '10'], [15, '15'], [20, '20']])}</div>`}
        <div class="bl-row"><div class="bl-row__main"><span class="bl-row__title">Lesart</span></div>
          ${segAssistent(S, 'lesart', LESARTEN.map(([id, l]) => [id, l]))}</div>
      </div>`;
  }
  const darfGemeinsam = S.ich.admin || (S.einstellungen?.haushalt.gemeinsameAnlegen ?? 'alle') === 'alle';
  return `<h3 class="bl-wizard__q">Für wen ist der Plan?</h3>
    <div class="bl-field" style="margin-top:0"><label for="bl-a-name">Name</label><input id="bl-a-name" name="name" type="text" maxlength="80" value="${esc(a.name)}" placeholder="${esc(nameVorschlag(S, a))}"></div>
    <div class="bl-inset bl-rows" style="margin-top:14px">
      ${radioZeile('art', 'privat', a.art === 'privat', 'Nur für mich', 'Niemand sonst sieht ihn')}
      ${radioZeile('art', 'sichtbar', a.art === 'sichtbar', 'Für mich, sichtbar für alle', 'Andere können ihn übernehmen')}
      ${darfGemeinsam ? radioZeile('art', 'gemeinsam', a.art === 'gemeinsam', 'Gemeinsam mit allen im Haushalt', 'Ein Lesezeichen, jeder kann abhaken') : ''}
    </div>
    <div class="bl-field"><label for="bl-a-beginn">Beginnen am</label><input id="bl-a-beginn" name="beginn" type="date" min="${S.heute}" value="${esc(a.beginn)}"></div>`;
}

export function assistentVorschau(S) {
  let e;
  try {
    e = S.kern.erzeugePlan(S.bibel, rezeptAus(S, S.assistent));
  } catch (err) {
    return `<div class="bl-wizard__preview" data-vorschau-assistent><p class="bl-state bl-state--warn">${ic('circle-alert')}${esc(err.message)}</p></div>`;
  }
  const minJe = min(e.minutenJe);
  const kopf = e.ende
    ? `<b>${minJe}</b> je Lesung · ${lesungenText(e.n)} · fertig etwa <b>${fmtDatum(e.ende)}</b>`
    : `<b>${minJe}</b> je Lesung · ${lesungenText(e.n)} · das Ende ergibt sich aus deinem Tempo`;
  const erste = e.einheiten.slice(0, 3).map((u, i) => `<li><span class="bl-tabnum">${i + 1}</span>${esc(S.kern.einheitText(S.bibel, u.stuecke))}</li>`).join('');
  const kapitel = new Set(e.einheiten.flatMap((u) => u.stuecke.flatMap((s) => Array.from({ length: s.bis[0] - s.von[0] + 1 }, (_, i) => `${s.b}${s.von[0] + i}`)))).size;
  return `<div class="bl-wizard__preview" data-vorschau-assistent aria-live="polite">
    <div class="bl-wizard__sum">${kopf}</div>
    ${e.begrenzt ? `<p class="bl-state bl-state--warn bl-small">${ic('info')}Höchstens ${lesungenText(e.n)} – ein Sinnabschnitt wird nicht geteilt.</p>` : ''}
    <ol class="bl-wizard__list">${erste}</ol>
    <div class="bl-footnote">${e.straenge === 2 ? 'Zwei Stränge · ' : ''}${zahl(kapitel)} Kapitel · ${Math.round(e.gesamt / 60)}${NBSP}Std. insgesamt</div>
  </div>`;
}

function blattAssistent(S) {
  const a = S.assistent;
  const letzter = a.schritt === SCHRITTE.length;
  const leer = a.auswahl === 'buecher' && a.buecher.length === 0;
  const steps = `<ol class="bl-steps" aria-label="Schritte">${SCHRITTE.map((s, i) =>
    `<li class="${i + 1 === a.schritt ? 'is-now' : i + 1 < a.schritt ? 'is-done' : ''}"><button type="button" data-akt="assistent-schritt" data-wert="${i + 1}"${i + 1 === a.schritt ? ' aria-current="step"' : ''}>${s}</button></li>`).join('')}</ol>`;
  const busy = S.busy === 'assistent';
  const foot = `<div class="bl-sheet__foot">
    <button type="button" class="btn btn--ghost" data-akt="${a.schritt === 1 ? 'schliessen' : 'assistent-zurueck'}">${a.schritt === 1 ? 'Abbrechen' : 'Zurück'}</button>
    <button type="button" class="btn btn--primary" data-akt="${letzter ? 'assistent-fertig' : 'assistent-weiter'}"${leer ? ' disabled title="Mindestens ein Buch wählen"' : ''}${busy ? ' aria-busy="true" disabled' : ''}>${busy ? 'Wird angelegt …' : letzter ? 'Plan anlegen' : 'Weiter'}</button></div>`;
  return `<form data-form="assistent" novalidate>${steps}
    <div class="bl-wizard"><div class="bl-wizard__main">${schrittInhalt(S)}</div>${leer ? '' : assistentVorschau(S)}</div>${foot}</form>`;
}
