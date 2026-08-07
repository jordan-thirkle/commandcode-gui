import { describe, expect, it } from 'vitest';
import { buildRunCommand } from '../src/main/cli/commandBuilder';

// The resolved CLI executable prefix (node + entry) may or may not exist in
// the test environment; strip it to get the CLI args proper.
function cliArgs(c: ReturnType<typeof buildRunCommand>): string[] {
  const prefixLen = c.args.length > 0 && c.args[0].endsWith('.mjs') ? 1 : 0;
  return c.args.slice(prefixLen);
}

describe('buildRunCommand', () => {
  it('builds a minimal headless json run', () => {
    const c = buildRunCommand({ prompt: 'explain this file', cwd: '/proj' });
    const args = cliArgs(c);
    expect(args.slice(0, 3)).toEqual(['-p', '--output-format', 'json']);
    expect(args[args.length - 1]).toBe('explain this file');
    expect(c.cwd).toBe('/proj');
  });

  it('adds model, effort, max-turns, permission-mode, trust', () => {
    const c = buildRunCommand({
      prompt: 'do it',
      model: 'deepseek/deepseek-v4-pro',
      effort: 'high',
      maxTurns: 50,
      permissionMode: 'auto-accept',
      trust: true,
      cwd: '/p',
    });
    const args = cliArgs(c);
    expect(args).toContain('--model');
    expect(args[args.indexOf('--model') + 1]).toBe('deepseek/deepseek-v4-pro');
    expect(args).toContain('--effort');
    expect(args[args.indexOf('--effort') + 1]).toBe('high');
    expect(args).toContain('--max-turns');
    expect(args[args.indexOf('--max-turns') + 1]).toBe('50');
    expect(args).toContain('--permission-mode');
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('auto-accept');
    expect(args).toContain('--trust');
  });

  it('resume wins over continueRecent', () => {
    const c = buildRunCommand({ prompt: 'x', resume: 'abc123', continueRecent: true, cwd: '/p' });
    const args = cliArgs(c);
    expect(args).toContain('--resume');
    expect(args[args.indexOf('--resume') + 1]).toBe('abc123');
    expect(args).not.toContain('--continue');
  });

  it('uses --continue when no resume id', () => {
    const c = buildRunCommand({ prompt: 'x', continueRecent: true, cwd: '/p' });
    const args = cliArgs(c);
    expect(args).toContain('--continue');
    expect(args).not.toContain('--resume');
  });

  it('adds repeatable --config key=value entries', () => {
    const c = buildRunCommand({
      prompt: 'x',
      config: { theme: 'dark', 'compact-mode': 'fast' },
      cwd: '/p',
    });
    const args = cliArgs(c);
    expect(args).toContain('--config');
    expect(args[args.indexOf('--config') + 1]).toBe('theme=dark');
    const configs = args
      .map((a, i) => (a === '--config' ? args[i + 1] : undefined))
      .filter((v): v is string => typeof v === 'string');
    expect(configs).toEqual(['theme=dark', 'compact-mode=fast']);
  });

  it('forces NO_COLOR for machine parsing', () => {
    const c = buildRunCommand({ prompt: 'x', cwd: '/p' });
    expect(c.env.NO_COLOR).toBe('1');
  });

  it('resolves the real CLI executable on Windows (not cmd.exe)', () => {
    const c = buildRunCommand({ prompt: 'x', cwd: '/p' });
    // Must not be the Windows shell.
    expect(c.cmd.toLowerCase()).not.toMatch(/cmd\.exe$/);
    // Either node+entry (preferred) or a PATH binary.
    if (c.args[0]?.endsWith('.mjs')) {
      expect(c.cmd).toMatch(/node(\.exe)?$/i);
    } else {
      expect(c.cmd.length).toBeGreaterThan(0);
    }
  });
});
