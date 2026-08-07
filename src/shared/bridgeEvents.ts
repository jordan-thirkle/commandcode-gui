/**
 * Typed view over the documented `cmd -p --output-format json` NDJSON stream.
 *
 * Protocol contract (reference/headless.md):
 *  - Event frames: {"type":"event","event":{...AgentEvent...}}
 *  - One final result line: {"type":"result","subtype":"success|error|max_turns",...}
 *  - Treat unknown event.type values as forward-compatible and ignore them.
 */

export type StopReason =
  | 'end_turn'
  | 'max_turns'
  | 'stop_hook'
  | 'terminate'
  | 'permission_denied'
  | 'interrupted'
  | 'run_error'
  | string;

export type ExitCode =
  | 0
  | 1
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 130;

export interface ToolRunningEvent {
  type: 'tool_running';
  toolCallId: string;
  toolName: string;
  description?: string;
}

export interface ToolCompletedEvent {
  type: 'tool_completed';
  toolCallId: string;
  toolName: string;
  result: string;
}

export interface ToolErroredEvent {
  type: 'tool_errored';
  toolCallId: string;
  toolName: string;
  error: string;
}

export interface TextDeltaEvent {
  type: 'text_delta';
  delta: string;
}

export interface ThinkingDeltaEvent {
  type: 'thinking_delta';
  delta: string;
}

export interface SubagentStartEvent {
  type: 'subagent_start';
  toolCallId: string;
  subagentType: string;
}

export interface SubagentProgressEvent {
  type: 'subagent_progress';
  toolCallId: string;
  subagentType: string;
  toolName: string;
  toolInput: unknown;
  tokensUsed?: number;
}

export interface SubagentStopEvent {
  type: 'subagent_stop';
  toolCallId: string;
  subagentType: string;
  tokensUsed?: number;
}

export interface ModelRequestEndEvent {
  type: 'model_request_end';
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  stopReason?: StopReason;
}

export interface RunStartEvent {
  type: 'run_start';
  sessionId: string;
}

export interface RunEndEvent {
  type: 'run_end';
  result: unknown;
}

export interface NoticeEvent {
  type: 'notice';
  level: 'info' | 'warning' | 'error' | string;
  message: string;
}

export interface PermissionModeChangedEvent {
  type: 'permission_mode_changed';
  mode: string;
}

export interface ToolDeniedEvent {
  type: 'tool_denied';
  toolCallId: string;
  toolName: string;
}

/** Any event frame shape; the parser preserves unknown fields for forward-compat. */
export interface EventFrame {
  type: 'event';
  event: Record<string, unknown>;
}

export interface ResultFrame {
  type: 'result';
  subtype: 'success' | 'error' | 'max_turns';
  sessionId?: string;
  stopReason?: StopReason;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  durationMs: number;
  finalText: string;
  error?: string;
}

export type RawFrame = EventFrame | ResultFrame;

/** Discriminated union a renderer consumes. */
export type BridgeEvent =
  | { kind: 'text'; delta: string }
  | { kind: 'thinking'; delta: string }
  | { kind: 'tool_running'; toolName: string; description?: string }
  | { kind: 'tool_completed'; toolName: string }
  | { kind: 'tool_errored'; toolName: string; error: string }
  | { kind: 'tool_denied'; toolName: string }
  | {
      kind: 'subagent_start';
      subagentType: string;
    }
  | {
      kind: 'subagent_progress';
      subagentType: string;
      toolName: string;
    }
  | { kind: 'subagent_stop'; subagentType: string; tokensUsed?: number }
  | { kind: 'notice'; level: string; message: string }
  | { kind: 'permission_mode_changed'; mode: string }
  | {
      kind: 'result';
      subtype: 'success' | 'error' | 'max_turns';
      sessionId?: string;
      stopReason?: StopReason;
      usage?: ResultFrame['usage'];
      durationMs: number;
      finalText: string;
      error?: string;
    }
  | { kind: 'exit'; code: ExitCode | null; signal?: string }
  | { kind: 'error'; message: string }
  | { kind: 'run_finished' }
  | { kind: 'summary'; summary: { sessionId?: string; stopReason?: string; finalText: string; durationMs: number; usage?: ResultFrame['usage'] } };

export const EXIT_CODE_LABELS: Record<number, string> = {
  0: 'Success',
  1: 'General error',
  3: 'Not authenticated',
  4: 'Permission denied',
  5: 'Rate limit exceeded',
  6: 'Network failure',
  7: 'API server error (5xx)',
  8: 'Max turns reached before final answer',
  9: 'Model produced no response',
  10: 'Insufficient credits',
  130: 'Interrupted',
};
