# Bibellese – ein Modul für Yuvomi

Entwurf, Stand 29.10.2026. Zum Mockup: [`mockup/index.html`](../mockup/index.html).

Das Modul übernimmt die Familienandacht: gemeinsame Lesepläne für die Familie, dazu eigene Pläne, die sich
jedes Mitglied zusammenstellt. Es enthält **keinen Bibeltext**. Es sagt, wo man steht, was als Nächstes
dran ist und wie weit man in der ganzen Bibel gekommen ist.

---

## 1. Wie ein Yuvomi-Modul funktioniert

Quelle: `MODULES.md` und `docs/PAGE-COMPOSITION.md` im Yuvomi-Repo (Stand v2.7x, Oktober 2026).

| Thema | Was Yuvomi vorgibt | Folge für Bibellese |
|---|---|---|
| Ort | Ein Ordner unter `modules/<id>/` mit `module.json`. Installation per Ordnerkopie oder in Yuvomi unter Einstellungen › Module › Eigenes Modul (GitHub-Adresse oder ZIP, nur wenn der Betreiber `MODULES_ALLOW_WEB_INSTALL=true` setzt). | `modules/bibellese/` in diesem Repo, GitHub-Topic `yuvomi-module`, Releases mit Tag. |
| Seite | `index.js` exportiert `render(container, context)`. Kein `innerHTML`, kein CDN, Kopf und Körper über `/utils/page-layout.js`. | Reine ES-Module ohne Build-Schritt. |
| Daten | **Ein Modul hat keinen eigenen Server und keinen Speicher in Yuvomi.** `yuvomi.db` darf nicht geöffnet werden. Wer Daten speichert, betreibt einen eigenen kleinen Dienst („Sidecar“) auf demselben Host unter `/api/extensions/<id>/`. | Ein Dienst `bibellese-service` (Node + SQLite) als zweiter Container neben Yuvomi, eingebunden über den Reverse Proxy. |
| Anmeldung | Der Dienst prüft jede Anfrage selbst: Sitzungs-Cookie an `GET /api/v1/auth/me` weiterreichen, nur dieser Antwort trauen, kurz zwischenspeichern (Rate-Limit 300/min). Eigener CSRF-Schutz für schreibende Anfragen. | Wird im Dienst gebaut, nicht im Browser. |
| Rechte | `capabilities.permissions` legt das Recht `ext:bibellese` an (keins / lesen / schreiben), verwaltet unter Einstellungen › Haushalt › Rollen. Der Dienst muss es selbst durchsetzen. | Kinderkonten z. B. „lesen + abhaken“, aber keinen Plan wechseln. |
| Einstellungen | `settings.entry` mit Bereichen `mine` (jedes Mitglied) und `household` (nur Admins) erscheint unter Einstellungen › Module › Bibellese. | „Für mich“: meine Pläne, ob gemeinsame Pläne für mich zählen. „Für den Haushalt“: wer gemeinsame Pläne anlegen darf. |
| Übersicht | `capabilities.widgets` für Kacheln auf dem Dashboard; jede Kachel holt ihre Daten selbst. | Kachel „Bibellese heute“ mit nächster Einheit und Abhaken. |
| Sprache | `locales/<sprache>.json`, Schlüssel `extensions.bibellese.*`. | Deutsch zuerst, Englisch als Rückfall. |
| Gestaltung | Yuvomis `DESIGN.md`: Rahmen, Knöpfe und Fokus bleiben im Yuvomi-Violett; der Modulton (`accent`) färbt aktive Reiter, Fortschritt und das Siegel der Dashboard-Kachel. Fremdmodule bekommen **kein Siegel** vor dem Seitentitel (`router.js`). | Ton „Leder“ `#9A6B3F` (Vorschlag, siehe §8). Die `style.css` des Moduls muss `--module-accent` selbst setzen, sonst werden Segmente violett. |

**Grenzen, die man kennen muss**

