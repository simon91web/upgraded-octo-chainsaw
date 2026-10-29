# Bibellese – ein Modul für Yuvomi

Entwurf, Stand 29.10.2026. Zum Mockup: [`mockup/index.html`](../mockup/index.html).

Das Modul übernimmt die Familienandacht: ein Leseplan für die ganze Familie, dazu ein eigener Plan, den jedes
Mitglied für sich einschalten kann. Es enthält **keinen Bibeltext**. Es sagt, wo man steht, was als Nächstes
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
| Einstellungen | `settings.entry` mit Bereichen `mine` (jedes Mitglied) und `household` (nur Admins) erscheint unter Einstellungen › Module › Bibellese. | „Für mich“: eigener Plan, Tempo. „Für den Haushalt“: Familienplan, Lesetage. |
| Übersicht | `capabilities.widgets` für Kacheln auf dem Dashboard; jede Kachel holt ihre Daten selbst. | Kachel „Bibellese heute“ mit nächster Einheit und Abhaken. |
| Sprache | `locales/<sprache>.json`, Schlüssel `extensions.bibellese.*`. | Deutsch zuerst, Englisch als Rückfall. |
| Gestaltung | Yuvomis `DESIGN.md`: Rahmen, Knöpfe und Fokus bleiben im Yuvomi-Violett; der Modulton (`accent`) färbt aktive Reiter, Fortschritt und das Siegel der Dashboard-Kachel. Fremdmodule bekommen **kein Siegel** vor dem Seitentitel (`router.js`). | Ton „Leder“ `#9A6B3F` (Vorschlag, siehe §8). Die `style.css` des Moduls muss `--module-accent` selbst setzen, sonst werden Segmente violett. |

**Grenzen, die man kennen muss**

- Auf **Umbrel** gibt es keine Fremdmodule. Überall sonst (Docker, Podman, TrueNAS, Unraid, Portainer) geht es.
- Der Dienst ist ein eigener Container mit eigenem Volume. Der Betreiber muss ihn einmal einrichten
  (Compose-Datei und eine Proxy-Regel liefern wir mit).
- Yuvomi prüft keine Versionen. Wir lesen `GET /api/v1/version` und schalten bei unbekannter API auf „nur lesen“.

**Aufbau dieses Repos (geplant)**

```text
modules/bibellese/          Browser-Teil, wird nach Yuvomi kopiert
  module.json
  index.js                  Seite mit den Reitern Heute, Fortschritt, Logbuch, Statistik
  settings.js               Einstellungsblatt (mine, household)
  widgets/heute.js          Dashboard-Kachel
  style.css
  data/bibel.json           66 Bücher nach Schlachter 2000 (aus daten/, erzeugt von build.js)
  locales/de.json, en.json
service/                    Sidecar: Node, Express, SQLite
  ...
deploy/                     docker-compose.example.yml, Traefik- und nginx-Beispiel
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
3. **Anderer Tag.** „Gelesen am …“ im Menü der Einheit, für „gestern vergessen einzutragen“.
4. **Aufholen** ist kein eigener Modus, man liest einfach mehr. Das Blatt „Aufholen“ zeigt, was es
   kostet („Mit je einer Einheit mehr bist du am Sa., 31.10. wieder im Plan“). Es listet die Einheiten
   bis zurück in den Plan, und man kann sie dort gleich nacheinander abhaken, bis „Wieder im Plan“ steht.
5. **Ziel verschieben.** Vorgewählt ist „Um den Verzug“ (um 3 Tage auf den 03.01.2028), dann ist der
   Verzug weg. Oder ein eigenes Datum, mit Vorschau („Danach: 7 Einheiten Vorsprung“). Das ursprüngliche
   Ziel bleibt sichtbar, jede Verschiebung steht im Verlauf, und der Toast bietet „Rückgängig“. Erreichbar
   über die Karte, das Menü der Einheit, den Plan und die Einstellungen.
6. **Pause** (Urlaub, Krankheit) ist für später geplant: eine Verschiebung im Voraus, „Pause bis 15.11.“,
   und diese Tage zählen nicht als Lesetage.
7. **Überspringen** gibt es bewusst nicht als Knopf: Ziel ist Vollständigkeit. Wer eine Einheit schon kennt,
   hakt sie ab.
8. **Familienplan:** Das Ziel verschieben dürfen Mitglieder mit Schreibrecht, Kinderkonten nicht.

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

## 4. Familie und „Für mich“

| | Familienplan | Eigener Plan |
|---|---|---|
| Anzahl | einer je Haushalt | einer je Mitglied, freiwillig |
| Wer wählt | Admin (Einstellungen › Haushalt) | jedes Mitglied selbst |
| Lesezeichen | eines für die Familie | eines für die Person |
| Abhaken | jedes Mitglied mit Schreibrecht, auch Kinder | nur die Person |
| Beim Abhaken | „Dabei waren“: Mitglieder antippen, vorausgewählt alle | – |
| Sichtbar für | alle im Haushalt | nur die Person |

Umschalten oben auf der Seite mit „Familie | Für mich“. Ohne eigenen Plan zeigt „Für mich“ das Logbuch und
den Fortschritt aus freien Einträgen und bietet „Eigenen Plan wählen“ an.

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

```text
plan            id, slug, name, version, einheiten (JSON), quelle
abo             id, haushalt, art ('familie'|'person'), person_id, plan_id,
                begonnen_am, tempo (JSON: Tage, Einheiten je Tag), ziel (Datum),
                lesezeichen, durchgang, status ('aktiv'|'pausiert'|'fertig')
