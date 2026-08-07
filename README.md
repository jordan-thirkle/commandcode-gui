# Command Code GUI + Gauntlet Studio

A native desktop GUI for [Command Code](https://commandcode.ai) — Electron + React + TypeScript — that drives the real CLI through its documented JSON stream, and productizes the **DUSTLINE Gauntlet Loop** (split → fan out builders → judge with a fresh-context vision critic → iterate) as a first-class UI mode.

## Quick start

```bash
npm install
npm run dev        # terminal 1 — Vite dev server (http://localhost:5173)
npm start          # terminal 2 — Electron window (loads the dev server)
```

Or run the packaged renderer only:

```bash
npm run build      # typecheck + compile main + vite build
npx electron .     # loads dist/renderer/index.html when not in dev
```

## Architecture

The app never talks to the agent through a private protocol. It spawns the real CLI per run:

```
Electron main ──spawn──► cmd -p --output-format json <prompt>
   │                          │
   │   NDJSON event frames    │   text_delta · tool_running · subagent_* ·
   │◄─┼────────────────────────┘   notice · result {sessionId, usage, ...}
   │
   └─► renderer (React) — chat feed, session tree, gauntlet board, status bar
```

- **`src/main/cli/Bridge.ts`** — `Bridge` interface + `RunHandle`. The swap seam: today it's `CliBridge` (spawn the CLI); a future `HarnessBridge` can import `createHarness` from a published `@commandcode/harness` behind the same interface.
- **`src/main/cli/CliBridge.ts`** — spawns `cmd -p --output-format json`, parses the NDJSON stream line-by-line, forward-compatibly ignoring unknown event types.
- **`src/main/cli/commandBuilder.ts`** — UI state → exact CLI argv. Model/effort/resume/config/permission-mode/max-turns.
- **`src/main/cli/resolveCmd.ts`** — **Windows fix:** `cmd` on Windows resolves to `C:\Windows\System32\cmd.exe` (the shell), shadowing the CLI. This resolves the npm-global `command-code/dist/index.mjs` entry and runs it via `node`, falling back to a PATH binary.
- **`src/main/sessionStore.ts`** — reads the real session catalog at `~/.commandcode/projects/<slug>/`.
- **`src/main/surface.ts`** — MCP servers, skills, custom agents, settings — all via the real `cmd mcp/skills/agents` subcommands.
- **`src/gauntlet/`** — the Gauntlet Loop: a pure state machine (`stateMachine.ts`), a critic adapter (`criticAdapter.ts`) that invokes the project's `visual-critic` agent on real rendered PNGs, and a runner (`runner.ts`) that drives it with real builder runs + check commands.

## Model routing (matches DUSTLINE conventions)

- **Build & gauntlet-runner sessions default to `deepseek/deepseek-v4-pro`** (`--effort high`).
- Presets in the header dropdown: `gpt-5.6-luna` for quality-critical work, `xiaomi/mimo-v2.5-pro` for bulk/mechanical, `claude-sonnet-5` for balanced. **Never deepseek-v4-flash.**
- Exact model ids come from the model catalog (`src/shared/models.ts`); the GUI never invents ids.

## Gauntlet Studio

1. **Define** the artifact + reference bar (e.g. "a real Call of Duty frame, blind A/B").
2. **Split** into independently judgeable systems (map/lighting, weapon viewmodel, HUD…).
3. **Fan out builders** — each system runs as its own headless run with isolated ownership.
4. **Checks** — `npm run check` / `npm run test:modes` gate each round; a failing check records evidence and skips the critic.
5. **Critic** — a fresh-context run of the project's `visual-critic` agent grades the real screenshot PNG, returning PASS/FAIL + severity + a surgical work order.
6. **Iterate** — on FAIL, the next round is spawned with the work order as focus, bounded by max rounds.

## Tests

```bash
npm test              # vitest — bridge parser, command builder, gauntlet state machine, critic parsing
npm run typecheck     # tsc --noEmit
npm run build         # full build
```

The bridge parser test feeds the exact documented NDJSON shapes from the Command Code headless reference and asserts typed events, result frames, and forward-compatible ignoring of unknown event types.

## Surface coverage (day one)

Sessions (list/resume/transcript) · chat with live tool + sub-agent + token streaming · slash/config via `--config` · skills & agents browse · MCP server status · model/effort picker · status bar with exit-code mapping (3 auth, 4 permission, 8 max-turns, 10 credits, 130 interrupted).

## Marketing site

A static, SEO-optimized site for the project lives in `site/` (no build step, no backend — deployable as-is to GitHub Pages or any static host):

```bash
node scripts/serve-site.mjs 8899   # preview locally
node scripts/verify-site.mjs       # check pages, links, SEO meta
node scripts/make-og-cover.mjs     # regenerate the OG/Twitter cover PNG
```

- `index.html` — landing page with JSON-LD (SoftwareApplication), OG/Twitter cards, canonical URL, features/FAQ.
- `gauntlet.html` — long-form explainer of the Gauntlet Loop (TechArticle schema).
- `architecture.html` — the bridge design, the Windows `cmd.exe` fix, and model routing.
- `install.html` — requirements, two-command setup, troubleshooting.
- `sitemap.xml` / `robots.txt` / `404.html` — SEO infrastructure.

The site targets `https://games.byjtt.com/commandcode-gui/` (update canonical/OG URLs if you host elsewhere). It is intentionally static and self-contained so it can sit unmaintained and keep ranking.