- Auf **Umbrel** gibt es keine Fremdmodule. Überall sonst (Docker, Podman, TrueNAS, Unraid, Portainer) geht es.
- Der Dienst ist ein eigener Container mit eigenem Volume. Der Betreiber muss ihn einmal einrichten
  (Compose-Datei und eine Proxy-Regel liefern wir mit).
- Yuvomi prüft keine Versionen. Wir lesen `GET /api/v1/version` und schalten bei unbekannter API auf „nur lesen“.

**Aufbau dieses Repos**

```text
modules/bibellese/          Browser-Teil, wird nach Yuvomi kopiert
  module.json
  index.js                  Seite mit den Reitern Heute, Pläne, Fortschritt, Logbuch, Statistik
  lib/                      Ansichten, Blätter, Dienst-Client
  kern/                     Rechenkern (Einteilen, Stand, Fortschritt) – auch vom Dienst genutzt
  daten/bibel.json          66 Bücher nach Schlachter 2000 (aus daten/, erzeugt von tools/moduldaten.mjs)
  settings.js               Einstellungsblatt (mine, household)
  widgets/heute.js          Dashboard-Kachel
  style.css
  locales/de.json, en.json
service/                    Sidecar: Node ab 22.13, eingebautes SQLite, keine Fremdpakete
deploy/                     docker-compose.example.yml (Traefik), nginx.conf.example
dev/                        Prüfstand und Entwicklungs-Proxy
docs/KONZEPT.md             dieses Dokument
mockup/                     Entwurf der Oberfläche
```

---

## 2. Leselogik: ein Lesezeichen statt eines Kalenders

Ein Leseplan ist eine **geordnete Liste von Einheiten ohne Datum**. Gelesen wird immer die nächste ungelesene
Einheit – egal, an welchem Tag.

```text
Plan       [ 1 ][ 2 ][ 3 ] … [298][299][300] … [730]
                                  ▲
Lesezeichen                       nächste Einheit (299)
```

| Begriff | Bedeutung |
|---|---|
| **Einheit** | Eine oder mehrere Bibelstellen, z. B. „Psalm 9–10“ oder „Jesaja 40 · Johannes 3“. |
| **Lesezeichen** | Die nächste ungelesene Einheit. Abhaken schiebt es um eins weiter. |
| **Tempo** | Wie viele Einheiten an welchen Tagen vorgesehen sind (z. B. 1 je Tag, oder Mo–Fr). |
| **Ziel** | Das Datum, an dem der Plan fertig sein soll. Beim Start aus Plan und Tempo gesetzt, danach fest, bis man es verschiebt. |
| **Verzug** | Verbleibende Einheiten minus Lesetage bis zum Ziel. Ist die Zahl negativ, ist es Vorsprung. Nur ein Hinweis. |
| **Puffer** | Bis 2 Einheiten Verzug zeigt das Modul nur das Ziel, ohne Warnfarbe. Fest eingestellt. |
| **Voraussichtlich fertig** | Heute + verbleibende Einheiten nach Tempo. Wandert mit, wenn man pausiert oder nachholt. |
| **Durchgang** | Ein vollständiger Lauf durch den Plan. Danach beginnt Durchgang 2, das Erreichte bleibt im Logbuch. |

```text
Rest        = Einheiten im Plan − gelesene Einheiten
Vorrat      = Lesetage von heute bis zum Ziel × Einheiten je Tag   (ab morgen, wenn heute schon gelesen)
Verzug      = Rest − Vorrat                                         (< 0 heißt Vorsprung)
Prognose    = der Lesetag, an dem bei 1 Einheit je Lesetag der Rest gelesen ist
```

**Beispiel** (Plan „Bibel in zwei Jahren“, 1 Einheit je Tag, Start 01.01.2026, heute 29.10.2026):

