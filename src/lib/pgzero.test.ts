import { describe, expect, it } from 'vitest';
import { toReplitMain } from './pgzero';

describe('toReplitMain', () => {
  it('aggiunge main.py all\'intestazione #pgzero', () => {
    expect(toReplitMain('#pgzero\nWIDTH = 400')).toBe('#pgzero main.py\nWIDTH = 400');
    expect(toReplitMain('# pgzero\nWIDTH = 400')).toBe('#pgzero main.py\nWIDTH = 400');
    expect(toReplitMain('#PGZERO\nWIDTH = 400')).toBe('#pgzero main.py\nWIDTH = 400');
  });

  it('non la raddoppia se c\'è già', () => {
    expect(toReplitMain('#pgzero main.py\nWIDTH = 400')).toBe('#pgzero main.py\nWIDTH = 400');
    expect(toReplitMain('# pgzero  main.py\nWIDTH = 400')).toBe('# pgzero  main.py\nWIDTH = 400');
  });

  it('cambia solo la prima intestazione, anche se non è alla prima riga', () => {
    expect(toReplitMain('# gioco\n#pgzero\n#pgzero')).toBe('# gioco\n#pgzero main.py\n#pgzero');
  });

  it('lascia il codice senza intestazione com\'è', () => {
    const code = 'WIDTH = 400\n\ndef draw():\n    screen.fill("blue")\n';
    expect(toReplitMain(code)).toBe(code);
    expect(toReplitMain('')).toBe('');
  });
});
