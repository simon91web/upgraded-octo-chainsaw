# Bibellese für Yuvomi

Ein geplantes Modul für [Yuvomi](https://github.com/ulsklyc/yuvomi): Familienandacht und eigene Lesepläne,
Logbuch, Kalender, Fortschritt durch die ganze Bibel. Ohne Bibeltext.

Stand: Entwurf, noch kein Modulcode.

- [`docs/KONZEPT.md`](docs/KONZEPT.md) – wie Yuvomi-Module funktionieren, Leselogik, Datenmodell, offene Fragen
- [`mockup/`](mockup/) – klickbares Mockup im Yuvomi-Stil (Laptop und Handy, Hell und Dunkel)

## Mockup ansehen

Das Mockup nutzt ES-Module und braucht deshalb einen kleinen lokalen Server:

```bash
python -m http.server 8765 --bind 127.0.0.1 --directory mockup
```

Dann <http://127.0.0.1:8765> öffnen. Oben lassen sich Gerät, Hell/Dunkel und Zustand umschalten
(großer Verzug, „Für mich“ ohne Plan, Dienst nicht erreichbar).

`mockup/vendor/` enthält unveränderte Kopien von Yuvomis `tokens.css` (MIT) und Lucide (ISC), siehe
`mockup/vendor/LICENSES.txt`.
