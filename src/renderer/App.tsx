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
  const [paletteOpen, setPaletteOpen] = useState(false);

  const statusRef = useRef(status);
  statusRef.current = status;

  // Global keyboard shortcuts: Ctrl+K command palette, Esc to close/stop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (e.key === 'Escape') {
        if (paletteOpen) {
          setPaletteOpen(false);
        } else if (statusRef.current.running) {
          void window.cmdgui?.abort();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen]);

  const go = (v: View): void => {
    setView(v);
    setPaletteOpen(false);
  };

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
            onClick={() => go(v)}
          >
            {v[0].toUpperCase() + v.slice(1)}
          </div>
        ))}
        <div className="sidebar-footer">
          <button className="palette-btn" onClick={() => setPaletteOpen(true)} title="Command palette (Ctrl+K)">
            <span>⌘</span> Command…
          </button>
        </div>
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

      {paletteOpen && (
        <CommandPalette
          current={view}
          onPick={go}
          onClose={() => setPaletteOpen(false)}
        />
      )}
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

function CommandPalette({ current, onPick, onClose }: {
  current: View;
  onPick: (v: View) => void;
  onClose: () => void;
}): React.JSX.Element {
  const [query, setQuery] = useState('');
  const items: Array<{ v: View; label: string; hint: string }> = [
    { v: 'chat', label: 'Chat', hint: 'New run / continue' },
    { v: 'sessions', label: 'Sessions', hint: 'List, resume, transcript' },
    { v: 'gauntlet', label: 'Gauntlet Studio', hint: 'Game-dev quality loop' },
    { v: 'skills', label: 'Skills', hint: 'Installed skills' },
    { v: 'mcp', label: 'MCP servers', hint: 'Server status' },
  ];
  const filtered = items.filter((i) =>
    i.label.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="palette-overlay" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={query}
          placeholder="Jump to…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filtered[0]) {
              onPick(filtered[0].v);
            }
          }}
        />
        <div className="palette-items">
          {filtered.map((i) => (
            <div
              key={i.v}
              className={`palette-item${i.v === current ? ' active' : ''}`}
              onClick={() => onPick(i.v)}
            >
              <span className="p-label">{i.label}</span>
              <span className="p-hint">{i.hint}</span>
            </div>
          ))}
          {filtered.length === 0 && <div className="palette-empty">No matches</div>}
        </div>
      </div>
    </div>
  );
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
