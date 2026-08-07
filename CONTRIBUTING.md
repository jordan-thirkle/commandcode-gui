# Contributing to Command Code GUI

Thanks for wanting to contribute. This project is built to be **set-and-forget**: a small,
well-tested core that welcomes outside help without needing a maintainer babysitting every PR.

## What this project is

A native desktop GUI for Command Code (Electron + React + TypeScript) that drives the real
CLI through its documented JSON stream, with a Gauntlet Studio mode for game-dev loops.
The README's "Architecture" section is the canonical explanation — read it first.

## Ground rules

- **Tests must pass** — `npm test` (vitest). Every PR runs them in CI.
- **Typecheck must pass** — `npm run typecheck`.
- **No build step surprises** — `npm run build` must succeed.
- **Small, focused PRs.** One logical change per PR. Huge refactors get reviewed slowly.
- **Follow the existing style.** This is a TypeScript/React project using tabs? Check the
  existing files and match them. When in doubt, match the file you're editing.

## Getting started

```bash
git clone https://github.com/jordan-thirkle/commandcode-gui
cd commandcode-gui
npm install
npm run dev        # terminal 1 — Vite dev server (http://localhost:5173)
npm start          # terminal 2 — Electron window
```

Before submitting:

```bash
npm test
npm run typecheck
npm run build
```

## How the code is organized

| Path | What lives there |
|---|---|
| `electron/` | Electron main process + preload |
| `src/main/` | Main-process logic: CLI bridge, session store, surface (MCP/skills/agents) |
| `src/main/cli/` | The Bridge interface + CliBridge + command builder + Windows `resolveCmd` |
| `src/renderer/` | React UI: chat, sessions, gauntlet, skills/MCP panels |
| `src/gauntlet/` | Gauntlet Loop: pure state machine, critic adapter, runner |
| `src/shared/` | Types shared across processes (bridge events, model catalog) |
| `site/` | Static marketing site (deployable as-is) |
| `tests/` | Vitest + e2e smoke tests |

The key architectural rule: **the app never talks to the agent through a private protocol.**
It spawns the real CLI per run and parses the documented NDJSON stream. Keep it that way.

## The Bridge seam

`src/main/cli/Bridge.ts` is the swap seam: today it's `CliBridge` (spawn the CLI); a future
`HarnessBridge` can import `createHarness` from a published `@commandcode/harness` behind
the same interface. If you touch it, preserve the interface contract.

## Gauntlet Studio

The gauntlet runner (`src/gauntlet/runner.ts`) is pure and unit-tested; the renderer
(`src/renderer/GauntletView.tsx`) wires it to the real transport:

- **System builds** each spawn a real headless CLI run.
- **Checks** run as real shell commands over a bounded `runCommand` IPC (timeout-guarded,
  never blocking the gate forever).
- **Critic** grades a real screenshot captured from a project `screenshot` npm script. If
  no screenshot source is configured, the critic step **fails honestly** instead of
  guessing a PASS.

If you touch the check/critic path, extend `src/gauntlet/runner.ts` (and its tests), not the
renderer's wiring. Keep the runner transport-agnostic.

## Submitting a PR

1. Fork the repo.
2. Create a branch: `git checkout -b fix/something`.
3. Make your change + tests.
4. Push and open a PR against `main`.
5. Fill out the PR template — it exists so reviewers can move fast.

## Issue reporting

- **Bugs:** include OS, Command Code version, and a minimal reproduction.
- **Feature requests:** describe the workflow you want, not just the widget.
- **Security:** do NOT open a public issue. See the README's security note.

## Code of conduct

Be decent. Harassment, trolling, and personal attacks are not welcome. See
`CODE_OF_CONDUCT.md`.