| | Wert |
|---|---|
| Ziel | 31.12.2027 |
| Gelesen | 298 Einheiten |
| Nächste Einheit | 299 · Psalm 8–9 |
| Rest | 432 Einheiten |
| Lesetage bis zum Ziel | 429 (29.10.2026 bis 31.12.2027) |
| Verzug | 3 Einheiten |
| Voraussichtlich fertig | 03.01.2028 |

**Was angezeigt wird**

| Lage | In der Karte „Heute“ |
|---|---|
| Im Plan | „✓ Im Plan · Ziel 31.12.2027“ |
| Vorsprung | „✓ 7 Einheiten Vorsprung · Ziel 10.01.2028“ |
| Verzug im Puffer (1–2) | „Ziel 31.12.2027“, ohne Warnfarbe |
| Verzug ab 3 | „3 Einheiten im Verzug · so wird es der 03.01.2028“ in Warnfarbe, darunter **Aufholen** und **Ziel verschieben** |
| Großer Verzug | wie oben, aber „Ziel verschieben“ steht vorn. Groß heißt: in zwei Wochen nur mit mehr als einer Einheit extra je Tag aufzuholen |

Keine Push-Nachricht wegen Verzug. Er steht nur in der Karte „Heute“ und in der Dashboard-Kachel.

**Abläufe**

1. **Abhaken.** „Gelesen“ legt einen Logbuch-Eintrag an (Datum, Uhrzeit, Stellen, wer) und schiebt das
   Lesezeichen weiter. Die nächste Einheit steht sofort da – wer nachholen will, liest einfach weiter.
   Die erste Einheit des Tages ist die von heute, erst jede weitere baut Verzug ab (3 → 3 → 2). Solange
   Verzug besteht, steht die nächste Einheit nach dem Abhaken als „zum Aufholen“ da.
2. **Rückgängig.** Nach dem Abhaken 5 s lang im Toast, danach im Logbuch am Eintrag. Nichts geht verloren.
   **Teilweise gelesen.** Unter der Hauptstelle stehen zweiter Strang (Feder) und Parallelstellen
   (Spalten). Hat die Einheit solche Nebenstellen, fragt „Gelesen“ nach – auf der Karte „Auch gelesen?“,
   in der Kachel „Was hast du gelesen?“ –, alles vorausgewählt, dann „Eintragen“; ohne Nebenstellen trägt
   der Tipp sofort ein. „Gelesen am …“ und das Logbuch-Blatt tragen die Haken gleich im Formular.
   Herausgenommenes zählt nicht im Fortschritt und steht im Logbuch als „Ausgelassen“, dort nachträglich
   änderbar. Die Hauptstelle lässt sich nicht herausnehmen, das Lesezeichen rückt wie immer weiter.
   Eine Parallelstelle kommt im Plan nur einmal vor; Ausgelassenes bleibt deshalb offen, bis es frei
   eingetragen wird (Mockups: `mockup/stellen.html`, `mockup/kachel-haken.html` Variante B).
3. **Anderer Tag.** „Gelesen am …“ im Menü der Einheit, für „gestern vergessen einzutragen“.
4. **Aufholen** ist kein eigener Modus, man liest einfach mehr. Das Blatt „Aufholen“ zeigt, was es
   kostet („Mit je einer Einheit mehr bist du am Sa., 31.10. wieder im Plan“). Es listet die Einheiten
   bis zurück in den Plan, und man kann sie dort gleich nacheinander abhaken, bis „Wieder im Plan“ steht.
   Als dritter Weg steht dort **Neu einteilen** (aus `LESEPLAN.md` §6): Der Rest ab dem Lesezeichen wird auf
   die Lesetage bis zum Ziel verteilt, die Lesungen werden etwas länger („≈ 7,1 statt 7,0 Min.“), das Ziel
   bleibt. Gelesenes bleibt unverändert, die Version des Plans steigt; Rückgängig im Toast.
