import { describe, expect, it } from 'vitest';
import {
  parseStream,
  parseFrameLine,
  frameToBridgeEvent,
} from '../src/main/cli/bridgeParser';
import type { RawFrame } from '../src/shared/bridgeEvents';

// Sample NDJSON mirroring the documented protocol (reference/headless.md).
const SAMPLE_STREAM = [
  '{"type":"event","event":{"type":"tool_running","toolCallId":"t1","toolName":"read_file","description":"Reads a file"}}',
  '{"type":"event","event":{"type":"text_delta","delta":"hello "}}',
  '{"type":"event","event":{"type":"text_delta","delta":"world"}}',
  '{"type":"event","event":{"type":"subagent_start","subagentType":"visual-critic","toolCallId":"t2"}}',
  '{"type":"event","event":{"type":"subagent_progress","subagentType":"visual-critic","toolCallId":"t2","toolName":"read_file"}}',
  '{"type":"event","event":{"type":"subagent_stop","subagentType":"visual-critic","toolCallId":"t2","tokensUsed":1234}}',
  '{"type":"event","event":{"type":"tool_completed","toolCallId":"t1","toolName":"read_file","result":"ok"}}',
  '{"type":"result","subtype":"success","sessionId":"9f4e1c0a-abc","stopReason":"end_turn","usage":{"inputTokens":10,"outputTokens":20},"durationMs":8421,"finalText":"hello world"}',
].join('\n');

describe('parseStream', () => {
  it('maps every documented frame type to a BridgeEvent', () => {
    const events = parseStream(SAMPLE_STREAM);
    const kinds = events.map((e) => e.kind);
    expect(kinds).toEqual([
      'tool_running',
      'text',
      'text',
      'subagent_start',
      'subagent_progress',
      'subagent_stop',
      'tool_completed',
      'result',
    ]);
  });

  it('concatenates text deltas', () => {
    const events = parseStream(SAMPLE_STREAM);
    const text = events.filter((e) => e.kind === 'text').map((e) => (e.kind === 'text' ? e.delta : '')).join('');
    expect(text).toBe('hello world');
  });

  it('preserves the result frame fields', () => {
    const events = parseStream(SAMPLE_STREAM);
    const result = events.find((e) => e.kind === 'result');
    expect(result).toMatchObject({
      kind: 'result',
      subtype: 'success',
      sessionId: '9f4e1c0a-abc',
      stopReason: 'end_turn',
      durationMs: 8421,
      finalText: 'hello world',
    });
    if (result && result.kind === 'result') {
      expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
    }
  });

  it('ignores unknown event types forward-compatibly', () => {
    const line =
      '{"type":"event","event":{"type":"brand_new_event_xyz","foo":1}}';
    const frame = parseFrameLine(line);
    expect(frame).not.toBeNull();
    expect(frameToBridgeEvent(frame as RawFrame)).toBeNull();
  });

  it('tolerates blank and malformed lines', () => {
    expect(parseFrameLine('')).toBeNull();
    expect(parseFrameLine('   ')).toBeNull();
    expect(parseFrameLine('{not json')).toBeNull();
  });

  it('handles an error result subtype', () => {
    const events = parseStream(
      '{"type":"result","subtype":"error","durationMs":100,"finalText":""}',
    );
    expect(events[0]).toMatchObject({ kind: 'result', subtype: 'error' });
  });

  it('handles a max_turns result subtype', () => {
    const events = parseStream(
      '{"type":"result","subtype":"max_turns","durationMs":500,"finalText":"partial"}',
    );
    expect(events[0]).toMatchObject({ kind: 'result', subtype: 'max_turns' });
  });
});
