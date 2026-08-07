import { useState } from 'react';
import type { ReactNode } from 'react';

export type PaneKind = 'chat' | 'sessions' | 'gauntlet' | 'skills';

interface WorkspaceProps {
  panes: Record<PaneKind, { label: string; node: ReactNode }>;
  active: PaneKind;
  onActivate: (p: PaneKind) => void;
}

/**
 * The multi-pane workspace — the "replace six terminals with one organized
 * window" view. Panes stay mounted (their state survives), hidden panes are
 * display:none, and the visible set is chosen via the tab bar. The active pane
 * gets the most room (full top row with 3+ visible); the rest share the rest.
 */
export function WorkspaceView({ panes, active, onActivate }: WorkspaceProps): React.JSX.Element {
  const [open, setOpen] = useState<Record<PaneKind, boolean>>({
    chat: true,
    sessions: false,
    gauntlet: false,
    skills: false,
  });

  const kinds = Object.keys(panes) as PaneKind[];

  const toggle = (p: PaneKind): void => {
    const nextOpen = !open[p];
    setOpen((o) => ({ ...o, [p]: nextOpen }));
    if (nextOpen) {
      onActivate(p);
      return;
    }
    // Hand focus off when the active pane closes.
    if (p === active) {
      const fallback = kinds.find((k) => k !== p && open[k]);
      if (fallback) onActivate(fallback);
    }
  };

  const visible = kinds.filter((k) => open[k]);
  // Render the visible active pane first (it gets the dominant grid slot);
  // hidden panes stay mounted, just display:none, in a stable order.
  const paneOrder = [
    ...(visible.includes(active) ? [active] : []),
    ...visible.filter((k) => k !== active),
    ...kinds.filter((k) => !open[k]),
  ];

  return (
    <div className="workspace">
      <div className="workspace-tabs" role="tablist" aria-label="Workspace panes">
        {kinds.map((k) => {
          const isOpen = open[k];
          return (
            <div
              key={k}
              role="tab"
              aria-selected={active === k}
              aria-controls={`pane-${k}`}
              tabIndex={active === k ? 0 : -1}
              className={`ws-tab${isOpen ? ' open' : ''}${active === k ? ' active' : ''}`}
              onClick={() => (isOpen ? onActivate(k) : toggle(k))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (isOpen) onActivate(k);
                  else toggle(k);
                }
              }}
            >
              {panes[k].label}
              <button
                type="button"
                className="ws-tab-x"
                aria-label={`Close ${panes[k].label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(k);
                }}
              >
                ×
              </button>
            </div>
          );
        })}
        <span className="ws-hint">Ctrl+K jump · panes keep state</span>
      </div>

      <div className={`workspace-body ws-count-${Math.min(visible.length, 4)}`}>
        {paneOrder.map((k) => (
          <div
            key={k}
            id={`pane-${k}`}
            role="tabpanel"
            aria-label={panes[k].label}
            className={`workspace-pane${open[k] ? ' visible' : ''}${active === k ? ' focused' : ''}`}
          >
            {panes[k].node}
          </div>
        ))}
        {visible.length === 0 && (
          <div className="workspace-empty">Open a pane to start. (Ctrl+K)</div>
        )}
      </div>
    </div>
  );
}