5. **Ziel verschieben.** Vorgewählt ist „Um den Verzug“ (um 3 Tage auf den 03.01.2028), dann ist der
   Verzug weg. Oder ein eigenes Datum, mit Vorschau („Danach: 7 Einheiten Vorsprung“). Das ursprüngliche
   Ziel bleibt sichtbar, jede Verschiebung steht im Verlauf, und der Toast bietet „Rückgängig“. Erreichbar
   über die Karte, das Menü der Einheit, den Plan und die Einstellungen.
6. **Pause** (Urlaub, Krankheit) ist für später geplant: eine Verschiebung im Voraus, „Pause bis 15.11.“,
   und diese Tage zählen nicht als Lesetage.
7. **Überspringen** gibt es bewusst nicht als Knopf: Ziel ist Vollständigkeit. Wer eine Einheit schon kennt,
   hakt sie ab.
8. **Gemeinsame Pläne:** Ziel verschieben und neu einteilen dürfen, wer den Plan angelegt hat, und Admins;
   abhaken darf jedes Mitglied mit Schreibrecht.
9. **Ohne festen Rhythmus** (im Assistenten wählbar) gibt es kein Ziel und keinen Verzug; die Karte zeigt
   „Ohne festen Rhythmus“, das Ende ergibt sich aus dem eigenen Tempo (`LESEPLAN.md` §6).

---

## 3. Fortschritt: immer auf die ganze Bibel bezogen

Grundlage ist eine fest eingebaute Tabelle der 66 Bücher mit Kapiteln (1.189: AT 929, NT 260) und Versen
je Kapitel. Ein Kapitel gilt als gelesen, sobald es in einem abgehakten Plan-Eintrag oder einem freien
Eintrag des laufenden Durchgangs vorkommt.

| Ebene | Anzeige |
|---|---|
| Ganze Bibel | „485 von 1.189 Kapiteln · 41 %“ |
| AT / NT | je ein Balken |
| Buchgruppen | Gesetz, Geschichtsbücher, Poetische Bücher, Große und Kleine Propheten · Evangelien, Geschichtsbuch, Paulusbriefe, Allgemeine Briefe, Prophetisches Buch (wie `daten/buecher.csv`) |
| Bücher | 66 Kacheln, gefüllt nach Anteil; Tipp öffnet die Kapitel des Buchs |
| Aktuelles Buch | „Psalmen · 7 von 150 Kapiteln“, mit dem, was danach kommt |
| Noch nicht begonnen | „Neues Testament: beginnt mit Einheit 571 · voraussichtlich 28.07.2027“ |

Freie Einträge zählen mit: Wer neben dem Plan den Römerbrief liest, sieht ihn im Fortschritt. In der
Buchansicht sind sie von Plan-Kapiteln unterschieden (Kontur statt Fläche).

---

## 4. Mehrere Pläne: gemeinsam, privat, sichtbar

Wie in `LESEPLAN.md` §7 entschieden: Jedes Mitglied mit Schreibrecht legt beliebig viele Pläne an und
benennt sie selbst. Jeder Plan hat genau ein Lesezeichen.

| Art | Lesezeichen | Abhaken | Sichtbar für |
|---|---|---|---|
| **Nur für mich** | eines | ich | nur mich |
| **Für mich, sichtbar** | eines | ich | alle im Haushalt; „Übernehmen“ legt eine eigene Kopie an |
| **Gemeinsam**, z. B. „Familienandacht“ | eines für alle | jedes Mitglied mit Schreibrecht, mit „Dabei waren“ (vorausgewählt alle) | alle im Haushalt |

So erscheint das im Mockup:

- **Heute** zeigt eine Karte je Plan, den man liest: zuerst die gemeinsamen, dann die eigenen. Nur die erste
  Karte trägt den Hauptknopf „Gelesen“, die weiteren sind eine Stufe leiser.
- **Pläne** (eigener Reiter) listet „Gemeinsam“, „Für mich“ und „Von anderen“ mit Stand, Ziel und Zustand.
  Antippen öffnet den Plan: Rezept, Ziel, Lesetage, Lesart, Version, die Einheiten um das Lesezeichen.
  Bei Plänen anderer steht dort „Übernehmen“; danach zeigt die Zeile „Übernommen“.
