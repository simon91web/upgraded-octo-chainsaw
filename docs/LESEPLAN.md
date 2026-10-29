# Bibellese – wie Lesepläne entstehen

Entwurf, Stand 29.10.2026. Ergänzt [KONZEPT.md](KONZEPT.md): §2 (Lesezeichen) gilt weiter, §4 und §7 werden hiervon
abgelöst (siehe §11).

Jedes Mitglied stellt sich seinen Plan aus wenigen Antworten zusammen. Das Modul erzeugt daraus eine **Liste von
Einheiten ohne Datum**. Gelesen wird immer die nächste – der Plan ist geduldig wie Papier.

```text
Antworten ─► Bücher wählen ─► ordnen ─► Ring drehen ─► Parallelen bündeln ─► einteilen ─► Einheiten
(Rezept)                      kanonisch/  (Startpunkt)   (optional)            (Rechenkern)  (fester Stand)
                              chronologisch
```

---

## 1. Was gelesen wird: Stränge

Ein Plan hat einen oder mehrere **Stränge**. Ein Strang ist eine Auswahl von Büchern in einer Reihenfolge. Jede
Einheit enthält aus jedem Strang ein Stück; alle Stränge enden gemeinsam.

| Auswahl | Bücher |
|---|---|
| Ganze Bibel | alle 66 |
| Altes / Neues Testament | 39 / 27 |
| Buchgruppe | z. B. Evangelien, Paulusbriefe, Kleine Propheten (Gruppen aus `buecher.json`) |
| Einzelne Bücher | frei angehakt, auch nur eins |
| **Weisheitsliteratur** | Hiob, Psalmen, Sprüche, Prediger, Hoheslied (4.851 von 31.172 Versen, 16 %) |

| Reihenfolge | Woher |
|---|---|
| Kanonisch | Reihenfolge in `buecher.json` |
| Chronologisch | eigene Quelldatei `quellen/chronologisch.txt` (§10); eine Buchauswahl filtert sie |

**Beispiele**

| Plan | Stränge |
|---|---|
| Ganze Bibel | 1: ganze Bibel |
| Bibel und dazu die Weisheitsliteratur | 1: ganze Bibel ohne Hiob–Hoheslied · 2: Hiob–Hoheslied |
| AT und NT parallel | 1: AT · 2: NT |
| Johannes | 1: Johannes |

Der zweite Strang läuft **einmal, gleichmäßig verteilt** mit (Vorschlag). Hat er weniger Bausteine als der Plan
Einheiten, bleibt er an einzelnen Tagen leer, gleichmäßig gestreut.

---

## 2. Wo man anfängt: der Ring

Die Reihenfolge eines Strangs ist ein Ring. Ein Startpunkt dreht den Ring, nichts fällt weg:

```text
Ganze Bibel ab Jesaja:   Jes … Mal │ Mt … Offb │ 1Mo … Hld
Johannes ab Kapitel 5:   Joh 5 … 21 │ Joh 1 … 4
```

- Startpunkt ist ein Buch, ein Kapitel oder ein Vers. Er rastet am Anfang des Sinnabschnitts ein, in dem er liegt.
- Jeder Strang hat seinen eigenen Startpunkt, ohne Angabe den Anfang.
- In chronologischer Reihenfolge dreht sich derselbe Ring, nur eben der chronologische.

---

## 3. Parallelstellen zusammen lesen

Manche Abschnitte erzählen dasselbe zweimal (Könige und Chronik, Samuel und Psalmen, die Evangelien). Wer das
einschaltet, liest Parallelen **in derselben Einheit** statt Monate auseinander.

**Regel:** Die Stelle, die im (gedrehten) Plan zuerst kommt, ist die **Leitstelle**. Ihre Parallelen werden zu ihr
geholt und an ihrem eigenen Platz übersprungen. Dort bleibt nur das **Sondergut** stehen.

```text
ohne:   … 1Kö 8 … … … … … … … … … … … … 2Chr 5,2–7,10 …
mit:    … 1Kö 8 · 2Chr 5,2–7,10 … … … … … 2Chr 7,11 …          (2Chr 5–7 nur noch, was nicht parallel ist)
```

- Parallelen werden nur gebündelt, wenn alle Teile im selben Strang liegen (Vorschlag). Ps 18 im Weisheitsstrang
  bleibt also dort, auch wenn 2Sam 22 im Hauptstrang steht.
