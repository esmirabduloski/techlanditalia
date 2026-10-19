import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileDaCaricare, LIBRERIA_VUOTA, nomeFileGioco, nomeNelCodice, type Libreria } from './pgzeroAssets';

describe('nomi dei file del gioco', () => {
  it('minuscolo, senza accenti né spazi, come li cerca pgzero', () => {
    expect(nomeFileGioco('Alieno Verde.PNG')).toBe('alieno_verde.png');
    expect(nomeFileGioco('perché.wav')).toBe('perche.wav');
    expect(nomeNelCodice('Alieno Verde.PNG')).toBe('alieno_verde');
    expect(nomeNelCodice('salto.ogg')).toBe('salto');
  });
});

describe('fileDaCaricare', () => {
  const libreria: Libreria = { ...LIBRERIA_VUOTA, images: ['alien.png', 'coin.png', 'sfondo.png'], sounds: ['salto.wav'], music: ['tema.ogg'] };

  it('dalla libreria solo i file usati nel codice', () => {
    const codice = 'alieno = Actor("alien")\nsounds.salto.play()\nmusic.play("tema")\nscreen.blit("sfondo", (0, 0))\n# coins non conta';
    expect(fileDaCaricare(codice, libreria, []).map((f) => f.percorso)).toEqual([
      'images/alien.png', 'images/sfondo.png', 'sounds/salto.wav', 'music/tema.ogg',
    ]);
    expect(fileDaCaricare(codice, libreria, [])[0].url).toBe('/pgzero-libreria/images/alien.png');
  });

  it('gli allegati ci sono sempre e vincono sulla libreria con lo stesso nome', () => {
    const allegati = [
      { name: 'Alien.png', url: 'https://storage/x/alien.png', type: 'image' },
      { name: 'boing.wav', url: 'https://storage/x/boing.wav', type: 'audio' },
      { name: 'pixel.ttf', url: 'https://storage/x/pixel.ttf' },
      { name: 'stile.css', url: 'https://storage/x/stile.css', type: 'css' },
      // allegati dei compiti: tipo MIME
      { name: 'Nave.PNG', url: 'https://storage/h/nave-123.png', type: 'image/png' },
      { name: 'scheda.pdf', url: 'https://storage/h/scheda.pdf', type: 'application/pdf' },
    ];
    expect(fileDaCaricare('Actor("alien")', libreria, allegati)).toEqual([
      { percorso: 'images/alien.png', url: 'https://storage/x/alien.png' },
      { percorso: 'sounds/boing.wav', url: 'https://storage/x/boing.wav' },
      { percorso: 'music/boing.wav', url: 'https://storage/x/boing.wav' },
      { percorso: 'fonts/pixel.ttf', url: 'https://storage/x/pixel.ttf' },
      { percorso: 'images/nave.png', url: 'https://storage/h/nave-123.png' },
    ]);
  });
});

describe('libreria condivisa (public/pgzero-libreria)', () => {
  it('manifest.json elenca esattamente i file delle cartelle', () => {
    const base = path.resolve(__dirname, '../../public/pgzero-libreria');
    const manifest: Libreria = JSON.parse(readFileSync(path.join(base, 'manifest.json'), 'utf8'));
    for (const cartella of Object.keys(LIBRERIA_VUOTA) as (keyof Libreria)[]) {
      let file: string[] = [];
      try { file = readdirSync(path.join(base, cartella)).filter((f) => !f.startsWith('.')).sort(); } catch { /* cartella vuota */ }
      expect([...manifest[cartella]].sort(), `${cartella}: aggiorna public/pgzero-libreria/manifest.json`).toEqual(file);
      // pgzero cerca i nomi in minuscolo, senza spazi
      for (const f of file) expect(nomeFileGioco(f), `${cartella}/${f}: rinomina il file`).toBe(f);
    }
  });
});
