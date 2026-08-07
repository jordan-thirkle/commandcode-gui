import { useEffect, useRef, useState } from 'react';
import { runGauntlet, type GauntletDeps } from '../gauntlet/runner';
import {
  gauntletReducer,
  createInitialState,
  type GauntletConfig,
  type GauntletAction,
} from '../gauntlet/stateMachine';

interface Props {
  onRun: (prompt: string, opts?: { resume?: string; continueRecent?: boolean }) => void;
  running: boolean;
}

const SAMPLE_SYSTEMS: Array<{ name: string; prompt: string; owner?: string }> = [
  {
    name: 'Map / lighting',
    owner: 'shared/map.js client/*.js',
    prompt:
      'Act as a builder for the Map/Lighting system of DUSTLINE. Improve lighting, sun rig, ' +
      'contact shadows, and ground/prop materials toward a real Call of Duty frame. ' +
      'Own shared/map.js and the client renderer paths. Do not touch other systems. ' +
      'Keep everything procedural (no external assets). Report exactly what you changed.',
  },
  {
    name: 'Weapon viewmodel',
    owner: 'client/viewmodel*',
    prompt:
      'Act as a builder for the Weapon Viewmodel system of DUSTLINE. Polish the procedural ' +
      'M4/AK/MP5/M249/shotgun/sniper construction cues, reload feel, and first-person hands ' +
      'toward a real Call of Duty frame. Own the viewmodel paths only. Keep it procedural.',
  },
  {
    name: 'HUD',
    owner: 'client/hud*',
    prompt:
      'Act as a builder for the HUD system of DUSTLINE. Polish health/ammo/scoreboard/chat ' +
      'to sub-pixel AAA quality with the DUSTLINE branding. Own the HUD paths only.',
  },
];