- Nur Teile innerhalb der Auswahl. Wer nur die Könige liest, bekommt die Chronik nicht dazu (später als Option
  „Parallelen aus anderen Büchern dazunehmen“ denkbar).
- Startpunkt bei Jesaja: Jes 36–39 kommt zuerst und wird Leitstelle, 2Kö 18,13–20,19 wird dort mitgelesen.
- In der Einheit steht die Leitstelle vorn: „1Kö 8 · dazu 2Chr 5,2–7,10“.

**Schalter je Art** (im Assistenten: „Parallelen zusammen lesen“):

| Art | Beispiele | Umfang der Daten |
|---|---|---|
| Geschichte | 1Sam 31 ∥ 1Chr 10 · 2Sam 5,1–10 ∥ 1Chr 11,1–9 · 2Sam 7 ∥ 1Chr 17 · 1Kö 8 ∥ 2Chr 5,2–7,10 · 2Kö 18,13–20,19 ∥ Jes 36–39 ∥ 2Chr 32,1–26 · 2Kö 20,20–21 ∥ 2Chr 32,27–33 · 2Kö 24,18–25,30 ∥ Jer 52 · Esr 2 ∥ Neh 7,6–73 | einige Dutzend Gruppen |
| Lieder | 2Sam 22 ∥ Ps 18 · Ps 14 ∥ Ps 53 | wenige |
| Gesetz | 2Mo 20,1–17 ∥ 5Mo 5,6–21 (Zehn Gebote) | wenige |
| Evangelien | Mt 14,13–21 ∥ Mk 6,30–44 ∥ Lk 9,10–17 ∥ Joh 6,1–15 | eine ganze Synopse, mehrere hundert Gruppen – zweiter Schritt |

Bei den Evangelien wird Markus fast leer, wenn Matthäus Leitstelle ist – das ist gewollt, aber man sollte es wissen.

**Grenzen der Daten:**

- Jeder Teil einer Parallele ist ein ganzer Sinnabschnitt oder eine Folge davon; ein Vers gehört höchstens zu
  einer Gruppe.
- Lieber etwas Sondergut mitnehmen als eigens für eine Parallele einen Mini-Abschnitt anlegen; kein neuer Abschnitt
  unter 5 Versen.
- **Psalmen bleiben ganz** (Vorschlag): Teil-Parallelen wie Ps 40,14–18 ∥ Ps 70 oder Ps 108 ∥ Ps 57/60 werden nicht
  gebündelt, ebenso Bruchstücke wie Ps 106,1.47–48 (∥ 1Chr 16,34–36).

---

## 4. Wo geteilt wird: die Einteilung

**Bausteine** sind die Sinnabschnitte aus `quellen/perikopen/`, zusätzlich an jedem Kapitelende geteilt (1.985
Abschnitte, rund 2.000 Bausteine; ein Abschnitt je Psalm, Ps 119 in 22 Strophen). Ein gebündeltes Parallelpaar ist
ein Baustein. **Ein Baustein wird nie geteilt – Sinn geht vor Zeit.** Psalm 119 bleibt kapitelweise eine Lesung;
nach Sinnabschnitten sind es 22 Strophen.

Jede Grenze zwischen zwei Bausteinen hat eine Art. Die Einteilung legt fest, welche erlaubt sind; die Abzüge
entscheiden zwischen ähnlich langen Möglichkeiten.

| Grenze | Beispiel | Kapitelweise | Kapitel, wo der Sinn es zulässt | Nach Sinnabschnitten | Abzug (Startwert) |
|---|---|---|---|---|---|
| Buchende | | ✓ | ✓ | ✓ | 0 |
| Ende eines Hauptteils | Urgeschichte → Abraham (1Mo 11,27) | ✓ | ✓ | ✓ | 0,02 |
| Kapitel- und Abschnittsende | die meisten Kapitel | ✓ | ✓ | ✓ | 0,05 |
| Abschnittsende bis 2 Verse neben dem Kapitelende | 1Sam 21,1 / 21,2 | – | ✓ | ✓ | 0,07 |
| Abschnittsende im Kapitel | Mk 4,34 / 4,35 | – | – | ✓ | 0,10 |
| Kapitelende im Abschnitt | 1Mo 1 / 2 (Schöpfung bis 2,3) | ✓ | – | – | 0,30 |

**Standard:** „Kapitel, wo der Sinn es zulässt“ – vertraut wie Kapitel, aber ohne die Kapitelenden, die mitten in
einem Abschnitt liegen. Einheiten dürfen über ein Buchende gehen („Ob · Jona 1–2“).