ziel_aenderung  id, abo_id, am, von, nach, person_id      (Verlauf von „Ziel verschieben“)
lesung          id, abo_id (leer bei freiem Eintrag), person_id (wer eingetragen hat),
                gelesen_am (Datum + Uhrzeit, Zeitzone des Haushalts), einheit_nr,
                stellen (JSON), notiz, dabei (JSON, Personen-IDs), geloescht_am
lesung_kapitel  lesung_id, buch, kapitel                  (für schnellen Fortschritt)
```

- Verzug, Vorsprung und Prognose werden nicht gespeichert, sondern bei jeder Anfrage aus `ziel`, `tempo`
  und dem Lesezeichen berechnet. Das ursprüngliche Ziel ist das `von` der ersten `ziel_aenderung`.
- Das Lesezeichen wird mitgeschrieben, lässt sich aber jederzeit aus `lesung` neu berechnen.
- Löschen setzt `geloescht_am` (Rückgängig, Papierkorb im Logbuch).
- Personen-IDs kommen aus `/api/v1/auth/me` bzw. der Mitgliederliste von Yuvomi, nie aus dem Browser.

**Schnittstelle** unter `/api/extensions/bibellese/`:

```text
GET  heute?abo=familie|ich        nächste Einheit, Ziel, Verzug/Vorsprung, Prognose, aktuelles Buch
POST lesungen                     abhaken oder frei eintragen
DEL  lesungen/:id                 rückgängig
GET  lesungen?von=&bis=           Logbuch und Kalender
GET  fortschritt?abo=             Kapitel je Buch
GET  statistik?abo=&zeitraum=     Regelmäßigkeit, Wochentage, Tageszeit
GET  plaene · PUT abo             Plan wählen, Tempo
PUT  abo/ziel                     Ziel verschieben (schreibt ziel_aenderung); DEL rückgängig
```

---

## 7. Lesepläne (Format-Vorschlag, wird noch geklärt)

Intern ein einfaches JSON; Stellen mit OSIS-Kürzeln, damit Übersetzung und Sprache egal sind:

```json
{
  "slug": "bibel-2-jahre-kanonisch",
  "name": "Bibel in zwei Jahren",
  "version": 1,
  "einheiten": [
    ["Gen.1-Gen.2"],
    ["Gen.3-Gen.4"],
    ["Isa.40", "John.3"]
  ]
}
```

Wege, wie Pläne ins Modul kommen (zur Entscheidung):

1. **Mitgeliefert**, als Dateien im Modul.
2. **Erzeugt:** Reihenfolge (kanonisch, chronologisch, AT + NT parallel) und Dauer wählen, das Modul teilt die
   Kapitel gleichmäßig auf. Braucht keine fremden Pläne. Das Mockup rechnet seine beiden Pläne schon so
   (`mockup/bibellese-daten.js`), noch nach Kapiteln; später nach Verszahl gewichtet, damit Psalm 119 nicht
   so viel zählt wie Psalm 117.
3. **Importiert:** JSON oder CSV („Tag;Stellen“) hochladen. Bei veröffentlichten Plänen Nutzungsrechte prüfen.

---

## 8. Gestaltung

Grundlage sind Yuvomis `DESIGN.md` und der Quelltext (Stand 29.10.2026). Das Mockup bindet Yuvomis echte
`tokens.css` ein, Farben, Radien, Schrift und Schatten sind also die von Yuvomi.

**Seitenform:** `page.composition: "dashboard"` mit Spalten (wie Haushaltshilfe und Belohnungen): links die
Liste im Lesemaß (612 px bei 1280 px), rechts ab 65 rem eine Seitenspalte für Kalender und Fortschritt; mobil
alles untereinander.

| Baustein | Im Mockup | Yuvomi-Regel dahinter |
|---|---|---|
| Kopf | „Bibellese“ ohne Siegel, daneben „Familie / Für mich“ als Kapseln | Fremdmodule ohne Siegel; Umfang-Schalter in der Titelzeile wie `.budget-scope` |
| Reiter | Heute · Fortschritt · Logbuch · Statistik | `.sub-tab`, aktiv im Modulton (12 % Fläche, 70 % Text) |
| Hauptaktion | „Gelesen“ in der Karte der nächsten Einheit | Abhaken fragt nie nach; Toast „Psalm 8–9 gelesen · Rückgängig“ |
| Anlegen | FAB „+ Eintrag“: mobil in der Kapsel, am Laptop im Kopf | Der FAB ist der eine Weg zum Anlegen |
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
| Verzug | Ziel als Anker, Puffer 2, „Aufholen“ ohne eigenen Modus, „Ziel verschieben“ mit Verlauf (§2) |
| Familie abhaken | Ein Lesezeichen für die Familie; wer abhakt, wählt, wer dabei war |
| Bibelausgabe | Schlachter 2000: Buchnamen, Reihenfolge, Abkürzungen, Gruppen sowie Kapitel- und Verszählung wie in `daten/` |
| Betrieb | Zweiter Container mit Docker Compose; wir liefern Compose-Datei und Proxy-Regel (Traefik und nginx) |
| Modulton | Leder `#9A6B3F` |

