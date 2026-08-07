/**
 * Parses the raw `cmd -p --output-format json` NDJSON stream into typed
 * BridgeEvents. Unknown event types are ignored per the documented
 * forward-compatibility contract.
 */
import type { BridgeEvent, RawFrame, ExitCode } from '../../shared/bridgeEvents.js';

interface NormalizedUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

/** Normalize an arbitrary usage object to a safe shape. */
function normalizeUsage(u: unknown): NormalizedUsage {
  if (typeof u !== 'object' || u === null) return {};
  const r = u as Record<string, unknown>;
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' ? v : undefined;
  return {
    inputTokens: num(r.inputTokens) ?? num(r.input_tokens),
    outputTokens: num(r.outputTokens) ?? num(r.output_tokens),
    totalTokens: num(r.totalTokens) ?? num(r.total_tokens),
  };
}

/** Map an AgentEvent frame into a BridgeEvent, or null when ignorable. */
function mapAgentEvent(evt: Record<string, unknown>): BridgeEvent | null {
  switch (evt.type) {
    case 'text_delta':
      return { kind: 'text', delta: String(evt.delta ?? '') };
    case 'thinking_delta':
      return { kind: 'thinking', delta: String(evt.delta ?? '') };
    case 'tool_running':
      return {
        kind: 'tool_running',
        toolName: String(evt.toolName ?? evt.tool_name ?? 'tool'),
        description: typeof evt.description === 'string' ? evt.description : undefined,
      };
    case 'tool_completed':
      return { kind: 'tool_completed', toolName: String(evt.toolName ?? evt.tool_name ?? 'tool') };
    case 'tool_errored':
      return {
        kind: 'tool_errored',
        toolName: String(evt.toolName ?? evt.tool_name ?? 'tool'),
        error: String(evt.error ?? ''),
      };
    case 'tool_denied':
      return { kind: 'tool_denied', toolName: String(evt.toolName ?? evt.tool_name ?? 'tool') };
    case 'subagent_start':
      return { kind: 'subagent_start', subagentType: String(evt.subagentType ?? evt.subagent_type ?? 'agent') };
    case 'subagent_progress':
      return {
        kind: 'subagent_progress',
        subagentType: String(evt.subagentType ?? evt.subagent_type ?? 'agent'),
        toolName: String(evt.toolName ?? evt.tool_name ?? 'tool'),
      };
    case 'subagent_stop':
      return {
        kind: 'subagent_stop',
        subagentType: String(evt.subagentType ?? evt.subagent_type ?? 'agent'),
        tokensUsed: typeof evt.tokensUsed === 'number' ? evt.tokensUsed : undefined,
      };
    case 'notice':
      return {
        kind: 'notice',
        level: String(evt.level ?? 'info'),
        message: String(evt.message ?? ''),
      };
    case 'permission_mode_changed':
      return { kind: 'permission_mode_changed', mode: String(evt.mode ?? '') };
    default:
      return null; // forward-compatible ignore
  }
}

/** Parse one raw NDJSON line. Returns null for blank/invalid lines. */
export function parseFrameLine(line: string): RawFrame | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as RawFrame;
  } catch {
    return null;
  }
}

/** Convert a raw frame into a BridgeEvent, or null when ignorable. */
export function frameToBridgeEvent(frame: RawFrame): BridgeEvent | null {
  if (frame.type === 'event') {
    return mapAgentEvent(frame.event);
  }

  if (frame.type === 'result') {
    return {
      kind: 'result',
      subtype: frame.subtype,
      sessionId: frame.sessionId,
      stopReason: frame.stopReason,
      usage: frame.usage ? normalizeUsage(frame.usage) : undefined,
      durationMs: frame.durationMs ?? 0,
      finalText: frame.finalText ?? '',
      error: frame.error,
    };
  }

  return null;
}

/** Convenience: parse a full NDJSON string into events (used by tests + simple callers). */
export function parseStream(text: string): BridgeEvent[] {
  const out: BridgeEvent[] = [];
  for (const line of text.split('\n')) {
    const frame = parseFrameLine(line);
    if (!frame) continue;
    const evt = frameToBridgeEvent(frame);
    if (evt) out.push(evt);
  }
  return out;
}

export function exitCodeToBridgeEvent(code: number | null): BridgeEvent {
  return { kind: 'exit', code: code as ExitCode | null };
}
