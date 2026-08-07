// Smoke test: does the compiled Electron main resolve its own imports?
// Run with: node tests/smoke-compiled-main.mjs
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mainPath = join(here, '..', 'dist', 'main', 'electron', 'main.js');

try {
  await import(pathToFileURL(mainPath).href);
  console.log('SMOKE OK: compiled main resolves and loads (Electron app not started).');
} catch (e) {
  console.error('SMOKE FAIL:', e.message);
  console.error((e.stack ?? '').split('\n').slice(0, 6).join('\n'));
  process.exit(1);
}
