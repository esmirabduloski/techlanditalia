import { describe, expect, it } from 'vitest';
import { AVATAR_CHARACTERS, getAvatar, stageName } from './catalog';
import { buildAvatar } from './characters';
import { getAvatarImage } from './images';
import { PARTS, tierOf } from './voxel';

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe('catalogo avatar', () => {
  it('usa esattamente gli id 1..10 di profiles.avatar_id (CHECK 1..10)', () => {
    expect(AVATAR_CHARACTERS.map((a) => a.id)).toEqual(LEVELS);
    expect(new Set(AVATAR_CHARACTERS.map((a) => a.slug)).size).toBe(10);
  });

  it('solo animali e persone: niente più robot, razzo e gamer', () => {
    const names = AVATAR_CHARACTERS.map((a) => a.name.toLowerCase()).join(' ');
    expect(names).not.toMatch(/robot|razzo|gamer/);
    expect(getAvatar(1).slug).toBe('panda');
    expect(getAvatar(3).slug).toBe('astronauta');
    expect(getAvatar(4).slug).toBe('pinguino');
  });

  it('ogni personaggio ha 10 forme con nomi diversi', () => {
    for (const a of AVATAR_CHARACTERS) {
      expect(a.stages).toHaveLength(10);
      expect(new Set(a.stages).size).toBe(10);
    }
    expect(stageName(8, 4)).toBe('Draghetto alato');
  });

  it('id e livelli fuori scala tornano a valori validi', () => {
    expect(getAvatar(99).id).toBe(1);
    expect(getAvatar(null).id).toBe(1);
    expect(stageName(8, 0)).toBe('Uovo misterioso');
    expect(stageName(8, 42)).toBe('Drago leggendario');
  });
});

describe('modelli 3D', () => {
  for (const a of AVATAR_CHARACTERS) {
    it(`${a.name}: 10 forme valide, ognuna diversa dalla precedente`, () => {
      let previous = '';
      for (const level of LEVELS) {
        const model = buildAvatar(a.id, level);
        expect(model.boxes.length).toBeGreaterThan(10);
        for (const box of model.boxes) {
          expect(PARTS).toContain(box.part);
          expect(box.color).toMatch(/^#[0-9a-f]{6}$/i);
          for (const v of [...box.size, ...box.pos]) expect(Number.isFinite(v)).toBe(true);
          for (const v of box.size) expect(v).toBeGreaterThan(0);
        }
        const figure = JSON.stringify(model.boxes.filter((b) => b.part !== 'base'));
        expect(figure).not.toBe(previous);
        previous = figure;
      }
    });
  }

  it('il basamento cambia materiale con le fasce dei bordi', () => {
    expect(LEVELS.map(tierOf)).toEqual(['grass', 'grass', 'grass', 'stone', 'stone', 'stone', 'amethyst', 'amethyst', 'amethyst', 'gold']);
  });
});

describe('immagini pre-renderizzate', () => {
  it('esistono tutte le 200 immagini (npm run avatars:render)', () => {
    for (const a of AVATAR_CHARACTERS) {
      for (const level of LEVELS) {
        expect(getAvatarImage(a.id, level, 'full'), `${a.slug} ${level}`).toBeTruthy();
        expect(getAvatarImage(a.id, level, 'face'), `${a.slug} ${level} face`).toBeTruthy();
      }
    }
  });
});