Manche Abschnitte beginnen bewusst erst bei Vers 2, weil Vers 1 noch zum vorigen Kapitel gehört (1Sam 20,1–21,1,
Dan 5,1–6,1, 5Mo 12,1–13,1). Deshalb zählt im Standard eine Abschnittsgrenze bis 2 Verse neben dem Kapitelende wie
ein Kapitelende; die Einheit heißt dann „1Sam 20,1–21,1“. So bleiben von 113 Kapitelenden im Abschnitt 84 gesperrt.

**Lange Abschnitte** (Median 13 Verse): Abhilfe in den Daten, nicht im Rechenkern – wo es eine natürliche
Unterteilung gibt, wird der Abschnitt geteilt. Erledigt in `bfc9317` (4Mo 7, Spr 22,17–24,22, Hes 16) und `3fca034`
(zehn weitere Listen und Texte, u. a. Esr 2 und Neh 7). Am längsten sind jetzt Ps 78 (72 Verse, bleibt ganz),
Jer 51,1–58 und 1Sam 17 (je 58). Grob geschätzt dauern sie still gelesen um die 8–10 Minuten; nur bei kurzen
Lesungen um 5 Minuten fallen sie als Ausreißer auf. Weitere Teilungen nur nach Simons OK.

---

## 5. Wie lang eine Lesung ist: Ziel oder Minuten

| Man wählt | Das Modul rechnet |
|---|---|
| Zieldatum | Lesetage bis dahin zählen → Minuten je Lesung |
| Minuten je Lesung | Zahl der Lesungen → voraussichtliches Ende |

Beides steht im Assistenten nebeneinander und rechnet live mit: „≈ 12 Min. je Lesung · fertig etwa 14.08.2027“.
Das Datum ist eine Zielmarke: Weil Bausteine nicht geteilt werden, kann es um ein, zwei Lesetage abweichen.

**Lesezeit** = Wörter ÷ Lesegeschwindigkeit.

| Lesart | Wörter je Minute (Startwert) |
|---|---|
| Still lesen | 200 |
| Langsam, aufmerksam | 150 |
| Vorlesen (Andacht) | 130 |

**Wortzahlen** je Vers (nur Zahlen, kein Text) in `quellen/wortzahlen.txt`, Format wie `verszahlen.txt`, eine
Zeile je Kapitel:

```text
# Wörter je Vers – Schlachter 2000
# Gezählt: Wörter zwischen Leerzeichen; ohne Verszahlen, Überschriften und Fußnoten.
# Psalm-Überschriften zählen mit, weil sie in der Schlachter 2000 eigene Verse sind.
Gen 1: 10,15,11,…
```

- Quelle: Schlachter 2000. Wo sie fehlt, je Buch **Luther 1912** als Rückfall (gemeinfrei). Deren Verszählung ist
  noch nicht geprüft: vorher je Kapitel mit `verszahlen.txt` abgleichen und, wo sie abweicht, anteilig umrechnen.
  Beim automatischen Abruf die Nutzungsbedingungen der Quelle beachten.
- `build.js` prüft: so viele Zahlen je Zeile wie Verse im Kapitel; jedes Kapitel genau einmal.
- Bis die Zahlen da sind, rechnet der Generator mit Versen als Ersatz.
- Grobe Schätzung, bis die Zählung steht: ganze Bibel still gelesen rund 60 Stunden (≈ 10 Min. täglich für ein
  Jahr), vorgelesen rund 90 Stunden.

Bei mehreren Strängen gelten die Minuten für die ganze Einheit; jeder Strang bekommt seinen Anteil.

---

## 6. Wann gelesen wird: Rhythmus und Erinnerung

| Lesetage | Erinnerung | Prognose |
|---|---|---|
| Täglich · Mo–Fr · eigene Wochentage (z. B. Mo–Sa) | an Lesetagen, wenn heute noch nichts abgehakt ist | verbleibende Einheiten auf die kommenden Lesetage legen |
| Ohne festen Rhythmus | keine | aus dem eigenen Tempo der letzten 8 Wochen, ab 5 Lesungen; vorher keine |

