// Builds the site into dist/. Zero dependencies: plain Node 18 or newer.
//   node build.mjs
// Content lives in content/*.json; templates in src/; static files in public/.

import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { renderHome, renderMenuPage } from './src/render.mjs';
import { art } from './src/icons.mjs';

const root = new URL('./', import.meta.url);
const readJson = async (p) => JSON.parse(await readFile(new URL(p, root), 'utf8'));

const site = await readJson('content/site.json');
const menu = await readJson('content/menu.json');
check(site, menu);

const fingerprint = async (p) =>
  createHash('sha256').update(await readFile(new URL(p, root))).digest('hex').slice(0, 10);
const assets = { css: await fingerprint('public/styles.css'), js: await fingerprint('public/app.js') };

const out = new URL('dist/', root);
await rm(out, { recursive: true, force: true });
await cp(new URL('public/', root), out, { recursive: true });
await writeFile(new URL('index.html', out), renderHome({ site, menu, assets }));
await mkdir(new URL('menu/', out), { recursive: true });
await writeFile(new URL('menu/index.html', out), renderMenuPage({ site, menu, assets }));

if (!site.preview) {
  await writeFile(new URL('robots.txt', out), `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);
  await writeFile(
    new URL('sitemap.xml', out),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${site.url}/</loc></url>
  <url><loc>${site.url}/menu/</loc></url>
</urlset>
`,
  );
}

const items = menu.sections.reduce((n, s) => n + s.items.length, 0);
console.log(
  `Built dist/: 2 pages, ${menu.sections.length} menu sections, ${items} items.` +
    (site.preview ? ' PREVIEW mode: pages are marked noindex.' : ''),
);

// Catch the mistakes a quick content edit is likely to make, before they ship.
function check(site, menu) {
  const problems = [];
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;

  if (site.hours.length !== 7) problems.push('hours must list all seven days');
  for (const d of site.hours) {
    if (!days.includes(d.day)) problems.push(`hours: unknown day "${d.day}"`);
    if (d.closed) continue;
    if (!time.test(d.open ?? '') || !time.test(d.close ?? '')) {
      problems.push(`hours: ${d.day} times must be 24-hour like "06:00" and "14:00"`);
    } else if (d.open >= d.close) {
      problems.push(`hours: ${d.day} opens after it closes`);
    }
  }
  if (!/^\+1\d{10}$/.test(site.phoneE164)) problems.push('phoneE164 must look like +18125551234');

  const ids = new Set();
  for (const s of menu.sections) {
    if (!/^[a-z0-9-]+$/.test(s.id)) problems.push(`menu: section id "${s.id}" must be lowercase-with-dashes`);
    if (ids.has(s.id)) problems.push(`menu: section id "${s.id}" is used twice`);
    ids.add(s.id);
    for (const i of s.items) {
      if (!i.name) problems.push(`menu: an item in "${s.title}" has no name`);
      if (i.price && !/^\$?\d+(\.\d{2})?$/.test(String(i.price))) {
        problems.push(`menu: ${i.name} price "${i.price}" should look like 6.49`);
      }
    }
  }
  for (const f of menu.favorites) {
    if (!art[f.icon]) problems.push(`favorites: no drawing called "${f.icon}" (have: ${Object.keys(art).join(', ')})`);
  }

  // House rule: no em dashes anywhere a person reads.
  if (JSON.stringify([site, menu]).includes('\u2014')) {
    problems.push('an em dash slipped into the content; use a period, comma or colon instead');
  }

  if (problems.length) {
    console.error(`Content problems:\n - ${problems.join('\n - ')}`);
    process.exit(1);
  }
}
