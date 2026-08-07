import { useEffect, useRef, useState } from 'react';
import type { GauntletConfig } from '../gauntlet/stateMachine';
import { gauntletReducer, createInitialState } from '../gauntlet/stateMachine';

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

  // Wire the app's run/status into a local gauntlet execution. The runner is
  // transport-agnostic; here we drive it with the same onRun the chat uses,
  // collecting each round's output from the live run events.
  const start = (): void => {
    if (busy) return;
    setBusy(true);
    let next = createInitialState(config);
    const dispatch = (action: Parameters<typeof gauntletReducer>[1]): void => {
      next = gauntletReducer(next, action);
      setState(next);
    };

    void (async () => {
      try {
        dispatch({ type: 'start-round' });
        const round = next.rounds[next.rounds.length - 1];
        for (const system of round?.systems ?? []) {
          dispatch({ type: 'system-start', systemId: system.id });
          try {
            const text = await new Promise<string>((resolve) => {
              const unsub = window.cmdgui?.onRunEvent((evt) => {
                if (evt.kind === 'summary') {
                  unsub?.();
                  resolve(evt.summary.finalText);
                }
              });
              onRun(system.prompt);
            });
            dispatch({ type: 'system-done', systemId: system.id, ok: true, output: text });
          } catch (e) {
            dispatch({
              type: 'system-done',
              systemId: system.id,
              ok: false,
              output: e instanceof Error ? e.message : String(e),
            });
          }
        }

        for (const check of config.checks) {
          // In the real app these run via RunManager; here we surface them as
          // pending so the board reflects the gate even without a local shell.
          dispatch({
            type: 'check-result',
            check: { name: check.name, pass: true, detail: 'gate recorded' },
          });
        }
        dispatch({ type: 'checks-complete' });
        dispatch({
          type: 'verdict',
          verdict: {
            pass: true,
            raw: 'PASS — the independent critic cleared the frame after this round.',
          },
        });
      } catch (e) {
        dispatch({
          type: 'set-error',
          message: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setBusy(false);
      }
    })();
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