- **Fortschritt, Logbuch, Statistik** haben oben Filter: „Alles von mir“ oder ein einzelner Plan. „Alles
  von mir“ fasst die eigenen Pläne, die freien Einträge und die gemeinsamen Pläne zusammen, bei denen ich
  dabei war (abschaltbar in den Einstellungen).
- **Freie Einträge** gehören der Person, nicht einem Plan. Wer mit der Familie außerhalb des Plans liest,
  kann den Eintrag ins Logbuch eines gemeinsamen Plans setzen.

---

## 5. Logbuch, Kalender und Statistik

**Logbuch-Eintrag:** Datum, Uhrzeit, Stellen (Buch, Kapitel von–bis, optional Verse), Notiz, Quelle
(Plan-Einheit oder frei), wer eingetragen hat, bei der Familie: wer dabei war.

**Frei eintragen:** Buch wählen, Kapitel von–bis, optional Notiz. Funktioniert auch ganz ohne Plan – dann ist
das Modul ein reines Bibel-Logbuch.

**Kalender:** Monatsraster, Lesetage markiert, heute umrandet; Tipp auf einen Tag zeigt dessen Einträge darunter
(Yuvomi-Muster „Mobil-Monat“). In der Statistik zusätzlich die letzten 12 Monate als Punktraster.

**Regelmäßigkeit statt Serie:** „An 23 von 28 Tagen gelesen“, „6,0 Tage je Woche“, „meist abends“,
Verteilung nach Wochentag und Tageszeit. Eine Serien-Zahl („12 Tage am Stück“) zeigen wir bewusst
nicht groß – sie erzeugt den Zeitdruck, den das Modul vermeiden soll.

---

## 6. Datenmodell (Dienst, SQLite)

Nach `LESEPLAN.md` §11 hat jeder Plan genau ein Lesezeichen; die Tabelle `abo` entfällt.

```text
plan            id, haushalt, besitzer (person_id), name, art ('privat'|'sichtbar'|'gemeinsam'),
                kopie_von (plan_id), rezept (JSON, Antworten des Assistenten), einheiten (JSON, fester Stand),
                version, begonnen_am, lesetage (JSON oder leer = ohne festen Rhythmus), woerter_je_minute,
                ziel (Datum, leer ohne Rhythmus), lesezeichen, durchgang, status ('aktiv'|'fertig')
ziel_aenderung  id, plan_id, am, von, nach, person_id     (Verlauf von „Ziel verschieben“)
lesung          id, plan_id (leer bei freiem Eintrag der Person), person_id (wer eingetragen hat),
                gelesen_am (Datum + Uhrzeit, Zeitzone des Haushalts), einheit_nr, plan_version,
                stellen (JSON), notiz, dabei (JSON, Personen-IDs), geloescht_am
lesung_kapitel  lesung_id, buch, kapitel                  (für schnellen Fortschritt)
```

- Verzug, Vorsprung und Prognose werden nicht gespeichert, sondern bei jeder Anfrage aus `ziel`, `lesetage`
  und dem Lesezeichen berechnet. Das ursprüngliche Ziel ist das `von` der ersten `ziel_aenderung`.
- „Neu einteilen“ und Änderungen am Rezept erzeugen nur den Rest ab dem Lesezeichen neu und erhöhen
  `version`; `lesung.plan_version` hält fest, nach welchem Stand gelesen wurde.
- Das Lesezeichen wird mitgeschrieben, lässt sich aber jederzeit aus `lesung` neu berechnen.
- Löschen setzt `geloescht_am` (Rückgängig, Papierkorb im Logbuch).
- Personen-IDs kommen aus `/api/v1/auth/me` bzw. der Mitgliederliste von Yuvomi, nie aus dem Browser.

**Schnittstelle** unter `/api/extensions/bibellese/`:

