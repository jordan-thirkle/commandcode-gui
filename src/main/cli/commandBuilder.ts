/**
 * Translates UI state into the exact Command Code argv for a headless run.
 *
 * Contract (reference/headless.md + product-help.md CLI options):
 *  - `-p --output-format json <prompt>` runs a headless query.
 *  - `--resume <id>` resumes a specific session; `--continue` resumes the most
 *    recent headless session in the cwd.
 *  - `--model`, `--effort`, `--max-turns`, `--permission-mode`, `--trust`,
 *    `--config key=value` are repeatable/normal flags.
 */
import { resolveCmdExecutable, type ResolvedExecutable } from './resolveCmd.js';

export type PermissionMode = 'standard' | 'plan' | 'auto-accept';

export interface RunOptions {
  prompt: string;
  model?: string;
  effort?: string;
  resume?: string; // session id
  continueRecent?: boolean;
  maxTurns?: number;
  permissionMode?: PermissionMode;
  trust?: boolean;
  config?: Record<string, string>;
  cwd: string;
}

export interface BuiltCommand {
  /** The program to spawn (node or the CLI shim). */
  cmd: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
}

/** Cache the resolved executable across runs. */
let cached: ResolvedExecutable | null | undefined;

export function getResolvedExecutable(): ResolvedExecutable | null {
  if (cached === undefined) {
    cached = resolveCmdExecutable();
  }
  return cached;
}

export function buildRunCommand(opts: RunOptions): BuiltCommand {
  const args: string[] = ['-p', '--output-format', 'json'];

  if (opts.resume) {
    args.push('--resume', opts.resume);
  } else if (opts.continueRecent) {
    args.push('--continue');
  }

  if (opts.model) args.push('--model', opts.model);
  if (opts.effort) args.push('--effort', opts.effort);
  if (opts.maxTurns !== undefined) args.push('--max-turns', String(opts.maxTurns));
  if (opts.permissionMode) args.push('--permission-mode', opts.permissionMode);
  if (opts.trust) args.push('--trust');

  for (const [key, value] of Object.entries(opts.config ?? {})) {
    args.push('--config', `${key}=${value}`);
  }

  args.push(opts.prompt);

  const resolved = getResolvedExecutable();
  if (resolved) {
    return {
      cmd: resolved.command,
      args: [...resolved.prefixArgs, ...args],
      cwd: opts.cwd,
      env: { ...process.env, NO_COLOR: '1' },
    };
  }

  // Fallback: rely on `cmd` on PATH (works on non-Windows where cmd = the CLI).
  return {
    cmd: 'cmd',
    args,
    cwd: opts.cwd,
    env: { ...process.env, NO_COLOR: '1' },
  };
}
