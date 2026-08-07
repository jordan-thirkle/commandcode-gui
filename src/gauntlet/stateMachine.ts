/**
 * Gauntlet Loop — the DUSTLINE workflow productized as a state machine.
 *
 * Phases (WORKFLOW.md "Gauntlet Loop gates"):
 *   define → split → build → check → critic → iterate (or done)
 *
 * A round = one split → build all systems → run checks → critic verdict.
 * If the critic FAILS, we iterate: record the verdict's work order as the
 * next round's focus and run again (bounded by maxRounds).
 */

export interface GauntletSystem {
  id: string;
  name: string;
  prompt: string;
  /** File ownership hint for builder isolation (dir or glob). */
  owner?: string;
  status: 'pending' | 'building' | 'built' | 'failed';
  builderOutput?: string;
  checks?: CheckResult[];
  verdict?: CriticVerdict;
}

export interface CheckResult {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface CriticVerdict {
  pass: boolean;
  severity?: number; // 1..10 when FAIL
  gap?: string; // the single biggest gap
  workOrder?: string; // the surgical fix instruction
  raw: string;
}

export interface GauntletRound {
  number: number;
  systems: GauntletSystem[];
  checks: CheckResult[];
  verdict?: CriticVerdict;
  startedAt: number;
  finishedAt?: number;
}

export interface GauntletConfig {
  title: string;
  referenceBar: string;
  systems: Array<{ name: string; prompt: string; owner?: string }>;
  screenshotCam?: string;
  checks: Array<{ name: string; command: string }>;
  maxRounds: number;
  /** Builder model (defaults to DeepSeek V4 Pro per the project routing). */
  model?: string;
  /** Critic model (defaults to gpt-5.6-luna — the quality-critical tier). */
  criticModel?: string;
}

export interface GauntletState {
  phase: 'idle' | 'building' | 'checking' | 'critic' | 'recording' | 'done';
  config: GauntletConfig;
  rounds: GauntletRound[];
  currentSystem?: string;
  roundLog: string[];
  error?: string;
}

export function createInitialState(config: GauntletConfig): GauntletState {
  return { phase: 'idle', config, rounds: [], roundLog: [] };
}

/** Move one round forward based on the current phase + events. Pure reducer. */
export function gauntletReducer(
  state: GauntletState,
  action: GauntletAction,
): GauntletState {
  switch (action.type) {
    case 'start-round': {
      const round: GauntletRound = {
        number: state.rounds.length + 1,
        systems: state.config.systems.map((s, i) => ({
          id: `${state.rounds.length + 1}-${i}`,
          name: s.name,
          prompt: s.prompt,
          owner: s.owner,
          status: 'pending',
        })),
        checks: [],
        startedAt: Date.now(),
      };
      return {
        ...state,
        phase: 'building',
        rounds: [...state.rounds, round],
        roundLog: [...state.roundLog, `Round ${round.number}: building ${round.systems.length} systems`],
      };
    }

    case 'system-start': {
      const round = lastRound(state);
      if (!round) return state;
      return {
        ...state,
        currentSystem: action.systemId,
        rounds: updateRound(state, {
          systems: round.systems.map((s) =>
            s.id === action.systemId ? { ...s, status: 'building' } : s,
          ),
        }),
      };
    }

    case 'system-done': {
      const round = lastRound(state);
      if (!round) return state;
      const systems = round.systems.map((s) =>
        s.id === action.systemId
          ? {
              ...s,
              status: action.ok ? ('built' as const) : ('failed' as const),
              builderOutput: action.output,
            }
          : s,
      );
      const allDone = systems.every((s) => s.status === 'built' || s.status === 'failed');
      return {
        ...state,
        currentSystem: undefined,
        phase: allDone ? 'checking' : state.phase,
        rounds: updateRound(state, { systems }),
      };
    }

    case 'check-result': {
      const round = lastRound(state);
      if (!round) return state;
      const checks = [...round.checks, action.check];
      return {
        ...state,
        rounds: updateRound(state, { checks }),
      };
    }

    case 'checks-complete': {
      const round = lastRound(state);
      if (!round) return state;
      const anyFail = round.checks.some((c) => !c.pass);
      return {
        ...state,
        phase: anyFail ? 'recording' : 'critic',
        roundLog: [
          ...state.roundLog,
          anyFail ? 'Checks failed — skipping critic, recording evidence' : 'Checks passed — sending frames to critic',
        ],
      };
    }

    case 'verdict': {
      const round = lastRound(state);
      if (!round) return state;
      const rounds = updateRound(state, {
        verdict: action.verdict,
        systems: round.systems.map((s) => ({ ...s, verdict: action.verdict })),
        finishedAt: Date.now(),
      });
      const pass = action.verdict.pass;
      const nextRound = state.rounds.length;
      const atMax = nextRound >= state.config.maxRounds;
      return {
        ...state,
        phase: atMax || pass ? 'done' : 'recording',
        rounds,
        roundLog: [
          ...state.roundLog,
          pass
            ? `Round ${round.number}: CRITIC PASSES`
            : `Round ${round.number}: critic FAIL (severity ${action.verdict.severity})`,
        ],
      };
    }

    case 'recorded':
      return { ...state, phase: 'done' };

    case 'set-error':
      return { ...state, error: action.message, phase: 'done' };

    default:
      return state;
  }
}

export type GauntletAction =
  | { type: 'start-round' }
  | { type: 'system-start'; systemId: string }
  | { type: 'system-done'; systemId: string; ok: boolean; output?: string }
  | { type: 'check-result'; check: CheckResult }
  | { type: 'checks-complete' }
  | { type: 'verdict'; verdict: CriticVerdict }
  | { type: 'recorded' }
  | { type: 'set-error'; message: string };

function lastRound(state: GauntletState): GauntletRound | undefined {
  return state.rounds[state.rounds.length - 1];
}

function updateRound(state: GauntletState, patch: Partial<GauntletRound>): GauntletRound[] {
  const rounds = [...state.rounds];
  const i = rounds.length - 1;
  if (i >= 0) rounds[i] = { ...rounds[i], ...patch };
  return rounds;
}

/** Parse a critic's free-text verdict into a structured CriticVerdict. */
export function parseCriticVerdict(raw: string): CriticVerdict {
  const pass = /(?:^|\n)(PASS|PASSES|ACCEPT)/i.test(raw) ||
    /(?:verdict|result)\s*:\s*pass/i.test(raw);
  const fail = /(?:^|\n)(FAIL|FAILS|REJECT)/i.test(raw) ||
    /(?:verdict|result)\s*:\s*fail/i.test(raw);

  const verdict: CriticVerdict = {
    pass: pass && !fail,
    raw,
  };

  const sevMatch = /severity\s*[:=]?\s*(\d{1,2})/i.exec(raw);
  if (sevMatch) verdict.severity = Math.min(10, Math.max(1, parseInt(sevMatch[1], 10)));

  // Work order heuristic: the section after "work order" / "WORK ORDER" marker.
  const woMatch = /(?:WORK ORDER|work order|workorder|Work order)\s*[:#-]?\s*([\s\S]{20,})/i.exec(raw);
  if (woMatch) {
    verdict.workOrder = woMatch[1].trim();
  }

  return verdict;
}
