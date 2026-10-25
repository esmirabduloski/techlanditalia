// Pagina usata solo da scripts/render-avatars.mjs: espone al browser headless
// le funzioni che disegnano un avatar e il foglio di controllo 10×10.
import { AVATAR_CHARACTERS } from '@/lib/avatars/catalog';
import { createStillRenderer, type Framing } from '@/lib/avatars/scene';

const stage = document.getElementById('stage') as HTMLCanvasElement;
const render = createStillRenderer(stage);

/** Disegna a dimensione doppia e riduce: bordi dei blocchi più puliti. */
function draw(target: HTMLCanvasElement, id: number, level: number, framing: Framing, size: number, x = 0, y = 0) {
  render(id, level, framing, size * 2);
  const ctx = target.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(stage, x, y, size, size);
}

declare global {
  interface Window {
    avatarRender: {
      characters: { id: number; slug: string }[];
      image(id: number, level: number, framing: Framing, size: number): string;
      sheet(cell: number, framing: Framing, only?: string[]): string;
    };
  }
}

window.avatarRender = {
  characters: AVATAR_CHARACTERS.map(({ id, slug }) => ({ id, slug })),
  image(id, level, framing, size) {
    const out = document.createElement('canvas');
    out.width = size;
    out.height = size;
    draw(out, id, level, framing, size);
    return out.toDataURL('image/webp', 0.9);
  },
  sheet(cell, framing, only) {
    const rows = AVATAR_CHARACTERS.filter((c) => !only?.length || only.includes(c.slug));
    const label = 28;
    const out = document.createElement('canvas');
    out.width = label * 5 + cell * 10;
    out.height = label + cell * rows.length;
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = '#eef0f4';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.fillStyle = '#333';
    ctx.font = '14px sans-serif';
    for (let level = 1; level <= 10; level++) ctx.fillText(`Lv ${level}`, label * 5 + (level - 1) * cell + cell / 2 - 14, 18);
    rows.forEach((c, row) => {
      ctx.fillStyle = '#333';
      ctx.fillText(c.name, 6, label + row * cell + cell / 2);
      for (let level = 1; level <= 10; level++) {
        draw(out, c.id, level, framing, cell, label * 5 + (level - 1) * cell, label + row * cell);
      }
    });
    return out.toDataURL('image/png');
  },
};