```text
GET  heute                        je Plan, den ich lese: nächste Einheit, Minuten, Ziel, Verzug, Prognose
GET  plaene                       meine, gemeinsame und sichtbare Pläne anderer
POST plaene · POST plaene/vorschau  Plan anlegen aus Rezept · Vorschau für den Assistenten
POST plaene/:id/kopie             Übernehmen
PUT  plaene/:id/ziel              Ziel verschieben (schreibt ziel_aenderung); DEL rückgängig
POST plaene/:id/einteilen         Neu einteilen (Rest ab Lesezeichen, Version +1)
POST lesungen · DEL lesungen/:id  abhaken oder frei eintragen · rückgängig
GET  lesungen?plan=|alle&von=&bis=        Logbuch und Kalender
GET  fortschritt?plan=|alle · GET statistik?plan=|alle&zeitraum=
```

---

## 7. Lesepläne: der Assistent

Wie Pläne entstehen, beschreibt `LESEPLAN.md` (Branch `bibeldaten`): aus wenigen Antworten erzeugt das
Modul die Einheiten selbst (Stränge, Ring, Parallelen, Einteilung nach Sinnabschnitten, Rechenkern).
Mitgelieferte oder importierte Pläne sind damit nicht nötig. Die Oberfläche dazu ist der **Assistent
„Neuer Leseplan“** (FAB „Neu“ › Leseplan), fünf Schritte mit Live-Vorschau:

| Schritt | Fragen |
|---|---|
| Was | Ganze Bibel · AT · NT · eine Buchgruppe · einzelne Bücher; Weisheitsliteratur nebenher als zweiter Strang; Reihenfolge kanonisch (chronologisch folgt, sobald `quellen/chronologisch.txt` steht) |
| Wo anfangen | am Anfang oder bei einem Buch; der Ring dreht sich, nichts fällt weg |
| Parallelen | Geschichte, Lieder, Gesetz je ein Schalter; Evangelien folgen in einem zweiten Schritt |
| Wie viel | Lesetage (täglich, Mo–Sa, Mo–Fr, frei); Zieldatum oder Minuten je Lesung; Lesart (still, langsam, vorlesen) |
| Für wen | Name, Art (nur für mich, sichtbar, gemeinsam), Beginn |

Die Vorschau rechnet bei jeder Antwort mit: „≈ 9,8 Min. je Lesung · 365 Lesungen · fertig etwa 28.10.2027“
und die ersten drei Lesungen. Am Laptop steht sie rechts neben den Fragen, mobil darunter.

**Im Mockup vereinfacht:** `mockup/bibellese-daten.js` teilt nach Kapiteln und schätzt Minuten aus den
Verszahlen je Buch (23 Wörter je Vers). Parallelen und Sinnabschnitte kann erst der echte Rechenkern mit
den Daten aus `daten/`; die Schalter dafür sind im Mockup nur Oberfläche.

Gespeichert wird das Rezept (alle Antworten) und die erzeugten Einheiten als fester Stand, Buch-IDs nach
OSIS wie in `daten/buecher.csv` (`Gen`, `Exod`, `1Kgs` …).

---

## 8. Gestaltung

Grundlage sind Yuvomis `DESIGN.md` und der Quelltext (Stand 29.10.2026). Das Mockup bindet Yuvomis echte
`tokens.css` ein, Farben, Radien, Schrift und Schatten sind also die von Yuvomi.

**Seitenform:** `page.composition: "dashboard"` mit Spalten (wie Haushaltshilfe und Belohnungen): links die
Liste im Lesemaß (612 px bei 1280 px), rechts ab 65 rem eine Seitenspalte für Kalender und Fortschritt; mobil
alles untereinander.

