#!/usr/bin/env node
/**
 * Genera dist/sitemap.xml a partire dall'output prerenderato.
 *
 * Strategia: la lista URL viene ricavata camminando su dist/ (ogni route
 * prerenderata ha il suo <path>/index.html), quindi sitemap e HTML statico
 * sono sempre sincronizzati per costruzione — niente più sitemap stale
 * (audit SEO-008/009). Le aree escluse dal prerender (/admin, /lp, ...)
 * non compaiono in dist e quindi nemmeno qui.
 *
 * Il lastmod degli articoli blog usa updated_at da Supabase (best effort:
 * se la fetch fallisce si usa la data di build).
 *
 * Eseguito da `npm run build` dopo vite-react-ssg (vedi package.json).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const BASE_URL = 'https://techlanditalia.it';
const today = new Date().toISOString().split('T')[0];

// --- 1. Scopri le route prerenderate camminando su dist/ ---
function findRoutes(dir, prefix = '') {
  const routes = [];
  for (const entry of readdirSync(join(DIST, dir), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'assets' || entry.name === 'images' || entry.name === 'static-loader-data') continue;
    const routePath = `${prefix}/${entry.name}`;
    if (existsSync(join(DIST, dir, entry.name, 'index.html'))) routes.push(routePath);
    routes.push(...findRoutes(join(dir, entry.name), routePath));
  }
  return routes;
}

const routes = ['/', ...findRoutes('.')].sort();

// --- 2. lastmod reale per gli articoli blog (best effort) ---
function loadEnvVar(name) {
  if (process.env[name]) return process.env[name];
  try {
    const env = readFileSync('.env', 'utf8');
    return env.match(new RegExp(`^${name}\\s*=\\s*"?([^"\\n]+)"?`, 'm'))?.[1];
  } catch {
    return undefined;
  }
}

async function fetchBlogLastmod() {
  const base = loadEnvVar('VITE_SUPABASE_URL');
  const apikey = loadEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY');
  if (!base || !apikey) return {};
  try {
    const res = await fetch(`${base}/rest/v1/blog_posts?select=slug,updated_at&published=eq.true`, {
      headers: { apikey },
    });
    if (!res.ok) return {};
    const rows = await res.json();
    return Object.fromEntries(rows.map((r) => [r.slug, (r.updated_at || '').split('T')[0]]));
  } catch {
    return {};
  }
}

async function fetchActiveLandingSlugs() {
  const base = loadEnvVar('VITE_SUPABASE_URL');
  const apikey = loadEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY');
  if (!base || !apikey) return [];
  try {
    const res = await fetch(`${base}/rest/v1/landing_pages?select=slug&is_active=eq.true`, {
      headers: { apikey },
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return rows.map((r) => `/lp/${r.slug}`);
  } catch {
    return [];
  }
}

const blogLastmod = await fetchBlogLastmod();
const landingRoutes = await fetchActiveLandingSlugs();
// Merge landing routes (esclusi dal prerender ma indicizzabili — SEO-006 D4).
for (const lp of landingRoutes) if (!routes.includes(lp)) routes.push(lp);
routes.sort();

// --- 3. Regole changefreq/priority per tipo di pagina ---
function meta(route) {
  if (route === '/') return { changefreq: 'weekly', priority: '1.0' };
  if (route === '/corsi') return { changefreq: 'weekly', priority: '0.9' };
  if (route === '/prenota') return { changefreq: 'monthly', priority: '0.9' };
  if (route.startsWith('/corsi/')) return { changefreq: 'monthly', priority: '0.8' };
  if (route === '/blog') return { changefreq: 'daily', priority: '0.8' };
  if (route.startsWith('/blog/')) {
    const slug = route.slice('/blog/'.length);
    return { changefreq: 'monthly', priority: '0.6', lastmod: blogLastmod[slug] };
  }
  if (['/faq', '/glossario'].includes(route)) return { changefreq: 'weekly', priority: '0.7' };
  if (['/chi-siamo', '/contatti'].includes(route)) return { changefreq: 'monthly', priority: '0.6' };
  if (route === '/lavora-con-noi') return { changefreq: 'monthly', priority: '0.5' };
  return { changefreq: 'yearly', priority: '0.3' }; // privacy, termini, cookie, accessibilita
}

// --- 4. Scrivi la sitemap ---
const urlXml = routes
  .map((route) => {
    const { changefreq, priority, lastmod } = meta(route);
    return [
      '  <url>',
      `    <loc>${BASE_URL}${route === '/' ? '/' : route}</loc>`,
      `    <lastmod>${lastmod || today}</lastmod>`,
      `    <changefreq>${changefreq}</changefreq>`,
      `    <priority>${priority}</priority>`,
      '  </url>',
    ].join('\n');
  })
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlXml}\n</urlset>\n`;

writeFileSync(join(DIST, 'sitemap.xml'), xml);
const blogCount = routes.filter((r) => r.startsWith('/blog/')).length;
console.log(
  `sitemap: ${routes.length} URL scritte in dist/sitemap.xml (${blogCount} articoli blog, lastmod da DB: ${Object.keys(blogLastmod).length})`,
);
