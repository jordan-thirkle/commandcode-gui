/**
 * GauntletRunner — drives the pure state machine with real side effects:
 * builder runs, check commands, screenshot capture, and critic calls.
 *
 * It's transport-agnostic: the caller injects `runPrompt` (which spawns a
 * headless run and resolves with the final text) and `runCommand` (which runs
 * a check shell command and resolves with {code, stdout}).
 */
import {
  createInitialState,
  gauntletReducer,
  type GauntletAction,
  type GauntletConfig,
  type GauntletState,
} from './stateMachine';
import { runCritic } from './criticAdapter';

export interface GauntletDeps {
  /** Resolve the final assistant text for a headless run. */
  runPrompt: (prompt: string, opts?: { model?: string; effort?: string }) => Promise<string>;
  /** Resolve {code, stdout} for a shell check command. */
  runCommand: (command: string) => Promise<{ code: number; stdout: string }>;
  /** List of screenshot cams to capture after builders complete. */
  cams?: string[];
  /** Command that captures a screenshot; injected so the runner can call it. */
  captureScreenshot?: (cam: string) => Promise<string>;
}

export type GauntletListener = (action: GauntletAction) => void;

const DEFAULT_CHECKS: Array<{ name: string; command: string }> = [
  { name: 'npm run check', command: 'npm run check' },
  { name: 'npm run test:modes', command: 'npm run test:modes' },
];

/**
 * Execute one full gauntlet run to completion (or maxRounds). Returns the
 * final state. Listener receives each reducer action as it's applied.
 */
export async function runGauntlet(
  config: GauntletConfig,
  deps: GauntletDeps,
  listener?: GauntletListener,
): Promise<GauntletState> {
  let state = createInitialState(config);
  const dispatch = (action: GauntletAction): void => {
    state = gauntletReducer(state, action);
    listener?.(action);
  };

  const checks = config.checks.length > 0 ? config.checks : DEFAULT_CHECKS;

  for (let roundNo = 0; roundNo < config.maxRounds; roundNo++) {
    dispatch({ type: 'start-round' });

    // Build phase: fan out systems sequentially (isolated ownership per prompt).
    const round = state.rounds[state.rounds.length - 1];
    for (const system of round.systems) {
      dispatch({ type: 'system-start', systemId: system.id });
      try {
        const output = await deps.runPrompt(system.prompt, {
          model: config.model ?? 'deepseek/deepseek-v4-pro',
          effort: 'high',
        });
        dispatch({ type: 'system-done', systemId: system.id, ok: true, output });
      } catch (err) {
        dispatch({
          type: 'system-done',
          systemId: system.id,
          ok: false,
          output: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Check phase.
    for (const check of checks) {
      try {
        const { code } = await deps.runCommand(check.command);
        dispatch({
          type: 'check-result',
          check: { name: check.name, pass: code === 0 },
        });
      } catch (err) {
        dispatch({
          type: 'check-result',
          check: {
            name: check.name,
            pass: false,
            detail: err instanceof Error ? err.message : String(err),
          },
        });
      }
    }
    dispatch({ type: 'checks-complete' });

    // If a check failed, we record evidence and stop this round's critic run.
    const currentRound = state.rounds[state.rounds.length - 1];
    if (currentRound.checks.some((c) => !c.pass)) {
      dispatch({ type: 'recorded' });
      break;
    }

    // Critic phase: capture frames and grade the real pixels.
    let verdict;
    try {
      const cams = deps.cams?.length ? deps.cams : config.screenshotCam ? [config.screenshotCam] : ['plaza'];
      const screenshot = deps.captureScreenshot
        ? await deps.captureScreenshot(cams[0])
        : cams[0];
      verdict = await runCritic(
        {
          screenshotPath: screenshot,
          systemUnderReview: config.title,
          referenceBar: config.referenceBar,
          model: config.criticModel ?? 'gpt-5.6-luna',
          effort: 'high',
        },
        deps.runPrompt,
      );
    } catch (err) {
      dispatch({
        type: 'set-error',
        message: `Critic failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      break;
    }
    dispatch({ type: 'verdict', verdict });

    if (state.phase === 'done') break;
  }

  return state;
}
