import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bibel } from '../src/kern.js';
import {
  erzeugePlan, neuEinteilen, stand, fortschritt, einheitText, bausteine, kalender, WEISHEIT, minutenDerEinheit,
} from '../../modules/bibellese/kern/index.js';

const rezept = (extra = {}) => ({
  straenge: [{ buecher: 'bibel' }], einteilung: 'kapitel-sinn', parallelen: [],
  lesetage: [0, 1, 2, 3, 4, 5, 6], ziel: { datum: '2027-10-28' }, woerter_je_minute: 200, begonnen_am: '2026-10-29',
  ...extra,
});
const alleVerse = (einheiten) => einheiten.flatMap((e) => e.stuecke).reduce((s, x) => {
  const buch = bibel.buch(x.b);
  return s + buch.pos(x.bis) - buch.pos(x.von) + 1;
}, 0);

test('Daten: 66 Bücher, 1.189 Kapitel, 31.171 Verse', () => {
  assert.equal(bibel.buecher.length, 66);
  assert.equal(bibel.kapitelGesamt, 1189);
  assert.equal(bibel.versGesamt, 31171);
});

test('Kalender: Lesetage und n-ter Lesetag', () => {
  assert.equal(kalender.lesetage([0, 1, 2, 3, 4, 5, 6], '2026-10-29', '2027-12-31'), 429);
  assert.equal(kalender.nterLesetag([0, 1, 2, 3, 4, 5, 6], '2026-10-29', 432), '2028-01-03');
  assert.equal(kalender.lesetage([1, 2, 3, 4, 5], '2026-10-26', '2026-11-01'), 5);
  assert.equal(kalender.nterLesetag([1, 2, 3, 4, 5], '2026-10-31', 1), '2026-11-02');
});

test('Ganze Bibel in einem Jahr: jeder Vers genau einmal, 365 Lesungen bis zum Ziel', () => {
  const p = erzeugePlan(bibel, rezept());
  assert.equal(p.n, 365);
  assert.equal(p.ende, '2027-10-28');
  assert.equal(alleVerse(p.einheiten), 31171);
  assert.equal(einheitText(bibel, p.einheiten[0].stuecke), '1. Mose 1–3');
  assert.ok(p.minutenJe > 9 && p.minutenJe < 11);
});

test('Ein Baustein wird nie geteilt: Psalm 119 bleibt eine Lesung', () => {
  const p = erzeugePlan(bibel, rezept());
  const ps119 = p.einheiten.filter((e) => e.stuecke.some((s) => s.b === 'Ps' && s.von[0] <= 119 && s.bis[0] >= 119));
  assert.equal(ps119.length, 1);
});

test('Ring: ab Jesaja, nichts fällt weg, 1. Mose kommt nach der Offenbarung', () => {
  const p = erzeugePlan(bibel, rezept({ straenge: [{ buecher: 'bibel', start: 'Isa' }] }));
  assert.equal(p.einheiten[0].stuecke[0].b, 'Isa');
  assert.equal(alleVerse(p.einheiten), 31171);
  const letzte = p.einheiten.at(-1).stuecke.at(-1);
  assert.equal(letzte.b, 'Song');
});

test('Zweiter Strang Weisheit: läuft einmal gleichmäßig mit, alle Verse da', () => {
  const p = erzeugePlan(bibel, rezept({ straenge: [{ buecher: 'bibel', ohne: WEISHEIT }, { buecher: WEISHEIT }] }));
  assert.equal(alleVerse(p.einheiten), 31171);
  assert.equal(p.straenge, 2);
  assert.ok(p.einheiten[0].stuecke.some((s) => s.b === 'Job'));
});

test('Parallelen: 2Kö 18,13–20,19 wird bei Jesaja 36–39 mitgelesen, wenn Jesaja zuerst kommt', () => {
  const r = rezept({ straenge: [{ buecher: 'bibel', start: 'Isa' }], parallelen: ['geschichte'] });
  const p = erzeugePlan(bibel, r);
  const text = p.einheiten.map((e) => einheitText(bibel, e.stuecke));
  assert.ok(text.some((t) => t.startsWith('Jesaja 36') && t.includes('dazu 2. Könige 18,13')));
  assert.equal(alleVerse(p.einheiten), 31171);
});

test('Parallelen nur innerhalb der Auswahl', () => {
  const b = bausteine(bibel, { buecher: ['1Kgs', '2Kgs'] }, { parallelen: ['geschichte'] });
  assert.ok(b.every((x) => x.stuecke.every((s) => ['1Kgs', '2Kgs'].includes(s.b))));
});