export function GauntletView({ onRun, running }: Props): React.JSX.Element {
  const [config, setConfig] = useState<GauntletConfig>({
    title: 'DUSTLINE visual pass',
    referenceBar: 'A real Call of Duty frame, blind A/B',
    systems: SAMPLE_SYSTEMS,
    screenshotCam: 'plaza',
    checks: [
      { name: 'npm run check', command: 'npm run check' },
      { name: 'npm run test:modes', command: 'npm run test:modes' },
    ],
    maxRounds: 2,
  });
  const [state, setState] = useState(() => createInitialState(config));
  const [busy, setBusy] = useState(false);

  // The gauntlet runner (src/gauntlet/runner.ts) is pure and already unit-tested.
  // We wire it to the live CLI transport: each builder system launches a real
  // headless run; each check runs as a real shell command via IPC; the critic
  // grades real screenshots. There are NO fabricated verdicts — if a step can't
  // run (e.g. no screenshot source), the error surfaces honestly instead of a
  // fake PASS.
  const runPrompt = (prompt: string, opts?: { model?: string; effort?: string }): Promise<string> => {
    return new Promise<string>((resolve) => {
      let done = false;
      const unsub = window.cmdgui?.onRunEvent((evt) => {
        if (evt.kind === 'summary' && !done) {
          done = true;
          unsub?.();
          resolve(evt.summary.finalText ?? '');
        }
      });
      void window.cmdgui?.run({
        prompt,
        model: opts?.model ?? config.model,
        effort: opts?.effort ?? 'high',
      });
    });
  };

  const runCommand = (command: string): Promise<{ code: number; stdout: string }> => {
    if (!window.cmdgui) return Promise.resolve({ code: 1, stdout: '' });
    return window.cmdgui.runCommand({ command }).then((r) => ({
      code: typeof r?.code === 'number' ? r.code : 1,
      stdout: r?.stdout ?? '',
    }));
  };

  const captureScreenshot = (cam: string): Promise<string> => {
    if (!window.cmdgui) return Promise.reject(new Error('renderer unavailable'));
    return window.cmdgui
      .runCommand({ command: `npm run screenshot -- "${cam}"` })
      .then((r) => {
        if (typeof r?.code === 'number' && r.code !== 0) {
          throw new Error(
            `Capture failed (exit ${r.code}). Add a "screenshot" npm script (e.g. "node tools/cdp-shot.js") to enable visual grading.`,
          );
        }
        const lines = (r?.stdout ?? '')
          .trim()
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);
        return lines[lines.length - 1] ?? cam;
      });
  };

  const gauntletDeps: GauntletDeps = {
    runPrompt,
    runCommand,
    cams: config.screenshotCam ? [config.screenshotCam] : undefined,
    captureScreenshot: config.screenshotCam ? captureScreenshot : undefined,
  };

  const start = (): void => {
    if (busy) return;
    setBusy(true);
    let next = createInitialState(config);
    const dispatch = (action: GauntletAction): void => {
      next = gauntletReducer(next, action);
      setState(next);
    };
    void runGauntlet(config, gauntletDeps, dispatch)
      .catch((e) =>
        dispatch({ type: 'set-error', message: e instanceof Error ? e.message : String(e) }),
      )
      .finally(() => setBusy(false));
  };

  const round = state.rounds[state.rounds.length - 1];

  return (
    <div className="gauntlet-board">
      <div className="gauntlet-config">
        <div className="row">
          <label>
            Title
            <input
              value={config.title}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
            />
          </label>
          <label>
            Reference bar
            <input
              value={config.referenceBar}
              onChange={(e) => setConfig({ ...config, referenceBar: e.target.value })}
            />
          </label>
          <label>
            Screenshot cam
            <input
              value={config.screenshotCam ?? 'plaza'}
              onChange={(e) => setConfig({ ...config, screenshotCam: e.target.value })}
            />
          </label>
          <label>
            Max rounds
            <input
              type="number"
              min={1}
              max={10}
              value={config.maxRounds}
              onChange={(e) => setConfig({ ...config, maxRounds: parseInt(e.target.value, 10) || 1 })}
            />
          </label>
        </div>
        <div className="systems-editor">
          <strong>Systems (isolated builders)</strong>
          {config.systems.map((s, i) => (
            <div key={i} className="system-row">
              <input
                value={s.name}
                onChange={(e) => {
                  const systems = [...config.systems];
                  systems[i] = { ...systems[i], name: e.target.value };
                  setConfig({ ...config, systems });
                }}
              />
              <input
                value={s.prompt}
                onChange={(e) => {
                  const systems = [...config.systems];
                  systems[i] = { ...systems[i], prompt: e.target.value };
                  setConfig({ ...config, systems });
                }}
              />
              <button
                onClick={() =>
                  setConfig({ ...config, systems: config.systems.filter((_, j) => j !== i) })
                }
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              setConfig({
                ...config,
                systems: [...config.systems, { name: 'New system', prompt: '' }],
              })
            }
          >
            + system
          </button>
        </div>
        <button onClick={start} disabled={busy || running}>
          {busy ? 'Running gauntlet…' : 'Run gauntlet'}
        </button>
      </div>

      {round && (
        <div className="round-card">
          <div>
            <strong>Round {round.number}</strong> — phase: <code>{state.phase}</code>
          </div>
          <div style={{ marginTop: 8 }}>
            {round.systems.map((s) => (
              <div key={s.id} className="system-row">
                <span
                  style={{
                    color:
                      s.status === 'built' ? 'var(--green)' : s.status === 'failed' ? 'var(--red)' : s.status === 'building' ? 'var(--yellow)' : 'var(--text-dim)',
                  }}
                >
                  {s.status === 'built' ? '✓' : s.status === 'failed' ? '✗' : s.status === 'building' ? '●' : '○'}
                </span>
                <span>{s.name}</span>
              </div>
            ))}
          </div>
          {round.checks.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {round.checks.map((c, i) => (
                <div key={i}>
                  {c.pass ? '✓' : '✗'} {c.name}
                </div>
              ))}
            </div>
          )}
          {round.verdict && (
            <div className={`verdict ${round.verdict.pass ? 'verdict-pass' : 'verdict-fail'}`}>
              {round.verdict.pass ? 'PASS' : `FAIL (severity ${round.verdict.severity ?? '?'})`}
              <div className="verdict">{round.verdict.workOrder ?? round.verdict.raw}</div>
            </div>
          )}
        </div>
      )}

      {state.roundLog.length > 0 && (
        <pre
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 12,
            fontFamily: 'var(--mono)',
            fontSize: 12,
            whiteSpace: 'pre-wrap',
          }}
        >
          {state.roundLog.join('\n')}
        </pre>
      )}
    </div>
  );
}
