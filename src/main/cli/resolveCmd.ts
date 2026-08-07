/**
 * Resolves the real Command Code CLI executable, independent of PATH.
 *
 * On Windows, `cmd` is the system shell (C:\Windows\System32\cmd.exe) and
 * shadows the npm-installed CLI. The npm shims (`cmd.cmd`, `command-code.cmd`)
 * run `node <npm-prefix>/node_modules/command-code/dist/index.mjs`. We resolve
 * that entry directly so the app always drives the real CLI.
 */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export interface ResolvedExecutable {
  /** The program to spawn (node or the CLI shim). */
  command: string;
  /** Args before the CLI's own flags (e.g. the entry script for node). */
  prefixArgs: string[];
}

/**
 * Find the Command Code CLI entry. Priority:
 *  1. npm global install: <npm-prefix>/node_modules/command-code/dist/index.mjs
 *  2. A `command-code`/`cmd` binary on PATH (checked via `where`/`which`)
 * Returns null if nothing resolves.
 */
export function resolveCmdExecutable(): ResolvedExecutable | null {
  // 1. npm global prefix
  const prefix = npmGlobalPrefix();
  if (prefix) {
    const candidates = [
      join(prefix, 'node_modules', 'command-code', 'dist', 'index.mjs'),
      join(prefix, 'node_modules', 'command-code', 'dist', 'cli.mjs'),
    ];
    for (const entry of candidates) {
      if (existsSync(entry)) {
        return { command: process.execPath, prefixArgs: [entry] };
      }
    }
  }

  // 2. CLI on PATH (skip the Windows shell `cmd.exe`).
  const names = ['command-code', 'cmd'];
  for (const name of names) {
    const resolved = whichOnPath(name);
    if (resolved && !resolved.toLowerCase().endsWith('cmd.exe')) {
      return { command: resolved, prefixArgs: [] };
    }
  }

  return null;
}

function npmGlobalPrefix(): string | null {
  // `npm prefix -g` gives the global install root.
  try {
    const r = spawnSync(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['prefix', '-g'],
      { encoding: 'utf8' },
    );
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  } catch {
    // fall through
  }

  // Fallback: the folder containing this app's own node_modules sibling layout.
  // The CLI may be installed next to us; probe common locations.
  const here = dirname(fileURLToPath(import.meta.url));
  const guesses = [
    join(here, '..', '..', '..', 'node_modules', 'command-code'),
    join(process.env.APPDATA ?? '', 'npm', 'node_modules', 'command-code'),
    join(process.env.LOCALAPPDATA ?? '', 'npm', 'node_modules', 'command-code'),
  ];
  for (const g of guesses) {
    if (existsSync(join(g, 'dist', 'index.mjs'))) {
      return dirname(dirname(g));
    }
  }
  return null;
}

function whichOnPath(name: string): string | null {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    const r = spawnSync(cmd, [name], { encoding: 'utf8' });
    if (r.status !== 0) return null;
    const line = r.stdout.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
    return line ?? null;
  } catch {
    return null;
  }
}