test('Minuten statt Zieldatum, Johannes Mo–Fr: keine Mini-Lesung am Buchende', () => {
  const p = erzeugePlan(bibel, rezept({ straenge: [{ buecher: ['John'] }], ziel: { minuten: 5 }, lesetage: [1, 2, 3, 4, 5] }));
  // Joh 7,53–8,11 liegt quer zur Kapitelgrenze: Joh 7–8 bleibt eine Lesung, deshalb 18 statt 20.
  assert.equal(p.n, 18);
  assert.equal(einheitText(bibel, p.einheiten.at(-1).stuecke), 'Johannes 21');
  assert.ok(p.einheiten.every((e) => minutenDerEinheit(e, 200) > 2));
});

test('Zieldatum wird genau getroffen, auch über ein Schaltjahr', () => {
  const p = erzeugePlan(bibel, rezept({ ziel: { datum: '2028-10-28' }, parallelen: ['geschichte'] }));
  assert.equal(p.n, 731);
  assert.equal(p.ende, '2028-10-28');
});

test('Zu viele Lesungen gewünscht: höchstens so viele, wie es Grenzen gibt', () => {
  const p = erzeugePlan(bibel, rezept({ straenge: [{ buecher: ['Obad'] }], ziel: { datum: '2026-12-31' } }));
  assert.equal(p.begrenzt, true);
  assert.equal(p.n, 1);
});

test('Verzug, Vorsprung, Prognose', () => {
  const plan = { einheiten: Array(730).fill({}), lesetage: [0, 1, 2, 3, 4, 5, 6], ziel: '2027-12-31' };
  const s = stand(plan, { gelesen: 298, heuteGelesen: false, heute: '2026-10-29' });
  assert.equal(s.verzug, 3);
  assert.equal(s.ende, '2028-01-03');
  assert.equal(s.wiederImPlan, '2026-10-31');
  const nachHeute = stand(plan, { gelesen: 299, heuteGelesen: true, heute: '2026-10-29' });
  assert.equal(nachHeute.verzug, 3); // die erste Einheit des Tages ist die von heute
  const weiter = stand(plan, { gelesen: 300, heuteGelesen: true, heute: '2026-10-29' });
  assert.equal(weiter.verzug, 2);
  const spaeter = stand({ ...plan, ziel: '2028-01-10' }, { gelesen: 298, heuteGelesen: false, heute: '2026-10-29' });
  assert.equal(spaeter.vorsprung, 7);
  assert.equal(stand({ ...plan, lesetage: null }, { gelesen: 1, heuteGelesen: false, heute: '2026-10-29' }).ohneRhythmus, true);
});

test('Neu einteilen: Gelesenes bleibt, der Rest passt bis zum Ziel', () => {
  const r = rezept({ ziel: { datum: '2028-10-28' } });
  const p = erzeugePlan(bibel, r);
  const vorher = stand({ einheiten: p.einheiten, lesetage: r.lesetage, ziel: p.ende }, { gelesen: 5, heuteGelesen: false, heute: '2026-11-08' });
  assert.ok(vorher.verzug > 0);
  const neu = neuEinteilen(bibel, r, p.einheiten, 5, vorher.vorrat);
  assert.deepEqual(neu.slice(0, 5), p.einheiten.slice(0, 5));
  assert.equal(alleVerse(neu), 31171);
  const nachher = stand({ einheiten: neu, lesetage: r.lesetage, ziel: p.ende }, { gelesen: 5, heuteGelesen: false, heute: '2026-11-08' });
  assert.equal(nachher.verzug, 0);
});

test('Fortschritt: Kapitel zählt erst, wenn alle Verse gelesen sind; Plan geht vor frei', () => {
  const f = fortschritt(bibel, [
    { quelle: 'frei', stuecke: [{ b: 'Rom', von: [8, 1], bis: [8, 39] }] },
    { quelle: 'plan', stuecke: [{ b: 'Rom', von: [8, 1], bis: [8, 20] }] },
    { quelle: 'plan', stuecke: [{ b: 'Gen', von: [1, 1], bis: [2, 3] }] },
  ]);
  assert.equal(f.jeBuch.Rom.kapitel.get(8), 'frei');
  assert.equal(f.jeBuch.Gen.kapitel.get(1), 'plan');
  assert.equal(f.jeBuch.Gen.kapitel.has(2), false);
  assert.equal(f.jeBuch.Gen.begonnen, 1);
  assert.equal(f.gesamt, 2);
});
