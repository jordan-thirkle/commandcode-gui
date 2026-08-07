import { useEffect, useRef, useState } from 'react';
import type { BridgeEvent } from '../shared/bridgeEvents';

interface FeedEntry {
  id: number;
  role: 'user' | 'assistant' | 'tool' | 'subagent' | 'thinking' | 'notice' | 'error';
  text: string;
  meta?: string;
}

let nextId = 1;

interface Props {
  running: boolean;
  onRun: (prompt: string, opts?: { resume?: string; continueRecent?: boolean }) => void;
  onAbort: () => void;
  sessionId?: string;
}

export function ChatPane({ running, onRun, onAbort, sessionId }: Props): React.JSX.Element {
  const [input, setInput] = useState('');
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [assistantAcc, setAssistantAcc] = useState('');
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.cmdgui) return;
    const unsub = window.cmdgui.onRunEvent((evt: BridgeEvent) => {
      switch (evt.kind) {
        case 'text': {
          setAssistantAcc((acc) => {
            const next = acc + evt.delta;
            setEntries((prev) => upsertAssistant(prev, next));
            return next;
          });
          break;
        }
        case 'thinking':
          push({ role: 'thinking', text: evt.delta, meta: 'thinking' });
          break;
        case 'tool_running':
          push({ role: 'tool', text: `⛏ ${evt.toolName}${evt.description ? ' — ' + evt.description : ''}`, meta: evt.toolName });
          break;
        case 'tool_completed':
          push({ role: 'tool', text: `✓ ${evt.toolName}`, meta: evt.toolName });
          break;
        case 'tool_errored':
          push({ role: 'error', text: `✗ ${evt.toolName}: ${evt.error}`, meta: evt.toolName });
          break;
        case 'tool_denied':
          push({ role: 'error', text: `⛔ ${evt.toolName} denied`, meta: evt.toolName });
          break;
        case 'subagent_start':
          push({ role: 'subagent', text: `▶ subagent ${evt.subagentType} started`, meta: evt.subagentType });
          break;
        case 'subagent_progress':
          push({ role: 'subagent', text: `   ${evt.subagentType} → ${evt.toolName}`, meta: evt.subagentType });
          break;
        case 'subagent_stop':
          push({
            role: 'subagent',
            text: `■ subagent ${evt.subagentType} finished${evt.tokensUsed ? ` (${evt.tokensUsed} tokens)` : ''}`,
            meta: evt.subagentType,
          });
          break;
        case 'notice':
          push({ role: 'notice', text: evt.message, meta: evt.level });
          break;
        case 'error':
          push({ role: 'error', text: evt.message });
          break;
        case 'exit':
          push({ role: 'notice', text: `run exited with code ${evt.code}`, meta: 'exit' });
          break;
        case 'summary':
          setAssistantAcc(evt.summary.finalText || '');
          setEntries((prev) => upsertAssistant(prev, evt.summary.finalText || ''));
          break;
        default:
          break;
      }
    });
    return unsub;
  }, []);

  const push = (e: Omit<FeedEntry, 'id'>): void => {
    setEntries((prev) => [...prev, { ...e, id: nextId++ }]);
  };

  const submit = (): void => {
    const prompt = input.trim();
    if (!prompt || running) return;
    setInput('');
    setAssistantAcc('');
    push({ role: 'user', text: prompt });
    onRun(prompt);
  };

  useEffect(() => {
    feedRef.current?.scrollTo(0, feedRef.current.scrollHeight);
  }, [entries]);

  return (
    <div className="chat">
      <div className="feed" ref={feedRef}>
        {entries.map((e) => (
          <div key={e.id} className={`entry ${e.role}`}>
            {e.meta && <div className="meta">{e.meta}</div>}
            {e.text}
          </div>
        ))}
        {running && <div className="entry notice">… running</div>}
      </div>
      <div className="input-row">
        <textarea
          value={input}
          placeholder={
            sessionId ? `Continue session ${sessionId.slice(0, 8)}…` : 'Ask Command Code…'
          }
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {running ? (
          <button onClick={onAbort} title="Stop (Esc)">
            Stop
          </button>
        ) : (
          <button onClick={submit} disabled={!input.trim()} title="Run (Ctrl+Enter)">
            Run
          </button>
        )}
      </div>
    </div>
  );
}

function upsertAssistant(prev: FeedEntry[], text: string): FeedEntry[] {
  if (!text) return prev;
  const last = prev[prev.length - 1];
  if (last && last.role === 'assistant') {
    const rest = prev.slice(0, -1);
    return [...rest, { ...last, text }];
  }
  return [...prev, { id: nextId++, role: 'assistant', text }];
}
