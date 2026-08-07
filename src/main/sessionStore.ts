/**
 * Reads the Command Code session catalog from disk
 * (~/.commandcode/projects/<project-slug>/<session-id>.jsonl).
 *
 * Session store contract (reference/sessions.md):
 *  - Sessions live at ~/.commandcode/projects/<slug>/<id>.jsonl
 *  - Each file: header line (session id, created, cwd), then tree entries
 *  - Sidecar: <id>.meta.json holds title/model; checkpoints/prompts sidecars too.
 */
import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface SessionSummary {
  id: string;
  title?: string;
  model?: string;
  createdAt?: string;
  transcriptPath: string;
  projectSlug: string;
}

function projectsRoot(): string {
  return join(homedir(), '.commandcode', 'projects');
}

function slugify(dir: string): string {
  return dir.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
}

export async function listSessions(projectDir?: string): Promise<SessionSummary[]> {
  const root = projectsRoot();
  const out: SessionSummary[] = [];
  let slugs: string[] = [];
  try {
    slugs = await fs.readdir(root);
  } catch {
    return out;
  }

  if (projectDir) {
    const wanted = slugify(projectDir);
    slugs = slugs.filter((s) => s === wanted);
  }

  for (const slug of slugs) {
    const dir = join(root, slug);
    let files: string[];
    try {
      files = await fs.readdir(dir);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue;
      const id = f.slice(0, -'.jsonl'.length);
      const transcriptPath = join(dir, f);
      let title: string | undefined;
      let model: string | undefined;
      let createdAt: string | undefined;

      try {
        const metaRaw = await fs.readFile(join(dir, `${id}.meta.json`), 'utf8');
        const meta = JSON.parse(metaRaw) as Record<string, unknown>;
        if (typeof meta.title === 'string') title = meta.title;
        if (typeof meta.model === 'string') model = meta.model;
        if (typeof meta.createdAt === 'string') createdAt = meta.createdAt;
      } catch {
        // no sidecar — fine
      }

      if (!createdAt) {
        try {
          const header = (await fs.readFile(transcriptPath, 'utf8')).split('\n')[0];
          const parsed = JSON.parse(header) as Record<string, unknown>;
          if (typeof parsed.createdAt === 'string') createdAt = parsed.createdAt;
          if (typeof parsed.createdAt === 'number') createdAt = new Date(parsed.createdAt).toISOString();
        } catch {
          // leave undefined
        }
      }

      out.push({ id, title, model, createdAt, transcriptPath, projectSlug: slug });
    }
  }

  // newest first
  return out.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

export async function readTranscript(id: string): Promise<string> {
  const root = projectsRoot();
  const slugs = await fs.readdir(root).catch(() => [] as string[]);
  for (const slug of slugs) {
    try {
      return await fs.readFile(join(root, slug, `${id}.jsonl`), 'utf8');
    } catch {
      // try next slug
    }
  }
  throw new Error(`Session ${id} not found`);
}
