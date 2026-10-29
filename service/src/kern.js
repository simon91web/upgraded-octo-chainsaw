// Der Kern und die Bibeldaten liegen im Modul (modules/bibellese/), damit Browser und Dienst
// dieselben Rechenwege und dieselben Zahlen nutzen.

import fs from 'node:fs';
import { ladeBibel } from '../../modules/bibellese/kern/index.js';

const pfad = new URL('../../modules/bibellese/daten/bibel.json', import.meta.url);
export const bibel = ladeBibel(JSON.parse(fs.readFileSync(pfad, 'utf8')));
