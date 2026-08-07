import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WorkspaceView, type PaneKind } from '../src/renderer/Workspace';
import { GauntletView } from '../src/renderer/GauntletView';

// jsdom is intentionally NOT a dependency of this project. The renderer
// components only touch `window`/`DOM` inside event handlers (never at module
// load or on first render), so we smoke-test them via SSR (react-dom/server).
// This is precisely the class of regression — import + initial-render crashes
// — that let the GauntletView "fake PASS" bug ship.
describe('renderer smoke (SSR)', () => {
  it('WorkspaceView renders its pane tabs', () => {
    const panes = {
      chat: { label: 'Chat', node: createElement('div') },
      sessions: { label: 'Sessions', node: createElement('div') },
      gauntlet: { label: 'Gauntlet Studio', node: createElement('div') },
      skills: { label: 'Skills / MCP', node: createElement('div') },
    } as Record<PaneKind, { label: string; node: ReactNode }>;

    const html = renderToStaticMarkup(
      createElement(WorkspaceView, { panes, active: 'chat', onActivate: () => undefined }),
    );

    expect(html).toContain('role="tab"');
    expect(html).toContain('Chat');
    expect(html).toContain('Gauntlet Studio');
  });

  it('GauntletView renders its config form and Run button', () => {
    const html = renderToStaticMarkup(
      createElement(GauntletView, { onRun: () => undefined, running: false }),
    );
    expect(html).toContain('Run gauntlet');
    expect(html).toContain('DUSTLINE visual pass');
  });
});
