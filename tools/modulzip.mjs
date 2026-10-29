// Packt modules/bibellese als ZIP für Yuvomi (Einstellungen › Module › Eigenes Modul).
// Aufruf: node tools/modulzip.mjs → dist/bibellese-<version>.zip
//
// Nur, was Yuvomis Installer übernimmt (MODULES.md, „What is copied“): die erlaubten Dateitypen,
// keine Punktdateien. module.json liegt an der Wurzel des Archivs. Deflate oder gespeichert,
// kein ZIP64, Namen in ASCII mit UTF-8-Kennung – so, wie der Installer es verlangt.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const wurzel = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const modul = path.join(wurzel, 'modules/bibellese');
const ERLAUBT = /\.(js|mjs|css|json|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|md|txt|map)$/i;

function dateien(ordner, rel = '') {
  return fs.readdirSync(ordner, { withFileTypes: true })
    .filter((e) => !e.name.startsWith('.'))
    .flatMap((e) => {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) return dateien(path.join(ordner, e.name), r);
      return e.isFile() && ERLAUBT.test(e.name) ? [r] : [];
    })
    .sort();
}

// MS-DOS-Zeit und -Datum, wie sie im ZIP stehen.
function dosZeit(d) {
  return {
    zeit: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    datum: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

const manifest = JSON.parse(fs.readFileSync(path.join(modul, 'module.json'), 'utf8'));
const { zeit, datum } = dosZeit(new Date());
const lokal = [];
const zentral = [];
let versatz = 0;

for (const name of dateien(modul)) {
  const roh = fs.readFileSync(path.join(modul, name));
  const gepackt = zlib.deflateRawSync(roh, { level: 9 });
  const methode = gepackt.length < roh.length ? 8 : 0;
  const daten = methode ? gepackt : roh;
  const crc = zlib.crc32(roh);
  const n = Buffer.from(name, 'utf8');

  const kopf = Buffer.alloc(30);
  kopf.writeUInt32LE(0x04034b50, 0);
  kopf.writeUInt16LE(20, 4);
  kopf.writeUInt16LE(0x0800, 6);
  kopf.writeUInt16LE(methode, 8);
  kopf.writeUInt16LE(zeit, 10);
  kopf.writeUInt16LE(datum, 12);
  kopf.writeUInt32LE(crc, 14);
  kopf.writeUInt32LE(daten.length, 18);
  kopf.writeUInt32LE(roh.length, 22);
  kopf.writeUInt16LE(n.length, 26);
  lokal.push(kopf, n, daten);

  const eintrag = Buffer.alloc(46);
  eintrag.writeUInt32LE(0x02014b50, 0);
  eintrag.writeUInt16LE((3 << 8) | 20, 4); // Unix, damit die Dateirechte als normale Datei gelten
  eintrag.writeUInt16LE(20, 6);
  eintrag.writeUInt16LE(0x0800, 8);
  eintrag.writeUInt16LE(methode, 10);
  eintrag.writeUInt16LE(zeit, 12);
  eintrag.writeUInt16LE(datum, 14);
  eintrag.writeUInt32LE(crc, 16);
  eintrag.writeUInt32LE(daten.length, 20);
  eintrag.writeUInt32LE(roh.length, 24);
  eintrag.writeUInt16LE(n.length, 28);
  eintrag.writeUInt32LE((0o100644 << 16) >>> 0, 38);
  eintrag.writeUInt32LE(versatz, 42);
  zentral.push(eintrag, n);

  versatz += kopf.length + n.length + daten.length;
}

const verzeichnis = Buffer.concat(zentral);
const ende = Buffer.alloc(22);
ende.writeUInt32LE(0x06054b50, 0);
ende.writeUInt16LE(zentral.length / 2, 8);
ende.writeUInt16LE(zentral.length / 2, 10);
ende.writeUInt32LE(verzeichnis.length, 12);
ende.writeUInt32LE(versatz, 16);

const ziel = path.join(wurzel, 'dist', `bibellese-${manifest.version}.zip`);
fs.mkdirSync(path.dirname(ziel), { recursive: true });
fs.writeFileSync(ziel, Buffer.concat([...lokal, verzeichnis, ende]));
console.log(`${path.relative(wurzel, ziel)}: ${zentral.length / 2} Dateien, ${fs.statSync(ziel).size} Bytes`);
