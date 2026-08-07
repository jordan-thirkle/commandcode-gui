/**
 * Critic adapter — sends a rendered screenshot to the project's visual-critic
 * agent (or a raw run) and parses the PASS/FAIL verdict.
 */
import type { CriticVerdict } from './stateMachine';
import { parseCriticVerdict } from './stateMachine';

export interface CriticCallOptions {
  /** Absolute path to the screenshot PNG the critic must grade. */
  screenshotPath: string;
  /** What system is under review (map/lighting, weapon viewmodel, HUD…). */
  systemUnderReview: string;
  /** The AAA reference bar (e.g. "real Call of Duty frame, blind A/B"). */
  referenceBar: string;
  /** Optional custom agent name (defaults to the project's visual-critic). */
  agentName?: string;
  model?: string;
  effort?: string;
}

export interface CriticRunner {
  run: (opts: CriticCallOptions) => Promise<CriticVerdict>;
}

/**
 * Builds the prompt that activates the visual-critic agent on a real frame.
 * Mirrors the agent's contract: real pixels only, never a builder summary.
 */
export function buildCriticPrompt(opts: CriticCallOptions): string {
  const agent = opts.agentName ?? 'visual-critic';
  return [
    `/agents ${agent}`,
    ``,
    `Grade this rendered frame against the bar: ${opts.referenceBar}`,
    ``,
    `System under review: ${opts.systemUnderReview}`,
    ``,
    `Screenshot (real pixels, not a description): ${opts.screenshotPath}`,
    ``,
    `Return exactly a PASS or FAIL verdict, and if FAIL name THE single biggest`,
    `gap with a severity 1-10 and a surgical work order.`,
  ].join('\n');
}

/**
 * Drives a critic call to completion, collecting the final text from a
 * headless run via the Bridge. The caller supplies the run/collect functions
 * so the adapter stays transport-agnostic (unit-testable without a CLI).
 */
export async function runCritic(
  opts: CriticCallOptions,
  exec: (prompt: string, extra?: { model?: string; effort?: string }) => Promise<string>,
): Promise<CriticVerdict> {
  const prompt = buildCriticPrompt(opts);
  const finalText = await exec(prompt, {
    model: opts.model,
    effort: opts.effort,
  });
  return parseCriticVerdict(finalText);
}
