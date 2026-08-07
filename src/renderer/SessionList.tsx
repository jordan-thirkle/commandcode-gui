import { useEffect, useState } from 'react';
import type { SessionSummary } from '../main/sessionStore';

interface Props {
  onResume: (id: string) => void;
}

export function SessionList({ onResume }: Props): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selected, setSelected] = useState<SessionSummary | null>(null);
  const [transcript, setTranscript] = useState('');

  useEffect(() => {
    void window.cmdgui?.listSessions().then(setSessions);
  }, []);

  const open = async (s: SessionSummary): Promise<void> => {
    setSelected(s);
    const t = await window.cmdgui?.readSession(s.id);
    setTranscript(t ?? '');
  };

  return (
    <div style={{ padding: 16, display: 'flex', gap: 16, height: '100%' }}>
      <div className="session-list" style={{ width: 320 }}>
        <h3>Session catalog</h3>
        {sessions.length === 0 && <div className="sid">no sessions found</div>}
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`session-item${selected?.id === s.id ? ' active' : ''}`}
            onClick={() => void open(s)}
          >
            <div>{s.title ?? '(untitled)'}</div>
            <div className="sid">
              {s.id.slice(0, 8)} · {s.model ?? 'model?'}
              {s.createdAt ? ` · ${new Date(s.createdAt).toLocaleString()}` : ''}
            </div>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {selected && (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <strong>{selected.title ?? selected.id}</strong>
              <button onClick={() => onResume(selected.id)}>Resume in CLI</button>
            </div>
            <pre
              style={{
                flex: 1,
                overflow: 'auto',
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 12,
                fontFamily: 'var(--mono)',
                fontSize: 12,
                whiteSpace: 'pre-wrap',
              }}
            >
              {transcript || 'select a session to view its transcript'}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}
