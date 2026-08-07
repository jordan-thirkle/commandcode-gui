// Copies non-compiled assets Electron needs into dist/main.
// - electron/preload.cjs -> dist/main/electron/preload.cjs
import { copyFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const assets = [
  ['electron/preload.cjs', 'dist/main/electron/preload.cjs'],
];

for (const [src, dest] of assets) {
  const destPath = join(root, dest);
  await mkdir(dirname(destPath), { recursive: true });
  await copyFile(join(root, src), destPath);
  console.log(`copied ${src} -> ${dest}`);
}
