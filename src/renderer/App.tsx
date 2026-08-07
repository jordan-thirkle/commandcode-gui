import { useCallback, useEffect, useRef, useState } from 'react';
import type { BridgeEvent } from '../shared/bridgeEvents';
import { DEFAULT_MODEL, DEFAULT_EFFORT, MODEL_PRESETS } from '../shared/models';
import { EXIT_CODE_LABELS } from '../shared/bridgeEvents';
import { ChatPane } from './ChatPane';
import { SessionList } from './SessionList';
import { GauntletView } from './GauntletView';

type View = 'chat' | 'sessions' | 'gauntlet' | 'skills' | 'mcp';

export interface RunState {
  model: string;
  effort: string;
  running: boolean;
  sessionId?: string;
  lastText: string;
  durationMs: number;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  stopReason?: string;
  exitCode?: number | null;
  error?: string;
}

export function App(): React.JSX.Element {
  const [view, setView] = useState<View>('chat');
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [effort, setEffort] = useState(DEFAULT_EFFORT);
  const [status, setStatus] = useState<RunState>({
    model,
    effort,
    running: false,
    lastText: '',
    durationMs: 0,
  });
  const [mcpStatus, setMcpStatus] = useState<string>('');

  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    if (!window.cmdgui) return;
    const unsub = window.cmdgui.onRunEvent((evt: BridgeEvent) => {
      setStatus((s) => updateStatus(s, evt));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!window.cmdgui) return;
    window.cmdgui
      .mcpList()
      .then((servers) =>
        setMcpStatus(servers.length > 0 ? `${servers.length} MCP server(s)` : 'no MCP servers'),
      )
      .catch(() => setMcpStatus('mcp unknown'));
  }, []);

  const run = useCallback(
    (prompt: string, opts?: { resume?: string; continueRecent?: boolean }) => {
      if (!window.cmdgui) return;
      void window.cmdgui.run({ prompt, model, effort, ...opts });
    },
    [model, effort],
  );

  const abort = useCallback(() => {
    void window.cmdgui?.abort();
  }, []);

  const modelChanged = (m: string): void => {
    setModel(m);
    const preset = MODEL_PRESETS.find((p) => p.model === m);
    if (preset?.effort) setEffort(preset.effort);
  };

  const usage = status.usage
    ? `${status.usage.inputTokens ?? 0} in / ${status.usage.outputTokens ?? 0} out`
    : '';
  const exitLabel = status.exitCode !== undefined && status.exitCode !== null
    ? EXIT_CODE_LABELS[status.exitCode] ?? `exit ${status.exitCode}`
    : '';

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>Command Code</h2>
        {(['chat', 'sessions', 'gauntlet', 'skills', 'mcp'] as View[]).map((v) => (
          <div
            key={v}
            className={`nav-item${view === v ? ' active' : ''}`}
            onClick={() => setView(v)}
          >
            {v[0].toUpperCase() + v.slice(1)}
          </div>
        ))}
      </aside>

      <header className="header">
        <span className="title">{status.sessionId ? `Session ${status.sessionId.slice(0, 8)}` : 'New run'}</span>
        <div className="spacer" />
        <div className="model-picker">
          <select
            value={model}
            onChange={(e) => modelChanged(e.target.value)}
            title="Model for runs"
          >
            {MODEL_PRESETS.map((p) => (
              <option key={p.model} value={p.model}>
                {p.label}
              </option>
            ))}
          </select>
          <select
            value={effort}
            onChange={(e) => setEffort(e.target.value)}
            title="Reasoning effort"
            style={{ marginLeft: 8 }}
          >
            {['low', 'medium', 'high', 'max'].map((e) => (
              <option key={e} value={e}>
                effort: {e}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className="main">
        {view === 'chat' && (
          <ChatPane
            running={status.running}
            onRun={run}
            onAbort={abort}
            sessionId={status.sessionId}
          />
        )}
        {view === 'sessions' && <SessionList onResume={(id) => run('', { resume: id })} />}
        {view === 'gauntlet' && <GauntletView onRun={run} running={status.running} />}
        {view === 'skills' && <SkillsMcpPanel />}
        {view === 'mcp' && <SkillsMcpPanel />}
      </main>

      <footer className="status">
        <span>
          model <span className="ok">{model}</span>
        </span>
        <span>
          effort <span className="ok">{effort}</span>
        </span>
        {status.running && <span className="ok">● running</span>}
        {usage && <span>tokens {usage}</span>}
        {status.durationMs > 0 && <span>{Math.round(status.durationMs / 1000)}s</span>}
        {exitLabel && <span>{exitLabel}</span>}
        {status.error && <span className="err">{status.error}</span>}
        {!status.running && <span>{mcpStatus}</span>}
      </footer>
    </div>
  );
}

function updateStatus(s: RunState, evt: BridgeEvent): RunState {
  switch (evt.kind) {
    case 'text':
      return { ...s, running: true, lastText: s.lastText + evt.delta };
    case 'result':
      return {
        ...s,
        running: false,
        sessionId: evt.sessionId ?? s.sessionId,
        stopReason: evt.stopReason,
        usage: evt.usage,
        durationMs: evt.durationMs,
        lastText: evt.finalText || s.lastText,
        error: evt.error,
      };
    case 'exit':
      return { ...s, running: false, exitCode: evt.code };
    case 'error':
      return { ...s, running: false, error: evt.message };
    case 'run_finished':
      return { ...s, running: false };
    case 'summary':
      return {
        ...s,
        running: false,
        sessionId: evt.summary.sessionId ?? s.sessionId,
        stopReason: evt.summary.stopReason,
        usage: evt.summary.usage,
        durationMs: evt.summary.durationMs,
        lastText: evt.summary.finalText || s.lastText,
      };
    default:
      return s;
  }
}

function SkillsMcpPanel(): React.JSX.Element {
  const [skills, setSkills] = useState<Array<{ name: string; description?: string }>>([]);
  const [agents, setAgents] = useState<Array<{ name: string }>>([]);

  useEffect(() => {
    void window.cmdgui?.listSkills().then(setSkills);
    void window.cmdgui?.listAgents().then(setAgents);
  }, []);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section>
        <h3>Skills</h3>
        <ul>
          {skills.map((s) => (
            <li key={s.name}>
              <strong>{s.name}</strong> — {s.description ?? ''}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Custom agents</h3>
        <ul>
          {agents.map((a) => (
            <li key={a.name}>{a.name}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
