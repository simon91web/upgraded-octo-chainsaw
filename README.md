# Bibellese für Yuvomi

Ein Modul für [Yuvomi](https://github.com/ulsklyc/yuvomi): Familienandacht und eigene Lesepläne,
Logbuch, Kalender, Fortschritt durch die ganze Bibel. Ohne Bibeltext.

Stand: erste lauffähige Fassung (0.1.0). Auf dem Prüfstand getestet, noch nicht in einem echten Yuvomi.

- [`docs/KONZEPT.md`](docs/KONZEPT.md) – wie Yuvomi-Module funktionieren, Leselogik, Datenmodell, offene Fragen
- [`docs/LESEPLAN.md`](docs/LESEPLAN.md) – wie Pläne eingeteilt werden (Bausteine, Grenzen, Parallelstellen)
- [`mockup/`](mockup/) – das freigegebene Mockup im Yuvomi-Stil

## Aufbau

| Ordner | Inhalt |
|---|---|
| `modules/bibellese/` | Das Modul: Seite, Einstellungen, Dashboard-Kachel, Rechenkern (`kern/`), Bibeldaten (`daten/bibel.json`) |
| `service/` | Der Dienst unter `/api/extensions/bibellese/`: Node ab 22.13, eingebautes SQLite, keine Fremdpakete |
| `deploy/` | Beispiele für Docker Compose mit Traefik und für nginx |
| `dev/` | Prüfstand und Entwicklungs-Proxy |
| `tools/moduldaten.mjs` | Erzeugt `modules/bibellese/daten/bibel.json` aus `daten/` |
| `daten/`, `quellen/`, `build.js` | Bibeldaten nach Schlachter 2000 (Bücher, Verse, Abschnitte, Parallelen) |

## Einrichten

Ein Yuvomi-Modul hat keinen eigenen Speicher. Darum gehören zwei Teile zusammen:

1. **Modul:** den Ordner `modules/bibellese/` in den Modulordner von Yuvomi kopieren (`MODULES_DIR`,
   im Container meist `/app/modules`) und Yuvomi neu starten.
2. **Dienst:** als zweiten Container neben Yuvomi starten und den Pfad `/api/extensions/bibellese/` per
   Reverse Proxy auf ihn leiten. Vorlage: [`deploy/docker-compose.example.yml`](deploy/docker-compose.example.yml),
   für nginx [`deploy/nginx.conf.example`](deploy/nginx.conf.example).

Danach unter Einstellungen › Haushalt › Rollen das Recht „Bibellese“ vergeben (keins, lesen, schreiben).

Der Dienst liest diese Umgebungsvariablen:

| Variable | Standard | Wofür |
|---|---|---|
| `YUVOMI_URL` | `http://yuvomi:3000` | Interne Adresse von Yuvomi, nur zum Prüfen der Sitzung |
| `PUBLIC_ORIGIN` | leer | Adresse, unter der der Browser Yuvomi aufruft (Origin-Prüfung) |
| `DB_PATH` / `DATA_DIR` | `./daten/bibellese.db` | Ort der Datenbank, im Container `/data` |
| `TZ_HAUSHALT` | `Europe/Berlin` | Zeitzone für „heute“ |
| `PORT`, `HOST` | `3100`, `0.0.0.0` | |

## Entwickeln

```bash
cd service && npm test
```

Die Tests brauchen keine Pakete: Rechenkern und API laufen gegen ein nachgebautes Yuvomi.

**Prüfstand:** das Modul im Browser mit dem echten Dienst, ohne Yuvomi zu installieren. Er spielt Anmeldung
und Mitglieder für fünf Testpersonen und lädt Yuvomis Stylesheets aus einem geklonten Yuvomi-Repo.

```bash
YUVOMI_URL=http://127.0.0.1:8080 PUBLIC_ORIGIN=http://localhost:8080 node service/src/server.js
```

```bash
YUVOMI_QUELLE=../yuvomi node dev/pruefstand.mjs
```

Dann <http://localhost:8080/m/bibellese> öffnen. Oben lassen sich Testperson und Hell/Dunkel umschalten.

**Mit echtem Yuvomi:** Yuvomi auf Port 3000 starten (Modulordner eingebunden), den Dienst wie oben, dazu
`node dev/proxy.mjs` – er führt beides unter <http://localhost:8080> zusammen, wie später der Reverse Proxy.

**Bibeldaten neu erzeugen** (nach Änderungen in `daten/`):

```bash
node tools/moduldaten.mjs
```

**Mockup ansehen:**

```bash
python -m http.server 8765 --bind 127.0.0.1 --directory mockup
```

## Lizenzen

`mockup/vendor/` enthält unveränderte Kopien von Yuvomis `tokens.css` (MIT) und Lucide (ISC), siehe
`mockup/vendor/LICENSES.txt`.
