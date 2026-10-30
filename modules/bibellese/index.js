// Bibellese – Yuvomi-Modul. Seite unter /m/bibellese.
// Daten kommen vom eigenen Dienst unter /api/extensions/bibellese/, Mitglieder von Yuvomi.

import { api } from '/api.js';
import { renderPageHeader, renderPageTitle, renderPageActions, renderPageBody, renderPageSection } from '/utils/page-layout.js';
import { createPageFab } from '/utils/fab.js';
import { showToast } from '/utils/toast-show.js';
import { dienst, ladeBibelDaten, DienstFehler } from './lib/dienst.js';
import { esc, ic, plusTage, uhrzeitJetzt } from './lib/werkzeug.js';
import {
  reiter, menu, menuAnker, heute, plaene, fortschritt, logbuch, statistikTab, naechsteTexte, gelesenText, eintragTexte, stellenTexte, hatNeben,
} from './lib/ansicht.js';
import { blatt, neuerAssistent, rezeptAus, nameVorschlag, zielVorschau, SCHRITTE } from './lib/blaetter.js';

// Schnittstellenstufe, die dieses Modul braucht: 2 = Stellen je Einheit, Herausnehmen (`ohne`), Ausgelassenes.
// Ein älterer Dienst läuft weiter, die Seite sagt dann, dass er veraltet ist, und zeigt keine Haken.
const DIENST_API = 2;

const VON_DIENST_NICHT_ERREICHBAR = 'Bibellese-Dienst nicht erreichbar – bitte später erneut versuchen.';

