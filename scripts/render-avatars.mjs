#!/usr/bin/env node
/**
 * Pre-renderizza gli avatar 3D (src/lib/avatars) in immagini WebP:
 *   src/assets/avatars/<slug>/<livello>.webp       corpo intero, 320 px
 *   src/assets/avatars/<slug>/<livello>-face.webp  primo piano, 128 px
 *
 * Le immagini stanno in src/assets (Vite le mette in cache con l'hash) e vanno
 * committate: Lovable non può lanciare un browser durante la build. Vanno
 * rigenerate a ogni modifica dei modelli.
 *
 * Uso: npm run avatars:render [-- --sheet foglio.png] [--sheet-only]
 *   --sheet       salva anche un foglio 10×10 con tutte le forme, per controllarle
 *   --sheet-only  solo il foglio, senza riscrivere le immagini
 *   --only a,b    nel foglio solo questi personaggi (slug)
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const scripts = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(scripts, '..');
const outDir = path.join(repo, 'src/assets/avatars');
const args = process.argv.slice(2);
const sheetArg = args.indexOf('--sheet');
const sheetPath = sheetArg >= 0 ? path.resolve(args[sheetArg + 1]) : null;
const sheetOnly = args.includes('--sheet-only');
const onlyArg = args.indexOf('--only');
const only = onlyArg >= 0 ? args[onlyArg + 1].split(',') : [];

const SIZES = { full: 320, face: 128 };

const server = await createServer({
  configFile: false,
  root: path.join(scripts, 'avatar-render'),
  resolve: { alias: { '@': path.join(repo, 'src') } },
  server: { port: 0, fs: { allow: [repo] } },
  logLevel: 'error',
});
await server.listen();

// SwiftShader: WebGL software, identico su ogni macchina e senza GPU
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error(e));
  page.on('console', (msg) => msg.type() === 'error' && console.error(msg.text()));
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.avatarRender !== undefined, null, { timeout: 60_000 });

  const decode = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64');

  if (!sheetOnly) {
    const characters = await page.evaluate(() => window.avatarRender.characters);
    let count = 0;
    for (const { id, slug } of characters) {
      await mkdir(path.join(outDir, slug), { recursive: true });
      for (let level = 1; level <= 10; level++) {
        for (const [framing, size] of Object.entries(SIZES)) {
          const data = await page.evaluate(
            ([i, l, f, s]) => window.avatarRender.image(i, l, f, s),
            [id, level, framing, size],
          );
          const name = framing === 'face' ? `${level}-face.webp` : `${level}.webp`;
          await writeFile(path.join(outDir, slug, name), decode(data));
          count++;
        }
      }
    }
    console.log(`${count} immagini in ${path.relative(repo, outDir)}`);
  }

  if (sheetPath) {
    for (const framing of ['full', 'face']) {
      const data = await page.evaluate(([f, o]) => window.avatarRender.sheet(120, f, o), [framing, only]);
      const file = framing === 'full' ? sheetPath : sheetPath.replace(/(\.png)?$/, '-face.png');
      await writeFile(file, decode(data));
      console.log(`Foglio: ${file}`);
    }
  }
} finally {
  await browser.close();
  await server.close();
}