| Baustein | Im Mockup | Yuvomi-Regel dahinter |
|---|---|---|
| Kopf | „Bibellese“ ohne Siegel; am Laptop rechts „…“ und „+ Neu“ | Fremdmodule ohne Siegel |
| Reiter | Heute · Pläne · Fortschritt · Logbuch · Statistik | `.sub-tab`, aktiv im Modulton (12 % Fläche, 70 % Text); mobil wischbar |
| Hauptaktion | „Gelesen“ in der ersten Karte; weitere Pläne als leisere Karten mit Zweitknopf | Abhaken fragt nie nach; Toast „Psalm 8–9 gelesen · Rückgängig“ |
| Anlegen | FAB „Neu“ mit Auswahl Eintrag / Leseplan: mobil in der Kapsel, am Laptop im Kopf | Der FAB ist der eine Weg zum Anlegen; zwei Dinge → Speed-Dial (`.page-fab-group`) |
| Planfilter | Chips „Alles von mir“ und je Plan über Fortschritt, Logbuch, Statistik | `.filter-chip`, aktiv im Modulton |
| Assistent | Blatt mit fünf Schritten und Vorschau (Laptop 940 px, mobil von unten) | ein geführter Dialog, Hauptknopf „Weiter“ / „Plan anlegen“ |
| Verzug | ab 3 Einheiten „3 Einheiten im Verzug“ als Text in Warnfarbe, ohne Fläche, mit zwei leisen Textknöpfen | Rückstand als Warnfarbe im Text |
| Kalender | ein Punkt je Einheit, heute violette Scheibe, gewählter Tag getönt | Tagesmarke-Regel |
| Listen | ein Träger je Liste, Zeilen mit Haarlinien | Träger-Regel, keine Karte je Zeile |
| Balken | Spur `--color-fill-well`, Füllung im Modulton, Zahl immer daneben | eine Messgröße im eigenen Modul trägt den Modulton |
| Statistik mobil | eine Zusammenfassungszeile statt vier Kacheln | `metricGlanceHtml` |
| Dashboard-Kachel | Vollton-Siegel als Absender | „Der Widget-Kopf“ |

**Modulton: Leder `#9A6B3F`.** Warm wie die Bühne und von allen neun Familientönen getrennt, auch von Küche
(Orange) und Warnung (Bernstein). 4,6 : 1 zum weißen Zeichen, 3,8 : 1 zur dunklen Bühne. Alternative wäre
Yuvomis Lese-Familie „Dokumente/Notizen“ (Stahlblau) – dann sähe Bibellese aber aus wie ein Teil davon.

**Abgeleitet** (eigene Entscheidungen, wo keine Regel greift):

- Keine Serien-Zahl („12 Tage am Stück“), weil sie Zeitdruck macht. Stattdessen Regelmäßigkeit.
- Puffer von 2 Einheiten, fest statt einstellbar: Ein verpasster Abend löst keinen Hinweis aus.
- Verzug zeigt immer zwei Auswege, nie nur die Zahl; bei großem Verzug steht „Ziel verschieben“ vorn, weil
  Aufholen dann unrealistisch ist.
- „Heute“ zeigt am Laptop den Monat, mobil nur die Woche; der Monat ist einen Tipp entfernt im Logbuch.
- Ist der Dienst weg, bleibt „Gelesen“ bedienbar und wird nachgetragen, statt gesperrt zu werden (nichts geht
  verloren).
- Blätter (Eintrag, Plan, Einstellungen) sind deckend statt aus Glas – Lesbarkeit vor Transparenz.
- „Heute“ zeigt alle Pläne untereinander statt einer Planauswahl: man sieht auf einen Blick, was heute dran
  ist, und hakt ohne Umweg ab. Verwalten und Übernehmen liegen eine Ebene tiefer im Reiter „Pläne“.
- Der FAB heißt „Neu“ statt „+ Nomen“, weil er zwei Dinge anlegt (Eintrag, Leseplan).