export async function render(container, { signal } = {}) {
  const S = {
    tab: 'heute', filter: 'alle', plaene: [], mitglieder: [], lesungenAlle: [], lesungenFilter: [],
    fortschrittAlle: null, fortschrittFilter: null, planDetail: {}, einstellungen: null,
    monat: null, tagWahl: null, buch: null, ui: null, busy: null, gerade: {}, saved: null,
    dabei: new Set(), assistent: null, breit: true, fehler: null, bereit: false,
    // Je Plan die Teile, die beim Abhaken herausgenommen sind: Set('zweit', 'dazu').
    ohne: {},
    // Plan, bei dem nach „Gelesen“ die Nachfrage „Was hast du gelesen?“ offen ist.
    frage: null,
  };

  // Kopf einmal bauen: der FAB dockt am Laptop in seine Aktionsleiste, ein Neuzeichnen würde ihn verlieren.
  // Der Körper steht in .app-page__body und .page-measure: erst die setzen Seitenrand und Breite.
  container.replaceChildren();
  container.insertAdjacentHTML('beforeend', `${renderPageHeader({
    title: renderPageTitle('Bibellese'),
    actions: renderPageActions('<span class="bl-kopf-aktion" data-bl-kopf></span>'),
  })}${renderPageBody({
    content: renderPageSection({ content: '<div class="bl" data-bl><div class="bl-lade" aria-busy="true">Bibellese lädt …</div></div>' }),
  })}`);
  const wurzel = container.querySelector('[data-bl]');
  const kopfAktion = container.querySelector('[data-bl-kopf]');

  // Breite messen statt Viewport (das Modul misst seine Fläche, nicht das Fenster).
  const messen = () => { S.breit = wurzel.clientWidth >= 900; };
  const beobachter = new ResizeObserver(() => { const vorher = S.breit; messen(); if (S.bereit && vorher !== S.breit) zeichne(); });
  beobachter.observe(wurzel);
  signal?.addEventListener('abort', () => beobachter.disconnect());

  // ---------------------------------------------------------------- Laden

  try {
    const [status, bibelUndKern, mitglieder] = await Promise.all([
      dienst.status({ signal }),
      ladeBibelDaten(),
      api.get('/family/members', { signal }).catch(() => ({ data: [] })),
    ]);
    if (signal?.aborted) return;
    S.ich = status.ich;
    S.dienstVersion = status.version ?? null;
    S.dienstAktuell = (status.api ?? 1) >= DIENST_API;
    S.heute = status.heute;
    S.weisheit = status.weisheit;
    S.bibel = bibelUndKern.bibel;
    S.kern = bibelUndKern.kern;
    S.mitglieder = (mitglieder.data ?? []).filter((m) => !m.deactivated_at);
    if (!S.mitglieder.some((m) => m.id === S.ich.id)) S.mitglieder.unshift({ id: S.ich.id, display_name: S.ich.name });
    S.dabei = new Set(S.mitglieder.map((m) => m.id));
    S.monat = { monat: Number(S.heute.slice(5, 7)) - 1, jahr: Number(S.heute.slice(0, 4)) };
    await Promise.all([ladePlaene(), ladeAlle(), dienst.einstellungen({ signal }).then((e) => { S.einstellungen = e; })]);
  } catch (err) {
    if (err.name === 'AbortError' || signal?.aborted) return;
    wurzel.replaceChildren();
    wurzel.insertAdjacentHTML('beforeend', fehlerSeite(err));
    window.lucide?.createIcons({ el: wurzel });
    wurzel.querySelector('[data-akt="neu-laden"]')?.addEventListener('click', () => render(container, { signal }), { signal });
    return;
  }

  if (S.ich.darfSchreiben) {
    const fab = createPageFab({
      id: 'bibellese-fab', label: 'Neu', dockLabel: 'Neu', icon: 'plus',
      onClick: (ev) => { ev.stopPropagation(); S.ui = S.ui?.was === 'neu' ? null : { art: 'menu', was: 'neu', wert: '', fab: true }; zeichne(); },
    });
    kopfAktion.after(fab);
  }
  kopfAktion.insertAdjacentHTML('beforeend', menuAnker(S, 'kopf', '', 'Mehr'));
  messen();
  S.bereit = true;
  zeichne();

  async function ladePlaene() { S.plaene = (await dienst.plaene({ signal })).plaene; }
  function zeitraum() { return [plusTage(S.heute, -400), S.heute]; }
  async function ladeAlle() {
    const [von, bis] = zeitraum();
    const [l, f] = await Promise.all([dienst.lesungen('alle', von, bis, { signal }), dienst.fortschritt('alle', { signal })]);
    S.lesungenAlle = l.lesungen;
    S.fortschrittAlle = f;
  }
  async function ladeFilter() {
    if (String(S.filter) === 'alle') { S.lesungenFilter = S.lesungenAlle; S.fortschrittFilter = S.fortschrittAlle; return; }
    const [von, bis] = zeitraum();
    S.fortschrittFilter = null;
    const [l, f] = await Promise.all([dienst.lesungen(S.filter, von, bis, { signal }), dienst.fortschritt(S.filter, { signal })]);
    S.lesungenFilter = l.lesungen;
    S.fortschrittFilter = f;
  }
  async function ladePlanDetail(id) { S.planDetail[id] = await dienst.plan(id, { signal }); }
  async function nachAenderung() {
    await Promise.all([ladePlaene(), ladeAlle()]);
    await ladeFilter();
    for (const id of Object.keys(S.planDetail)) await ladePlanDetail(id);
  }

  // ---------------------------------------------------------------- Zeichnen

  function seite() {
    if (!S.fortschrittFilter && String(S.filter) === 'alle') S.fortschrittFilter = S.fortschrittAlle;
    if (String(S.filter) === 'alle') S.lesungenFilter = S.lesungenAlle;
    const inhalt = { heute, plaene, fortschritt, logbuch, statistik: statistikTab }[S.tab](S);
    const warn = S.fehler ? `<div class="bl-alert" role="status">${ic('cloud-off')}<p>${esc(S.fehler)}</p>
        <button type="button" class="btn btn--secondary btn--sm" data-akt="erneut">${ic('refresh-cw')}Erneut versuchen</button></div>` : '';
    const nurLesen = S.ich.darfSchreiben ? '' : `<div class="bl-alert bl-alert--neutral" role="status">${ic('eye')}<p>Nur lesen: Abhaken und Eintragen sind für dieses Konto nicht freigegeben.</p></div>`;
    // Nur Admins können den Dienst aktualisieren; allen anderen fehlt dann still das Herausnehmen.
    const veraltet = S.dienstAktuell || !S.ich.admin ? '' : `<div class="bl-alert" role="status">${ic('triangle-alert')}<p>Der Bibellese-Dienst ist veraltet${S.dienstVersion ? ` (${esc(S.dienstVersion)})` : ''}. Bitte neu bauen und starten; bis dahin zählt „Gelesen“ immer alle Stellen.</p></div>`;
    return `${reiter(S)}<div class="bl-body">${warn}${veraltet}${nurLesen}${inhalt}</div>`;
  }

  function zeichne() {
    if (signal?.aborted) return;
    wurzel.classList.toggle('bl--breit', S.breit);
    const sheetScroll = wurzel.querySelector('.bl-sheet')?.scrollTop ?? 0;
    const fokus = document.activeElement?.closest?.('[data-bl]') ? document.activeElement.id : null;
    wurzel.replaceChildren();
    const neuMenu = S.ui?.art === 'menu' && S.ui.was === 'neu'
      ? `<div class="bl-fab-menu" style="${fabMenuPosition()}">${menu(S, 'neu', '')}</div>` : '';
    wurzel.insertAdjacentHTML('beforeend', `${seite()}${blatt(S)}${neuMenu}`);
    // Kopfmenü steht außerhalb der Wurzel (im Seitenkopf).
    const kopfAnker = kopfAktion.querySelector('.bl-anker');
    kopfAnker?.replaceWith(document.createRange().createContextualFragment(menuAnker(S, 'kopf', '', 'Mehr')));
    const sheet = wurzel.querySelector('.bl-sheet');
    if (sheet) sheet.scrollTop = sheetScroll;
    for (const h of wurzel.querySelectorAll('.bl-heat-scroll')) h.scrollLeft = h.scrollWidth;
    window.lucide?.createIcons({ el: wurzel });
    window.lucide?.createIcons({ el: kopfAktion });
    if (fokus) document.getElementById(fokus)?.focus();
    else if (S.ui?.art === 'blatt' && !sheet?.contains(document.activeElement)) sheet?.querySelector('.bl-sheet__head h2')?.setAttribute('tabindex', '-1');
  }

  function fabMenuPosition() {
    const fab = document.getElementById('bibellese-fab');
    if (!fab) return 'right:16px;bottom:96px';
    const r = fab.getBoundingClientRect();
    return r.top > window.innerHeight / 2
      ? `right:${Math.max(12, window.innerWidth - r.right)}px;bottom:${window.innerHeight - r.top + 8}px`
      : `right:${Math.max(12, window.innerWidth - r.right)}px;top:${r.bottom + 8}px`;
  }

  // ---------------------------------------------------------------- Handlungen

  const meldeFehler = (err) => {
    if (err instanceof DienstFehler && err.code === 'offline') S.fehler = VON_DIENST_NICHT_ERREICHBAR;
    showToast(err.message || 'Das hat nicht geklappt.', 'error', 6000);
  };

  async function mitBusy(schluessel, fn) {
    S.busy = schluessel;
    zeichne();
    try { await fn(); S.fehler = null; } catch (err) { meldeFehler(err); } finally { S.busy = null; zeichne(); }
  }

  async function abhaken(planId, datum) {
    const p = S.plaene.find((x) => x.id === Number(planId));
    if (!p?.naechste) return;
    const ohne = S.ohne[p.id] ?? new Set();
    await mitBusy(p.id, async () => {
      const r = await dienst.abhaken({
        planId: p.id, ...(datum ? { datum } : {}), dabei: p.art === 'gemeinsam' ? [...S.dabei] : undefined, ohne: [...ohne],
      });
      // Gemeldet wird, was gezählt hat: ohne die herausgenommenen Stellen.
      const text = gelesenText(naechsteTexte(S, p), S.dienstAktuell ? ohne : new Set());
      const vorher = S.gerade[p.id];
      if (!datum || datum === S.heute) S.gerade[p.id] = { text, uhrzeit: uhrzeitJetzt() };
      delete S.ohne[p.id];
      await nachAenderung();
      showToast(`${text} gelesen`, 'success', 5000, async () => {
        try {
          await dienst.lesungLoeschen(r.lesung);
          S.gerade[p.id] = vorher;
          await nachAenderung();
          zeichne();
        } catch (err) { meldeFehler(err); zeichne(); }
      });
    });
  }

  async function eintragSpeichern() {
    const f = wurzel.querySelector('[data-form="eintrag"]');
    const edit = S.ui.edit ? [...S.lesungenAlle, ...S.lesungenFilter].find((l) => l.id === S.ui.edit) : null;
    const daten = { datum: f.datum.value || S.heute, uhrzeit: f.zeit.value || undefined, notiz: f.notiz.value.trim() };
    if (edit?.quelle === 'plan' && S.dienstAktuell && eintragTexte(S, edit).hat.length) daten.ohne = [...S.ui.ohne];
    if (!edit || edit.quelle === 'frei') {
      const b = S.bibel.buch(f.buch.value);
      const von = Number(f.von.value);
      const bis = Number(f.bis.value);
      let fehler = '';
      if (!von || !bis) fehler = 'Kapitel von und bis eintragen.';
      else if (bis < von) fehler = 'Bis-Kapitel liegt vor dem Von-Kapitel.';
      else if (bis > b.kapitel || von > b.kapitel) fehler = `${b.name} hat ${b.kapitel} Kapitel.`;
      if (fehler) {
        S.ui.fehler = fehler;
        S.ui.werte = { buch: f.buch.value, von: f.von.value, bis: f.bis.value, datum: f.datum.value, zeit: f.zeit.value, notiz: f.notiz.value };
        zeichne();
        wurzel.querySelector('#bl-bis')?.focus();
        return;
      }
      daten.stuecke = [{ b: b.id, von: [von, 1], bis: [bis, b.verse[bis - 1]] }];
    }
    await mitBusy('eintrag', async () => {
      if (edit) {
        await dienst.lesungAendern(edit.id, daten);
        S.ui = null;
        await nachAenderung();
        showToast('Eintrag gespeichert', 'success', 3000);
        return;
      }
      const ziel = S.ui.ziel && S.ui.ziel !== 'ich' ? Number(S.ui.ziel) : null;
      const r = await dienst.eintragen({ ...daten, ...(ziel ? { planId: ziel, dabei: [...S.dabei] } : {}) });
      S.ui = null;
      await nachAenderung();
      showToast(`${stellenTexte(S, daten.stuecke, null, { ersatz: r.text }).text} eingetragen`, 'success', 5000, async () => {
        try { await dienst.lesungLoeschen(r.lesung); await nachAenderung(); zeichne(); } catch (err) { meldeFehler(err); zeichne(); }
      });
    });
  }

  async function oeffneBlatt(was, planId, extra = {}) {
    S.ui = { art: 'blatt', was, plan: planId ? Number(planId) : null, ...extra };
    const p = S.plaene.find((x) => x.id === S.ui.plan);
    if (was === 'aufholen' && p) {
      Object.assign(S.ui, { start: p.stand.gelesen, heuteOffen: !p.stand.heuteGelesen, anzahl: p.stand.verzug + (p.stand.heuteGelesen ? 0 : 1) });
    }
    zeichne();
    if (['plan', 'aufholen'].includes(was) && p && !S.planDetail[p.id]) {
      try { await ladePlanDetail(p.id); } catch (err) { meldeFehler(err); }
      zeichne();
    }
  }

  async function behandle(el) {
    const { akt, wert, was } = el.dataset;
    const planId = el.dataset.plan;
    if (S.ui?.art === 'menu' && akt !== 'menu' && !el.closest('.bl-menu')) S.ui = null;
    switch (akt) {
      case 'tab':
        S.tab = wert; S.ui = null; S.tagWahl = null;
        zeichne();
        if (['fortschritt', 'logbuch', 'statistik'].includes(wert) && String(S.filter) !== 'alle' && !S.fortschrittFilter) { await ladeFilter(); zeichne(); }
        return;
      case 'filter':
        S.filter = wert === 'alle' ? 'alle' : Number(wert); S.buch = null; S.tagWahl = null;
        zeichne();
        try { await ladeFilter(); } catch (err) { meldeFehler(err); }
        zeichne();
        return;
      case 'menu': {
        const offen = S.ui?.art === 'menu' && S.ui.was === was && String(S.ui.wert) === String(wert);
        S.ui = offen ? null : { art: 'menu', was, wert };
        zeichne();
        return;
      }
      case 'dabei': {
        const id = Number(wert);
        if (S.dabei.has(id) && S.dabei.size > 1) S.dabei.delete(id); else S.dabei.add(id);
        zeichne();
        return;
      }
      case 'teil': {
        // Nebenstelle vor dem Abhaken herausnehmen oder wieder mitzählen (Karte und Logbuch-Blatt).
        const menge = planId ? (S.ohne[planId] ??= new Set()) : S.ui?.ohne;
        if (!menge) return;
        if (menge.has(wert)) menge.delete(wert); else menge.add(wert);
        zeichne();
        return;
      }
      case 'gelesen':
      case 'gelesen-blatt': {
        // Mit Nebenstellen erst fragen, was gelesen wurde (alles vorausgewählt); sonst gleich eintragen.
        if (akt === 'gelesen') S.ui = null;
        const p = S.plaene.find((x) => x.id === Number(planId));
        if (p && S.dienstAktuell && hatNeben(naechsteTexte(S, p))) {
          S.frage = p.id;
          S.ohne[p.id] = new Set();
          zeichne();
          wurzel.querySelector('[data-akt="frage-eintragen"]')?.focus();
          return;
        }
        await abhaken(planId);
        return;
      }
      case 'frage-eintragen': S.frage = null; await abhaken(planId); return;
      case 'frage-abbrechen': S.frage = null; delete S.ohne[planId]; zeichne(); return;
      case 'gelesen-am': {
        const am = wurzel.querySelector('#bl-am')?.value || plusTage(S.heute, -1);
        S.ui = null;
        await abhaken(planId, am);
        return;
      }
      case 'blatt':
        // „Gelesen am …“ beginnt mit allen Stellen ausgewählt.
        if (was === 'gelesenAm' && planId) { S.ohne[planId] = new Set(); S.frage = null; }
        await oeffneBlatt(was, planId);
        return;
      case 'schliessen': S.ui = null; S.assistent = null; zeichne(); return;
      case 'eintragen': {
        const p = S.plaene.find((x) => x.id === S.filter);
        await oeffneBlatt('eintragen', null, { datum: wert || null, ziel: p?.art === 'gemeinsam' ? String(p.id) : 'ich', buchVorschlag: S.plaene[0]?.aktuellesBuch });
        return;
      }
      case 'bearbeiten': {
        const l = [...S.lesungenAlle, ...S.lesungenFilter].find((x) => x.id === Number(wert));
        await oeffneBlatt('eintragen', null, { edit: Number(wert), ohne: new Set(l ? eintragTexte(S, l).ohne : []) });
        return;
      }
      case 'logbuch-wahl': S.ui.ziel = wert; zeichne(); return;
      case 'eintrag-speichern': await eintragSpeichern(); return;
      case 'loeschen': {
        const id = Number(wert);
        S.ui = null;
        await mitBusy('loeschen', async () => {
          await dienst.lesungLoeschen(id);
          await nachAenderung();
          showToast('Eintrag gelöscht', 'success', 5000, async () => {
            try { await dienst.lesungWiederherstellen(id); await nachAenderung(); zeichne(); } catch (err) { meldeFehler(err); zeichne(); }
          });
        });
        return;
      }
      case 'assistent': S.assistent = neuerAssistent(S); await oeffneBlatt('assistent'); return;
      case 'assistent-weiter': S.assistent.schritt = Math.min(SCHRITTE.length, S.assistent.schritt + 1); zeichne(); return;
      case 'assistent-zurueck': S.assistent.schritt = Math.max(1, S.assistent.schritt - 1); zeichne(); return;
      case 'assistent-schritt': S.assistent.schritt = Number(wert); zeichne(); return;
      case 'assistent-wert': S.assistent[was] = was === 'minuten' ? Number(wert) : wert; zeichne(); return;
      case 'assistent-schalter':
        if (was === 'weisheit') S.assistent.weisheit = !S.assistent.weisheit;
        else S.assistent.parallelen[was.slice(2)] = !S.assistent.parallelen[was.slice(2)];
        zeichne();
        return;
      case 'assistent-buch': {
        const menge = new Set(S.assistent.buecher);
        if (menge.has(wert)) menge.delete(wert); else menge.add(wert);
        S.assistent.buecher = S.bibel.buecher.filter((b) => menge.has(b.id)).map((b) => b.id);
        zeichne();
        return;
      }
      case 'assistent-fertig': {
        const a = S.assistent;
        const name = a.name.trim() || nameVorschlag(S, a);
        await mitBusy('assistent', async () => {
          const p = await dienst.planAnlegen({ name, art: a.art, rezept: rezeptAus(S, a) });
          S.ui = null; S.assistent = null; S.tab = 'heute';
          await nachAenderung();
          showToast(`„${name}“ angelegt`, 'success', 5000, async () => {
            try { await dienst.planLoeschen(p.id); await nachAenderung(); zeichne(); } catch (err) { meldeFehler(err); zeichne(); }
          });
        });
        return;
      }
      case 'uebernehmen': {
        const quelle = S.plaene.find((x) => x.id === Number(planId));
        await mitBusy('uebernehmen', async () => {
          const p = await dienst.uebernehmen(quelle.id);
          S.ui = null;
          await nachAenderung();
          showToast(`„${quelle.name}“ übernommen`, 'success', 5000, async () => {
            try { await dienst.planLoeschen(p.id); await nachAenderung(); zeichne(); } catch (err) { meldeFehler(err); zeichne(); }
          });
        });
        return;
      }
      case 'plan-loeschen': {
        const p = S.plaene.find((x) => x.id === Number(planId));
        S.ui = null;
        await mitBusy('plan', async () => {
          await dienst.planLoeschen(p.id);
          await nachAenderung();
          showToast(`„${p.name}“ gelöscht`, 'success', 6000, async () => {
            try { await dienst.planWiederherstellen(p.id); await nachAenderung(); zeichne(); } catch (err) { meldeFehler(err); zeichne(); }
          });
        });
        return;
      }
      case 'neu-einteilen': {
        const p = S.plaene.find((x) => x.id === Number(planId));
        S.ui = null;
        await mitBusy('plan', async () => {
          await dienst.neuEinteilen(p.id);
          await nachAenderung();
          showToast(`„${p.name}“ neu eingeteilt`, 'success', 5000, async () => {
            try { await dienst.neuEinteilenZurueck(p.id); await nachAenderung(); zeichne(); } catch (err) { meldeFehler(err); zeichne(); }
          });
        });
        return;
      }
      case 'noch-einmal': await mitBusy('plan', async () => { await dienst.nochEinmal(Number(planId)); await nachAenderung(); }); return;
      case 'ziel-setzen': {
        const f = wurzel.querySelector('[data-form="ziel"]');
        const p = S.plaene.find((x) => x.id === Number(planId));
        const neu = f.art.value === 'verzug' ? p.stand.ende : f.datum.value;
        if (!neu || neu <= S.heute) { f.datum.focus(); return; }
        await mitBusy('ziel', async () => {
          const r = await dienst.zielSetzen(p.id, neu);
          S.ui = null;
          await nachAenderung();
          showToast(`Ziel auf ${neu.slice(8, 10)}.${neu.slice(5, 7)}.${neu.slice(0, 4)} verschoben`, 'success', 5000, async () => {
            try { await dienst.zielZurueck(p.id, r.aenderung); await nachAenderung(); zeichne(); } catch (err) { meldeFehler(err); zeichne(); }
          });
        });
        return;
      }
      case 'monat': {
        const d = new Date(Date.UTC(S.monat.jahr, S.monat.monat + Number(wert), 1));
        if (d.toISOString().slice(0, 7) > S.heute.slice(0, 7)) return;
        S.monat = { monat: d.getUTCMonth(), jahr: d.getUTCFullYear() };
        S.tagWahl = null;
        zeichne();
        return;
      }
      case 'tag': S.tagWahl = S.tagWahl === wert ? null : wert; if (S.tab !== 'logbuch') S.tab = 'logbuch'; zeichne(); return;
      case 'tag-alle': S.tagWahl = null; zeichne(); return;
      case 'buch':
        S.buch = wert;
        if (!S.breit) await oeffneBlatt('buch', null, { wert });
        else zeichne();
        return;
      case 'einst-zaehlt': {
        const neu = !S.einstellungen.person.gemeinsamZaehlt;
        S.einstellungen.person.gemeinsamZaehlt = neu;
        await speichereEinstellung('gemeinsamZaehlt', { person: { gemeinsamZaehlt: neu } }, () => { S.einstellungen.person.gemeinsamZaehlt = !neu; });
        await nachAenderung();
        zeichne();
        return;
      }
      case 'einst-anlegen': {
        const alt = S.einstellungen.haushalt.gemeinsameAnlegen;
        S.einstellungen.haushalt.gemeinsameAnlegen = wert;
        await speichereEinstellung('anlegen', { haushalt: { gemeinsameAnlegen: wert } }, () => { S.einstellungen.haushalt.gemeinsameAnlegen = alt; });
        return;
      }
      case 'erneut':
        await mitBusy('laden', async () => { await nachAenderung(); });
        return;
      default:
    }
  }

  async function speichereEinstellung(schluessel, daten, zurueck) {
    zeichne();
    try {
      await dienst.einstellungenSetzen(daten);
      S.saved = schluessel;
      setTimeout(() => { if (S.saved === schluessel) { S.saved = null; zeichne(); } }, 2000);
    } catch (err) {
      zurueck();
      meldeFehler(err);
    }
    zeichne();
  }

  // ---------------------------------------------------------------- Ereignisse

  const klick = (ev) => {
    const el = ev.target.closest('[data-akt]');
    const imModul = ev.target.closest('[data-bl], [data-bl-kopf]');
    if (!el || el.disabled || !imModul) {
      if (S.ui?.art === 'menu' && !ev.target.closest('.bl-menu') && !ev.target.closest('#bibellese-fab')) { S.ui = null; zeichne(); }
      return;
    }
    if (el.tagName === 'A') return;
    ev.preventDefault();
    behandle(el);
  };
  document.addEventListener('click', klick, { signal });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && S.ui) { S.ui = null; S.assistent = null; zeichne(); } else if (ev.key === 'Escape' && S.frage) { delete S.ohne[S.frage]; S.frage = null; zeichne(); }
  }, { signal });

  // Formularfelder: „Ziel verschieben“ zeigt seine Vorschau am Ort (der Fokus bleibt im Feld),
  // der Assistent übernimmt Auswahlfelder sofort und den Namen ohne Neuzeichnen.
  wurzel.addEventListener('input', (ev) => {
    const zf = ev.target.closest('[data-form="ziel"]');
    if (zf && S.ui?.was === 'ziel') {
      if (ev.target.name === 'datum') zf.querySelector('input[value="datum"]').checked = true;
      S.ui.zielArt = zf.art.value;
      S.ui.datumWert = zf.datum.value;
      const p = S.plaene.find((x) => x.id === S.ui.plan);
      zf.querySelector('[data-vorschau]').textContent = zielVorschau(S, p, S.ui.zielArt === 'verzug' ? p.stand.ende : zf.datum.value);
      return;
    }
    if (ev.target.closest('[data-form="assistent"]') && ev.target.name === 'name') S.assistent.name = ev.target.value;
  }, { signal });
  wurzel.addEventListener('change', (ev) => {
    if (!ev.target.closest('[data-form="assistent"]') || !S.assistent) return;
    const t = ev.target;
    const a = S.assistent;
    if (t.name === 'name') return;
    if (['auswahl', 'gruppe', 'startArt', 'start', 'art', 'bis', 'beginn'].includes(t.name)) a[t.name] = t.value;
    if (t.name === 'gruppe') a.auswahl = 'gruppe';
    if (t.name === 'start') a.startArt = 'buch';
    if (t.name === 'startArt' && t.value === 'buch' && !a.start) a.start = t.form.start?.value ?? null;
    if (t.name === 'auswahl') { a.startArt = 'anfang'; a.start = null; }
    zeichne();
  }, { signal });
}

function fehlerSeite(err) {
  const offline = err instanceof DienstFehler && (err.code === 'offline' || err.status === 404);
  const titel = offline ? 'Bibellese-Dienst nicht erreichbar' : err.status === 401 ? 'Bitte anmelden' : 'Bibellese konnte nicht laden';
  const text = offline
    ? 'Der Dienst läuft als eigener Container neben Yuvomi. Prüfe, ob er gestartet ist und der Proxy /api/extensions/bibellese/ zu ihm leitet.'
    : esc(err.message);
  return `<div class="bl-empty"><span class="bl-empty__icon">${ic('cloud-off')}</span><h3>${titel}</h3><p>${text}</p>
    <div class="bl-empty__actions"><button type="button" class="btn btn--secondary" data-akt="neu-laden">${ic('refresh-cw')}Erneut versuchen</button></div></div>`;
}
