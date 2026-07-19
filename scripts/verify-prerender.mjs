#!/usr/bin/env node
/**
 * Smoke-check dell'output prerenderato (dist/).
 * Fallisce (exit 1) se una route target non ha <title>, canonical, meta description
 * o gli schema JSON-LD attesi, o se le aree escluse risultano prerenderate.
 *
 * Uso: npm run verify:prerender  (dopo npm run build)
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const BASE_URL = 'https://techlanditalia.it';

// route → tipi JSON-LD attesi nell'HTML statico (oltre a Organization/WebSite dal template)
const STATIC_ROUTES = {
  '/': [],
  '/corsi': [],
  '/chi-siamo': [],
  '/blog': [],
  '/faq': ['FAQPage'],
  '/prenota': [],
  '/contatti': [],
  '/glossario': [],
  '/lavora-con-noi': [],
  '/accessibilita': [],
  '/privacy': [],
  '/termini': [],
  '/cookie': [],
};

const COURSE_SLUGS = ['roblox', 'roblox-avanzato', 'web-development', 'python-base', 'python-ai'];
for (const slug of COURSE_SLUGS) STATIC_ROUTES[`/corsi/${slug}`] = ['Course', 'BreadcrumbList'];

// Articoli blog: scoperti dinamicamente da dist/blog/*/index.html
const blogDir = join(DIST, 'blog');
const blogSlugs = existsSync(blogDir)
  ? readdirSync(blogDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : [];
for (const slug of blogSlugs) STATIC_ROUTES[`/blog/${slug}`] = ['BlogPosting'];

// Aree che NON devono esistere nell'output statico
const FORBIDDEN_DIRS = ['admin', 'area-riservata', 'insegnante', 'auth', 'lp'];

const errors = [];
const warn = [];

function extractJsonLdTypes(html, route) {
  const types = [];
  const re = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1]);
      for (const item of Array.isArray(parsed) ? parsed : [parsed]) types.push(item['@type']);
    } catch (e) {
      errors.push(`${route}: JSON-LD non valido (${e.message})`);
    }
  }
  return types;
}

for (const [route, expectedTypes] of Object.entries(STATIC_ROUTES)) {
  const file = join(DIST, route === '/' ? '' : route, 'index.html');
  if (!existsSync(file)) {
    errors.push(`${route}: manca ${file}`);
    continue;
  }
  const html = readFileSync(file, 'utf8');

  const titles = [...html.matchAll(/<title[^>]*>([^<]*)<\/title>/g)].map((t) => t[1].trim());
  if (titles.length === 0 || !titles[0]) errors.push(`${route}: <title> mancante o vuoto`);
  if (titles.length > 1) warn.push(`${route}: ${titles.length} tag <title> (attesone 1)`);

  const canonical = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
  const expectedCanonical = `${BASE_URL}${route === '/' ? '/' : route}`;
  if (!canonical) errors.push(`${route}: canonical mancante`);
  else if (canonical !== expectedCanonical)
    errors.push(`${route}: canonical "${canonical}" ≠ atteso "${expectedCanonical}"`);

  if (!/<meta[^>]*name="description"[^>]*content="[^"]+"/.test(html))
    errors.push(`${route}: meta description mancante`);

  if (!html.includes('data-server-rendered'))
    errors.push(`${route}: manca il markup server-rendered (pagina non prerenderata?)`);

  const types = extractJsonLdTypes(html, route);
  if (!types.includes('EducationalOrganization'))
    errors.push(`${route}: schema EducationalOrganization mancante`);
  for (const t of expectedTypes) {
    if (!types.includes(t)) errors.push(`${route}: schema ${t} mancante`);
  }
}

for (const dir of FORBIDDEN_DIRS) {
  if (existsSync(join(DIST, dir)))
    errors.push(`AREA ESCLUSA PRERENDERATA: dist/${dir} non deve esistere`);
}

const total = Object.keys(STATIC_ROUTES).length;
console.log(`verify:prerender — ${total} route controllate (${blogSlugs.length} articoli blog)`);
if (warn.length) console.log(`\n⚠️  Warning:\n${warn.map((w) => `  - ${w}`).join('\n')}`);
if (errors.length) {
  console.error(`\n❌ ${errors.length} errori:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}
console.log('✅ Tutte le route target hanno title, canonical, description e schema attesi.');
