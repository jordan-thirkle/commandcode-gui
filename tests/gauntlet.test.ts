import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  gauntletReducer,
  parseCriticVerdict,
  type GauntletConfig,
} from '../src/gauntlet/stateMachine';

const CONFIG: GauntletConfig = {
  title: 'test pass',
  referenceBar: 'CoD frame',
  systems: [
    { name: 'lighting', prompt: 'fix lighting' },
    { name: 'hud', prompt: 'fix hud' },
  ],
  checks: [],
  maxRounds: 2,
};

describe('gauntletReducer', () => {
  it('starts a round with pending systems', () => {
    let s = createInitialState(CONFIG);
    s = gauntletReducer(s, { type: 'start-round' });
    expect(s.phase).toBe('building');
    expect(s.rounds).toHaveLength(1);
    expect(s.rounds[0].systems.map((x) => x.status)).toEqual(['pending', 'pending']);
  });

  it('transitions to checking when all systems are done', () => {
    let s = createInitialState(CONFIG);
    s = gauntletReducer(s, { type: 'start-round' });
    const [s1, s2] = s.rounds[0].systems.map((x) => x.id);
    s = gauntletReducer(s, { type: 'system-start', systemId: s1 });
    s = gauntletReducer(s, { type: 'system-done', systemId: s1, ok: true });
    expect(s.phase).toBe('building');
    s = gauntletReducer(s, { type: 'system-start', systemId: s2 });
    s = gauntletReducer(s, { type: 'system-done', systemId: s2, ok: true });
    expect(s.phase).toBe('checking');
  });

  it('a failed builder marks the system failed and still completes the round', () => {
    let s = createInitialState(CONFIG);
    s = gauntletReducer(s, { type: 'start-round' });
    const [s1, s2] = s.rounds[0].systems.map((x) => x.id);
    s = gauntletReducer(s, { type: 'system-start', systemId: s1 });
    s = gauntletReducer(s, { type: 'system-done', systemId: s1, ok: false });
    s = gauntletReducer(s, { type: 'system-start', systemId: s2 });
    s = gauntletReducer(s, { type: 'system-done', systemId: s2, ok: true });
    expect(s.rounds[0].systems[0].status).toBe('failed');
    expect(s.phase).toBe('checking');
  });

  it('a failing check skips the critic (records evidence instead)', () => {
    let s = createInitialState(CONFIG);
    s = gauntletReducer(s, { type: 'start-round' });
    for (const sys of s.rounds[0].systems) {
      s = gauntletReducer(s, { type: 'system-start', systemId: sys.id });
      s = gauntletReducer(s, { type: 'system-done', systemId: sys.id, ok: true });
    }
    s = gauntletReducer(s, {
      type: 'check-result',
      check: { name: 'npm run check', pass: false },
    });
    s = gauntletReducer(s, { type: 'checks-complete' });
    expect(s.phase).toBe('recording');
  });

  it('a PASS verdict finishes the gauntlet', () => {
    let s = createInitialState(CONFIG);
    s = gauntletReducer(s, { type: 'start-round' });
    for (const sys of s.rounds[0].systems) {
      s = gauntletReducer(s, { type: 'system-start', systemId: sys.id });
      s = gauntletReducer(s, { type: 'system-done', systemId: sys.id, ok: true });
    }
    s = gauntletReducer(s, {
      type: 'check-result',
      check: { name: 'check', pass: true },
    });
    s = gauntletReducer(s, { type: 'checks-complete' });
    s = gauntletReducer(s, {
      type: 'verdict',
      verdict: { pass: true, raw: 'PASS — cleared the bar' },
    });
    expect(s.phase).toBe('done');
    expect(s.rounds[0].verdict?.pass).toBe(true);
  });

  it('a FAIL verdict iterates to a new round when under maxRounds', () => {
    let s = createInitialState(CONFIG);
    s = gauntletReducer(s, { type: 'start-round' });
    for (const sys of s.rounds[0].systems) {
      s = gauntletReducer(s, { type: 'system-start', systemId: sys.id });
      s = gauntletReducer(s, { type: 'system-done', systemId: sys.id, ok: true });
    }
    s = gauntletReducer(s, {
      type: 'check-result',
      check: { name: 'check', pass: true },
    });
    s = gauntletReducer(s, { type: 'checks-complete' });
    s = gauntletReducer(s, {
      type: 'verdict',
      verdict: { pass: false, severity: 8, raw: 'FAIL — lighting is flat' },
    });
    expect(s.phase).toBe('recording');
  });
});

describe('parseCriticVerdict', () => {
  it('parses a PASS', () => {
    const v = parseCriticVerdict(
      'PASS\nThe frame clears the bar: contact shadows and materials are physical.',
    );
    expect(v.pass).toBe(true);
  });

  it('parses a FAIL with severity and work order', () => {
    const raw = [
      'FAIL',
      'severity: 9',
      'The lighting is flat and the ground reads as a single material.',
      'WORK ORDER: Raise the sun intensity to 1.8, set ground roughness to 0.4,',
      'and add a warm bounce fill. Done = frame passes at f/2.8 exposure.',
    ].join('\n');
    const v = parseCriticVerdict(raw);
    expect(v.pass).toBe(false);
    expect(v.severity).toBe(9);
    expect(v.workOrder).toContain('Raise the sun intensity');
  });

  it('does not treat a lower-case mention as pass', () => {
    const v = parseCriticVerdict('this frame does not pass the bar yet.');
    expect(v.pass).toBe(false);
  });

  it('clamps severity to 1..10', () => {
    const v = parseCriticVerdict('FAIL severity: 99');
    expect(v.severity).toBe(10);
  });
});
