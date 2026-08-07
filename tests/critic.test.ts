import { describe, expect, it } from 'vitest';
import { buildCriticPrompt, runCritic } from '../src/gauntlet/criticAdapter';
import { parseCriticVerdict } from '../src/gauntlet/stateMachine';

describe('buildCriticPrompt', () => {
  it('activates the visual-critic agent on real pixels', () => {
    const prompt = buildCriticPrompt({
      screenshotPath: '/proj/shots/plaza.png',
      systemUnderReview: 'Map / lighting',
      referenceBar: 'a real Call of Duty frame',
    });
    expect(prompt).toContain('/agents visual-critic');
    expect(prompt).toContain('shots/plaza.png');
    expect(prompt).toContain('Map / lighting');
    expect(prompt).toContain('real pixels, not a description');
  });

  it('honors a custom agent name', () => {
    const prompt = buildCriticPrompt({
      screenshotPath: 's.png',
      systemUnderReview: 'HUD',
      referenceBar: 'bar',
      agentName: 'hud-critic',
    });
    expect(prompt).toContain('/agents hud-critic');
  });
});

describe('runCritic', () => {
  it('returns a parsed verdict from the collected final text', async () => {
    const exec = async (): Promise<string> =>
      'FAIL\nseverity: 7\nWORK ORDER: Rebuild the shadow terminator.';
    const verdict = await runCritic(
      {
        screenshotPath: '/proj/s.png',
        systemUnderReview: 'lighting',
        referenceBar: 'bar',
      },
      exec,
    );
    expect(verdict.pass).toBe(false);
    expect(verdict.severity).toBe(7);
    expect(verdict.workOrder).toContain('shadow terminator');
  });

  it('passes the model/effort through to the exec', async () => {
    let seen: { model?: string; effort?: string } | undefined;
    const exec = async (
      _prompt: string,
      extra?: { model?: string; effort?: string },
    ): Promise<string> => {
      seen = extra;
      return 'PASS';
    };
    const verdict = await runCritic(
      {
        screenshotPath: '/proj/s.png',
        systemUnderReview: 'hud',
        referenceBar: 'bar',
        model: 'gpt-5.6-luna',
        effort: 'high',
      },
      exec,
    );
    expect(seen).toEqual({ model: 'gpt-5.6-luna', effort: 'high' });
    expect(verdict.pass).toBe(true);
  });

  it('keeps raw text in the verdict', async () => {
    const verdict = await runCritic(
      { screenshotPath: 's.png', systemUnderReview: 'x', referenceBar: 'y' },
      async () => 'FAIL severity: 3 gap: fog',
    );
    expect(verdict.raw).toContain('gap: fog');
    expect(parseCriticVerdict(verdict.raw).pass).toBe(false);
  });
});
