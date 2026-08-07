// Verify the site: every internal link + asset resolves, all pages have required
// SEO meta. Usage: node scripts/verify-site.mjs
import { readFile } from 'node:fs/promises';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', 'site');

const pages = ['index.html', 'gauntlet.html', 'architecture.html', 'install.html', '404.html'];
let errors = 0;

for (const page of pages) {
  const html = await readFile(join(root, page), 'utf8');
  const missing = [];
  // local href/src references
  for (const m of html.matchAll(/(?:href|src)="([^"#][^"]*)"/g)) {
    const ref = m[1].split('?')[0];
    if (/^https?:/.test(ref) || ref.startsWith('mailto:')) continue;
    const file = normalize(join(root, ref));
    if (!file.startsWith(root)) { errors++; console.log(`${page}: bad path ${ref}`); continue; }
    try { await readFile(file); } catch { missing.push(ref); }
  }
  const noindex = /name="robots"\s+content="noindex"/.test(html);
  const checks = {
    'title': /<title>[^<]+<\/title>/.test(html),
    'description': /name="description"/.test(html),
    'canonical': /rel="canonical"/.test(html),
    'viewport': /name="viewport"/.test(html),
    'og:title': /property="og:title"/.test(html),
  };
  // noindex pages (404) don't need SEO meta.
  for (const [k, ok] of Object.entries(checks)) {
    if (!ok && !(noindex && k !== 'title' && k !== 'viewport')) { errors++; console.log(`${page}: missing ${k}`); }
  }
  if (missing.length) { errors++; console.log(`${page}: broken refs -> ${missing.join(', ')}`); }
  console.log(`${page}: ${checks.title && checks.description && checks.canonical ? 'SEO OK' : 'SEO ISSUE'}${missing.length ? ' + broken refs' : ''}`);
}

// sitemap + robots
for (const f of ['sitemap.xml', 'robots.txt']) {
  try { await readFile(join(root, f)); console.log(`${f}: OK`); }
  catch { errors++; console.log(`${f}: MISSING`); }
}

console.log(errors ? `\n${errors} issue(s)` : '\nAll good.');
process.exit(errors ? 1 : 0);
