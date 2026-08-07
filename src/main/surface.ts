/**
 * Read-only helpers for the rest of the Command Code surface:
 * MCP servers, skills, custom agents, and settings. These shell out to the
 * real `cmd` CLI (documented subcommands) rather than duplicating state.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { getResolvedExecutable } from './cli/commandBuilder.js';

const execFileAsync = promisify(execFile);

export interface McpServerInfo {
  name: string;
  transport?: string;
  enabled?: boolean;
}

export interface SkillInfo {
  name: string;
  description?: string;
  path: string;
}

export interface AgentInfo {
  name: string;
  path: string;
}

function runCmd(args: string[], cwd: string): Promise<string> {
  const resolved = getResolvedExecutable();
  const cmd = resolved?.command ?? 'cmd';
  const prefix = resolved?.prefixArgs ?? [];
  return execFileAsync(cmd, [...prefix, ...args], {
    cwd,
    env: { ...process.env, NO_COLOR: '1' },
    maxBuffer: 1024 * 1024 * 4,
  }).then((r) => r.stdout);
}

export async function listMcpServers(cwd: string): Promise<McpServerInfo[]> {
  try {
    const out = await runCmd(['mcp', 'list'], cwd);
    return out
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => ({ name: line }));
  } catch {
    return [];
  }
}

export async function listSkills(): Promise<SkillInfo[]> {
  const roots = [
    join(homedir(), '.commandcode', 'skills'),
    join(process.cwd(), '.commandcode', 'skills'),
  ];
  const out: SkillInfo[] = [];
  for (const root of roots) {
    let names: string[];
    try {
      names = await fs.readdir(root);
    } catch {
      continue;
    }
    for (const name of names) {
      const dir = join(root, name);
      let desc: string | undefined;
      try {
        const skillMd = await fs.readFile(join(dir, 'SKILL.md'), 'utf8');
        const m = /^description:\s*(.+)$/m.exec(skillMd);
        if (m) desc = m[1].trim();
      } catch {
        // not a skill dir
      }
      if (desc !== undefined) out.push({ name, description: desc, path: dir });
    }
  }
  return out;
}

export async function listAgents(): Promise<AgentInfo[]> {
  const roots = [
    join(homedir(), '.commandcode', 'agents'),
    join(process.cwd(), '.commandcode', 'agents'),
  ];
  const out: AgentInfo[] = [];
  for (const root of roots) {
    let files: string[];
    try {
      files = await fs.readdir(root);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith('.md')) continue;
      out.push({ name: f.slice(0, -'.md'.length), path: join(root, f) });
    }
  }
  return out;
}

export interface SettingsSnapshot {
  theme?: string;
  model?: string;
  permissionMode?: string;
  raw: Record<string, unknown>;
}

export async function readSettings(): Promise<SettingsSnapshot> {
  const path = join(homedir(), '.commandcode', 'settings.json');
  try {
    const raw = JSON.parse(await fs.readFile(path, 'utf8')) as Record<string, unknown>;
    const permissions = (raw.permissions ?? {}) as Record<string, unknown>;
    return {
      theme: typeof raw.theme === 'string' ? raw.theme : undefined,
      model: typeof raw.model === 'string' ? raw.model : undefined,
      permissionMode: typeof permissions.defaultMode === 'string' ? permissions.defaultMode : undefined,
      raw,
    };
  } catch {
    return { raw: {} };
  }
}
