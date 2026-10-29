# Bibel – Bücher, Kapitel, Verse und Sinnabschnitte (Schlachter 2000)

Alle 66 Bücher der Bibel mit Kapitel- und Versanzahl nach der Verszählung der **Schlachter 2000**,
dazu eine inhaltliche Gliederung in Hauptteile und Sinnabschnitte (Perikopen).

| | Bücher | Kapitel | Verse |
|---|---:|---:|---:|
| Altes Testament | 39 | 929 | 23.214 |
| Neues Testament | 27 | 260 | 7.958 |
| **Gesamt** | **66** | **1.189** | **31.172** |

Gliederung: 190 Hauptteile, 1.932 Sinnabschnitte.

## Dateien

| Datei | Inhalt |
|---|---|
| [`bibel-schlachter2000.json`](bibel-schlachter2000.json) | Alles in einer Datei: Buch → Hauptteile → Sinnabschnitte, dazu Verse je Kapitel |
| [`buecher.csv`](buecher.csv) | Ein Buch je Zeile: Name, Abkürzung, Testament, Gruppe, Kapitel, Verse |
| [`kapitel.csv`](kapitel.csv) | Ein Kapitel je Zeile mit Versanzahl (1.189 Zeilen) |
| [`perikopen.csv`](perikopen.csv) | Ein Sinnabschnitt je Zeile mit Hauptteil, Von/Bis, Versanzahl, Stelle, Titel |

Die CSV-Dateien sind mit Semikolon getrennt und UTF-8 mit BOM gespeichert, damit Excel sie direkt
mit Umlauten öffnet.

## Aufbau der JSON-Datei

```json
{
  "uebersetzung": "Schlachter 2000",
  "statistik": { "buecher": 66, "kapitel": 1189, "verse": 31172, "hauptteile": 190, "perikopen": 1932 },
  "buecher": [
    {
      "nr": 8, "id": "Ruth", "name": "Ruth", "abk": "Rt", "testament": "AT", "gruppe": "Geschichtsbücher",
      "kapitelanzahl": 4, "versanzahl": 85, "perikopenanzahl": 5,
      "verse_je_kapitel": [22, 23, 18, 22],
      "teile": [
        {
          "nr": 1, "titel": "Die Geschichte Ruths", "stelle": "Rt 1–4", "verse": 85,
          "von": { "kapitel": 1, "vers": 1 }, "bis": { "kapitel": 4, "vers": 22 },
          "perikopen": [
            { "nr": 1, "titel": "Noomi und Ruth", "stelle": "Rt 1", "verse": 22,
              "von": { "kapitel": 1, "vers": 1 }, "bis": { "kapitel": 1, "vers": 22 } }
          ]
        }
      ]
    }
  ]
}
```

`id` ist die OSIS-Kennung (Gen, Exod, …, Rev) und eignet sich zum Verknüpfen mit anderen Daten.
`verse_je_kapitel[0]` ist Kapitel 1.

## Woher die Zahlen kommen

- **Kapitel und Verse:** SWORD-Versifikation „German“ (CrossWire), die Luther, Elberfelder und
  Schlachter gemeinsam zugrunde liegt. Gegen die Schlachter 2000 auf bibleserver.com geprüft: alle
  bekannten Stellen, an denen deutsche und englische Zählung auseinandergehen, alle 150 Psalmen und
  acht Bücher vollständig (zusammen gut 500 Kapitel).
- Dabei fanden sich vier Kapitel, in denen die Schlachter 2000 vom deutschen Schema abweicht und
  wie die englische Zählung zählt. Sie sind korrigiert: 4Mo 25 (18 Verse), 2Chr 1 (17), 2Chr 2 (18),
  Apg 19 (41).
- Im Alten Testament gilt sonst die hebräische Zählung, z. B. Joel mit 4 Kapiteln, Maleachi mit
  3 Kapiteln (3,19–24), Psalm-Überschriften als eigene Verse (Ps 51 hat 21 Verse).
- Im Neuen Testament: 2Kor 13 hat 13 Verse, 3Joh 15 Verse, Offb 12 endet mit Vers 18.

## Zu den Sinnabschnitten

Die Gliederung folgt den gängigen Abschnittsgrenzen deutscher Bibelausgaben. **Die Titel sind eigene
Formulierungen**, nicht die Zwischenüberschriften der Schlachter 2000; diese sind urheberrechtlich
geschützt. Grenzen und Titel stimmen deshalb nicht in jedem Fall mit einer gedruckten Ausgabe überein.

Jeder Abschnitt reicht lückenlos bis zum Vers vor dem nächsten. Wo Verse an der Kapitelgrenze
inhaltlich zum vorigen Kapitel gehören, beginnt der Abschnitt erst danach, z. B. 1Sam 21,2 (David in
Nob) oder Dan 6,2 (Daniel in der Löwengrube).

## Ändern und neu erzeugen

Die Dateien in diesem Ordner werden aus [`../quellen/`](../quellen/) erzeugt:

- `quellen/buecher.json` – Namen, Abkürzungen, Gruppen
- `quellen/verszahlen.txt` – Verse je Kapitel
- `quellen/perikopen/*.txt` – Gliederung, eine Zeile je Abschnittsbeginn:

```text
@Ruth
= 1,1 Die Geschichte Ruths      ← Hauptteil
1,1 Noomi und Ruth              ← Sinnabschnitt ab Kapitel 1, Vers 1
2,1 Ruth auf dem Feld des Boas
```

Danach im Hauptordner neu erzeugen (Node.js nötig):

```bash
node build.js
```

Das Skript prüft jede Stelle gegen die Verszahlen, die Reihenfolge und die Lückenlosigkeit und
schreibt nichts, solange ein Fehler gefunden wird.
