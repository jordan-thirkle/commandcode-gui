# commandcode-gui

A native desktop GUI for [Command Code](https://commandcode.ai) — the AI coding agent that
runs in your terminal. This is the visual front-end: organized, point-and-click, for
everyone who'd rather not live in six terminal tabs.

It drives the **real CLI** through its documented JSON stream (no private protocol), and
productizes the **Gauntlet Loop** — the DUSTLINE game-dev process of split → fan out
builders → judge with a vision critic → iterate — as a first-class UI mode.

Status: **Working MVP (0.1.0).** Core chat, sessions, gauntlet, and skills/MCP surfaces
work and are tested (29 vitest tests). Set-and-forget dev is live: CI, templates, and
Dependabot are in place.

---

## Quick start

```bash
npm install
npm run dev        # terminal 1 — Vite dev server (http://localhost:5173)
npm start          # terminal 2 — Electron window (loads the dev server)
```

Or the packaged renderer only:

```bash
npm run build      # typecheck + compile main + vite build
npx electron .     # loads dist/renderer/index.html when not in dev
```

---

## Why this exists

Command Code in the terminal is powerful but terminal-shaped. This GUI keeps the power and
adds the organization:

- **One window, many panes** — instead of six terminals, one organized workspace
- **Point-and-click** — model/effort/session/resume without remembering flags
- **For every skill level** — the power of the CLI, the approachability of an app
- **The Gauntlet Studio** — a visual home for the game-dev quality loop

It never forks the agent protocol. It spawns the real CLI per run:

```
Electron main ──spawn──► cmd -p --output-format json <prompt>
   │                          │
   │   NDJSON event frames    │   text_delta · tool_running · subagent_* ·
   │◄─┼────────────────────────┘   notice · result {sessionId, usage, ...}
   │
   └─► renderer (React) — chat feed, session tree, gauntlet board, status bar
```

## Architecture

| Path | Role |
|---|---|
| `electron/` | Electron main process + preload (the secure IPC boundary) |
| `src/main/` | Main-process logic: run manager, session store, surface (MCP/skills/agents) |
| `src/main/cli/` | `Bridge` interface + `CliBridge` (spawns CLI, parses NDJSON) + command builder |
| `src/renderer/` | React UI: chat, sessions, gauntlet, skills/MCP panels |
| `src/gauntlet/` | Gauntlet Loop: pure state machine, critic adapter, runner |
| `src/shared/` | Types shared across processes (bridge events, model catalog) |
| `site/` | Static, SEO-optimized marketing site (deployable as-is) |
| `tests/` | Vitest unit tests + smoke e2e |

### The Bridge seam (the important design decision)

`src/main/cli/Bridge.ts` is the swap seam. Today it's `CliBridge` — it spawns
`cmd -p --output-format json`, parses the NDJSON stream line-by-line, and forward-compatibly
ignores unknown event types. A future `HarnessBridge` can import `createHarness` from a
published `@commandcode/harness` behind the **same interface**, with zero UI changes. The
UI never talks to a private protocol; it talks to the documented one.

### The Windows `cmd.exe` fix

On Windows, `cmd` in PATH resolves to `C:\Windows\System32\cmd.exe` (the shell), shadowing
the Command Code CLI. `src/main/cli/resolveCmd.ts` resolves the npm-global
`command-code/dist/index.mjs` entry and runs it via `node`, falling back to a PATH binary.

### Model routing (matches DUSTLINE conventions)

- **Build & gauntlet-runner sessions default to `deepseek/deepseek-v4-pro`** (`--effort high`).
- Presets in the header dropdown: `gpt-5.6-luna` for quality-critical work,
  `xiaomi/mimo-v2.5-pro` for bulk/mechanical, `claude-sonnet-5` for balanced.
  **Never deepseek-v4-flash.**
- Exact model ids come from the model catalog (`src/shared/models.ts`); the GUI never
  invents ids.

## Gauntlet Studio

1. **Define** the artifact + reference bar (e.g. "a real Call of Duty frame, blind A/B").
2. **Split** into independently judgeable systems (map/lighting, weapon viewmodel, HUD…).
3. **Fan out builders** — each system runs as its own headless run with isolated ownership.
4. **Checks** — `npm run check` / `npm run test:modes` gate each round; a failing check
   records evidence and skips the critic.
5. **Critic** — a fresh-context run of the project's `visual-critic` agent grades the real
   screenshot PNG, returning PASS/FAIL + severity + a surgical work order.
6. **Iterate** — on FAIL, the next round is spawned with the work order as focus, bounded by
   max rounds.

## Tests

```bash
npm test              # vitest — bridge parser, command builder, gauntlet state machine, critic parsing
npm run typecheck     # tsc --noEmit
npm run build         # full build
```

CI runs all three on every PR and push (see `.github/workflows/ci.yml`). The bridge parser
test feeds the exact documented NDJSON shapes from the Command Code headless reference and
asserts typed events, result frames, and forward-compatible ignoring of unknown event types.

## Surface coverage

Sessions (list/resume/transcript) · chat with live tool + sub-agent + token streaming ·
slash/config via `--config` · skills & agents browse · MCP server status · model/effort
picker · status bar with exit-code mapping (3 auth, 4 permission, 8 max-turns, 10 credits,
130 interrupted).

## Marketing site

A static, SEO-optimized site lives in `site/` (no build step, no backend — deployable
as-is to GitHub Pages or any static host):

```bash
node scripts/serve-site.mjs 8899   # preview locally
node scripts/verify-site.mjs       # check pages, links, SEO meta
node scripts/make-og-cover.mjs     # regenerate the OG/Twitter cover PNG
```

- `index.html` — landing page with JSON-LD (SoftwareApplication), OG/Twitter cards.
- `gauntlet.html` — long-form explainer of the Gauntlet Loop (TechArticle schema).
- `architecture.html` — the bridge design, the Windows `cmd.exe` fix, and model routing.
- `install.html` — requirements, two-command setup, troubleshooting.
- `sitemap.xml` / `robots.txt` / `404.html` — SEO infrastructure.

The site targets `https://games.byjtt.com/commandcode-gui/` (update canonical/OG URLs if you
host elsewhere). It is intentionally static and self-contained so it can sit unmaintained
and keep ranking.

---

## Contributing

This project is built to be **set-and-forget**: a small, well-tested core that welcomes
outside help. See [CONTRIBUTING.md](CONTRIBUTING.md) for ground rules, and
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Changelog lives in [CHANGELOG.md](CHANGELOG.md).

**License:** [MIT](LICENSE) — use it, fork it, build on it.

## Security

If you find a security issue, **do not open a public issue.** Report it privately to the
maintainer (email in the GitHub profile) so it can be fixed before disclosure.
