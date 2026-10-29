// Lesezeichen, Ziel, Verzug, Prognose (KONZEPT.md §2).
//
//   Rest     = Einheiten im Plan − gelesene
//   Vorrat   = Lesetage von heute bis zum Ziel (ab morgen, wenn heute schon gelesen)
//   Abstand  = Rest − Vorrat     (> 0 Verzug, < 0 Vorsprung)
//
// Die erste Einheit eines Tages ist die von heute; erst jede weitere baut Verzug ab.
// Ohne festen Rhythmus gibt es weder Ziel noch Verzug.

import { lesetage, nterLesetag, plusTage } from './kalender.js';

/** Bis zu so vielen Einheiten Rückstand zeigt das Modul nur das Ziel, ohne Warnfarbe. */
export const PUFFER = 2;

/**
 * plan: { einheiten, lesetage, ziel, ziel_urspruenglich? }
 * gelesen: Zahl der abgehakten Einheiten, heuteGelesen: ob heute schon eine abgehakt ist.
 */
export function stand(plan, { gelesen, heuteGelesen, heute }) {
  const anzahl = plan.einheiten.length;
  const rest = Math.max(0, anzahl - gelesen);
  const basis = {
    anzahl, gelesen, rest, heuteGelesen,
    naechsteNr: gelesen < anzahl ? gelesen + 1 : null,
  };
  if (!plan.lesetage?.length || !plan.ziel) {
    return { ...basis, ohneRhythmus: true, verzug: 0, vorsprung: 0, ziel: null, ende: null };
  }
  const ab = heuteGelesen ? plusTage(heute, 1) : heute;
  const vorrat = plan.ziel >= ab ? lesetage(plan.lesetage, ab, plan.ziel) : 0;
  const abstand = rest - vorrat;
  const verzug = Math.max(0, abstand);
  return {
    ...basis,
    vorrat,
    verzug,
    vorsprung: Math.max(0, -abstand),
    ziel: plan.ziel,
    ende: rest > 0 ? nterLesetag(plan.lesetage, ab, rest) : null,
    // Aufholen: an jedem Lesetag ab heute eine Einheit mehr. Der Tag, an dem der Verzug 0 ist.
    wiederImPlan: verzug > 0 ? nterLesetag(plan.lesetage, heute, verzug) : null,
    // Groß ist ein Verzug, den man in zwei Wochen nur mit mehr als einer Einheit extra je Tag aufholt.
    grosserVerzug: verzug > lesetage(plan.lesetage, heute, plusTage(heute, 13)),
    imPuffer: verzug > 0 && verzug <= PUFFER,
  };
}