- Wer nicht liest, sieht morgen dieselbe Einheit; das Enddatum rückt still nach hinten.
- **Kein Verzug** in der Anzeige (Vorschlag, statt KONZEPT §2): nur das mitwandernde Enddatum.
- Wer das Ziel doch halten will, wählt **Neu einteilen**: Der Rest ab dem Lesezeichen wird mit längeren Lesungen
  neu erzeugt (§9).
- Die Erinnerung stellt jede Person für sich ein, auch bei gemeinsamen Plänen.

---

## 7. Pläne, Namen, Sichtbarkeit

Jedes Mitglied mit Schreibrecht legt beliebig viele Pläne an und benennt sie selbst.

| Art | Lesezeichen | Abhaken | Sichtbar für |
|---|---|---|---|
| **Für mich**, privat | eines | ich | nur mich |
| **Für mich**, sichtbar | eines | ich | alle im Haushalt; „Übernehmen“ legt eine eigene Kopie an |
| **Gemeinsam**, z. B. „Familienandacht“ | eines für alle | jedes Mitglied mit Schreibrecht, mit „Dabei waren“ | alle im Haushalt |

- Familienandacht ist kein Sondertyp, sondern ein gemeinsamer Plan mit diesem Namen. Es kann mehrere geben.
- **Übernehmen statt Mitlesen:** Eine Kopie hat ihr eigenes Lesezeichen und ändert sich nicht, wenn das Original
  neu eingeteilt wird.
- Gemeinsame Pläne ändern oder löschen: wer ihn angelegt hat und Admins (Vorschlag).

---

## 8. Der Rechenkern

Für jeden Strang getrennt, nach Ring und Bündelung:

```text
Eingabe   Bausteine b1 … bn mit Minuten m(i); nach jedem Baustein: Grenze erlaubt? Abzug a(i)
          Zielminuten T je Einheit (für diesen Strang)
Kosten    einer Einheit bi … bj  =  ((m(i) + … + m(j) − T) / T)²  +  a(j)
Gesucht   die erlaubten Grenzen mit der kleinsten Kostensumme
Verfahren dynamische Programmierung wie beim Blocksatz-Umbruch (Knuth-Plass), O(n · w)
```

- **Zieldatum:** N Lesetage zählen, T = Gesamtminuten ÷ N. Kommen nicht genau N Einheiten heraus, T per
  Bisektion nachstellen; bleibt es bei N ± 1, verschiebt sich das Datum entsprechend.
- **Mehrere Stränge:** N aus der Summe aller Stränge, dann jeder Strang mit T = seine Minuten ÷ N auf genau N
  Einheiten (bzw. mit Lücken, §1).
- Bei rund 2.000 Bausteinen dauert das Millisekunden, im Browser (Vorschau im Assistenten) wie im Dienst.

---

## 9. Speichern und ändern

Gespeichert wird das **Rezept** (alle Antworten) und die erzeugten **Einheiten** als fester Stand:

```json
{
  "name": "Familienandacht",
  "art": "gemeinsam",
  "straenge": [
    { "buecher": "bibel", "ohne": ["Job", "Ps", "Prov", "Eccl", "Song"], "reihenfolge": "kanonisch", "start": "Isa.1.1" },
    { "buecher": ["Job", "Ps", "Prov", "Eccl", "Song"], "reihenfolge": "kanonisch" }
  ],
  "einteilung": "kapitel-sinn",
  "parallelen": ["geschichte"],
  "lesetage": [1, 2, 3, 4, 5, 6],
  "ziel": { "minuten": 15 },
  "woerter_je_minute": 130,
  "begonnen_am": "2026-11-01"
}
```

- Buch-IDs wie in `buecher.json` (OSIS: `Gen`, `Exod`, `1Kgs` …).
- **Ändern** (Ziel, Minuten, Lesetage, Einteilung): Nur der Rest ab dem Lesezeichen wird neu erzeugt, die Version
  steigt. Gelesenes und Logbuch bleiben unverändert.
- **Ende:** Der Plan ist fertig. „Noch einmal“ erzeugt Durchgang 2 aus demselben Rezept, Startpunkt wählbar.

---

## 10. Daten, die der Generator braucht