**Noch offen** (gilt der Vorschlag, solange nichts anderes entschieden ist)

1. **Zählt die Familienandacht für mich?** Vorschlag: ja, wenn ich „dabei“ war, in meinem Fortschritt als
   eigene Quelle sichtbar.
2. **Mehrere eigene Pläne** gleichzeitig (z. B. Bibel + Psalmen)? Vorschlag: zunächst einer.
3. **Fortschritt in Kapiteln oder Versen?** Vorschlag: Anzeige in Kapiteln, Prozent nach Kapiteln. Verse nur,
   wenn Pläne halbe Kapitel enthalten.
4. **Erinnerung:** eine Push-Nachricht zur Andachtszeit über Yuvomis Benachrichtigungen? Vorschlag: später;
   braucht im Dienst einen API-Schlüssel des Haushalts.
5. **„Gelesen“ und „+ Eintrag“ auf einer Ansicht:** Vorschlag: so lassen (Yuvomi-Muster).
6. **Proxy:** Traefik oder nginx bei dir? Davon hängt ab, welche Proxy-Regel wir zuerst ausarbeiten.
7. **Abschnittsüberschriften:** Falls `daten/perikopen.csv` die Überschriften der Schlachter 2000 wörtlich
   enthält, vor einer Veröffentlichung des Repos die Rechte klären (Genfer Bibelgesellschaft).