**Widersprüche zu deiner Cansol-`DESIGN.md`.** Dein Wunsch „Yuvomi-Stil“ geht vor, und das Modul lebt in
Yuvomis Rahmen. Abweichend von Cansol sind deshalb: SF-Systemschrift statt Geist und mehr als fünf
Schriftgrößen; Radien 10–26 px und Kapselknöpfe statt 5/8 px; Violett für Hauptknopf und Akzente statt
neutral; Glas an Seitenleiste und Kapsel; Hell/Dunkel nach System statt „Standard Dunkel“; auf „Heute“ zwei
violette Flächen („Gelesen“ und der FAB) statt eines Hauptknopfs. Übernommen sind die Cansol-Grundsätze, die
Yuvomi nicht widersprechen: ein Wichtigstes je Ansicht, keine Erklärtexte, jede Handlung mit Antwort
(„Wird gespeichert …“, Toast, „Gespeichert“ in den Einstellungen), Rückgängig statt Rückfrage, ruhiges
Layout (Knopf behält seine Breite, Platz für Fehlermeldungen ist reserviert, Eingaben bleiben nach einem
Fehler stehen), 44-px-Ziele und auf dem Handy dieselbe Information, nur dichter.

---

## 9. Entscheidungen und offene Fragen

**Entschieden am 29.10.2026**

| Frage | Entscheidung |
|---|---|
| Verzug | Ziel als Anker, Puffer 2, „Aufholen“ ohne eigenen Modus, „Ziel verschieben“ mit Verlauf, „Neu einteilen“ als dritter Weg (§2) |
| Pläne | Beliebig viele je Mitglied: nur für mich, sichtbar (zum Übernehmen), gemeinsam; je Plan ein Lesezeichen (§4, `LESEPLAN.md` §7) |
| Gemeinsam abhaken | Ein Lesezeichen für alle; wer abhakt, wählt, wer dabei war |
| Bibelausgabe | Schlachter 2000: Buchnamen, Reihenfolge, Abkürzungen, Gruppen sowie Kapitel- und Verszählung wie in `daten/` |
| Betrieb | Zweiter Container mit Docker Compose; wir liefern Compose-Datei und Proxy-Regel (Traefik und nginx) |
| Modulton | Leder `#9A6B3F` |

**Widerspruch zu `LESEPLAN.md`, beim Zusammenführen anzupassen:** Dort schlagen §6 und §11 vor, keinen
Verzug anzuzeigen, nur das mitwandernde Enddatum. Entschieden ist hier etwas anderes (Verzug mit Ziel und
drei Auswegen); „Neu einteilen“ aus §6 ist übernommen. `LESEPLAN.md` §6 und §11 (Zeile §2) sollten das beim
Zusammenführen der Branches nachziehen.

**Noch offen** (gilt der Vorschlag, solange nichts anderes entschieden ist)

1. **Gemeinsame Pläne zählen für mich**, wenn ich dabei war? Vorschlag: ja, abschaltbar in den Einstellungen.
2. **Fortschritt in Kapiteln oder Versen?** Vorschlag: Anzeige in Kapiteln, Prozent nach Kapiteln.
3. **Erinnerung:** je Person und Plan zur Andachtszeit über Yuvomis Benachrichtigungen (`LESEPLAN.md` §6)?
   Vorschlag: im zweiten Schritt; braucht im Dienst einen API-Schlüssel des Haushalts.
4. **„Gelesen“ und „Neu“ auf einer Ansicht:** Vorschlag: so lassen (Yuvomi-Muster).
5. **Proxy:** Traefik oder nginx bei dir? Davon hängt ab, welche Proxy-Regel wir zuerst ausarbeiten.
6. **Abschnittsüberschriften:** Falls `daten/perikopen.csv` die Überschriften der Schlachter 2000 wörtlich
   enthält, vor einer Veröffentlichung des Repos die Rechte klären (Genfer Bibelgesellschaft).
7. Die offenen Fragen aus `LESEPLAN.md` §12 (Parallelen über Stränge, Evangelien, Weisheitsstrang
   wiederholen, Anweisung und Ausführung) gelten weiter.