| Datei | Inhalt | Stand |
|---|---|---|
| `quellen/verszahlen.txt` | Verse je Kapitel, Schlachter 2000 | Branch `bibeldaten`; wird gerade Kapitel für Kapitel nachgeprüft (2Kö 15 hat 38 Verse, nicht 39) |
| `quellen/perikopen/*.txt` | 190 Hauptteile, 1.985 Sinnabschnitte, lückenlos | fertig, nur noch Feinarbeit (Branch `bibeldaten`) |
| `quellen/wortzahlen.txt` | Wörter je Vers, Schlachter 2000, Rückfall Luther 1912 | Simon |
| `quellen/parallelen.txt` | Parallelgruppen mit Art | 69 Gruppen (62 Geschichte, 3 Lieder, 4 Gesetz), nicht committet; alle Teile auf Abschnittsgrenzen |
| `quellen/chronologisch.txt` | chronologische Reihenfolge | offen |

**Parallelen** – eine Zeile je Gruppe; feinere Zeilen geben dem Rechenkern mehr Stellen zum Teilen:

```text
[geschichte] 1Sam 31 | 1Chr 10
[geschichte] 2Kgs 18,13-20,19 | Isa 36-39 | 2Chr 32,1-26
[lieder]     2Sam 22 | Ps 18
```

**Chronologisch** – Abschnitte in Lesereihenfolge, jeder Vers genau einmal; eine eigene Anordnung, nicht von einem
veröffentlichten Plan übernommen:

```text
Gen 1,1-11,26
Job
Gen 11,27-50,26
…
```

`build.js` prüft beide wie bei den Hauptteilen: Jede Stelle existiert und fällt auf Abschnittsgrenzen.

Die Grenzen, die die Beispiele aus §3 brauchen, sind seit Commit `c130150` (Branch `bibeldaten`) in den Perikopen:
5Mo 5,6 und 5,22 · 2Sam 5,11 · 2Kö 20,20 · 2Kö 24,18 · 2Chr 32,24 und 32,27 · Neh 7,6. Ps 40 bleibt ein
Abschnitt (Psalmen bleiben ganz).

Die übrigen 13 Grenzen für `parallelen.txt` kamen mit Commit `504f10e` (5Mo 15,12 · Ri 1,10 · Ri 1,16 · Ri 2,11 ·
2Sam 6,12 · 1Kö 15,9 · 2Kö 23,21 · 1Chr 8,29 · 2Chr 6,12 · 2Chr 22,10 · 2Chr 34,29 · Jer 39,11 · Jer 40,7). In 2Chr
wurde dafür die Grenze 23,1 auf 22,10 verlegt, damit kein Abschnitt mit 3 Versen entsteht. Damit liegen alle Teile
aller 69 Gruppen auf Abschnittsgrenzen – bis auf 2Kö 15,32–38, das erst nach der Korrektur der Verszahl (38 statt
39) aufgeht.

---

## 11. Folgen für KONZEPT.md

| Stelle | Änderung |
|---|---|
| §2 | „Verzug“ nicht anzeigen, nur das Enddatum; „Neu einteilen“ erzeugt den Rest neu. |
| §4 | Ersetzt durch §7 hier: beliebig viele Pläne je Mitglied, gemeinsame Pläne statt eines Familienplans. |
| §6 | `plan` bekommt `besitzer`, `art`, `sichtbar`, `rezept`, `lesezeichen`, `durchgang`. Weil jeder Plan genau ein Lesezeichen hat, entfällt `abo`. |
| §7 | Weg 2 „Erzeugt“ ist der Hauptweg. Buch-IDs nach `buecher.json` (OSIS), nicht `GEN.1` wie im Mockup. |
| §9 | Frage 1 (ein Lesezeichen für gemeinsame Pläne) und Frage 3 (mehrere Pläne) sind entschieden. |

---

## 12. Offene Fragen

1. **Parallelen über Stränge hinweg** (2Sam 22 im Hauptstrang, Ps 18 im Weisheitsstrang): nur innerhalb eines
   Strangs bündeln (Vorschlag) – oder den Teil aus dem anderen Strang herüberholen?
2. **Evangelien-Parallelen:** als zweiter Schritt nach Geschichte, Lieder, Gesetz (Vorschlag)? Und soll dort die
   zuerst kommende Stelle Leitstelle sein, auch wenn Markus dadurch fast leer wird?
3. **Weisheitsstrang** einmal gleichmäßig verteilt (Vorschlag) – oder wiederholend, z. B. Psalmen und Sprüche
   mehrmals im Jahr?
4. **Anweisung und Ausführung** (2Mo 25–31 ∥ 2Mo 35–40, 2Mo 29 ∥ 3Mo 8) als Parallele bündeln? Das würde 2Mo 35–40
   fast leeren. Vorschlag: nein, beides an seinem Platz lesen.
