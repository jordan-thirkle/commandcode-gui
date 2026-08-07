/**
 * RunManager — owns the CliBridge, forwards events to the renderer via IPC,
 * and tracks per-run metadata (sessionId, usage, duration).
 */
import { BrowserWindow } from 'electron';
import type { CliBridge } from './cli/CliBridge.js';
import type { RunOptions } from './cli/commandBuilder.js';
import type { BridgeEvent } from '../shared/bridgeEvents.js';

export interface RunSummary {
  sessionId?: string;
  stopReason?: string;
  finalText: string;
  durationMs: number;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}

export class RunManager {
  private bridge: CliBridge;
  private win: BrowserWindow | null = null;
  private currentRunId = 0;
  private currentSummary: RunSummary = { finalText: '', durationMs: 0 };
  private running = false;

  constructor(bridge: CliBridge) {
    this.bridge = bridge;
  }

  attachWindow(win: BrowserWindow): void {
    this.win = win;
  }

  get isRunning(): boolean {
    return this.running;
  }

  startRun(opts: RunOptions): void {
    if (this.running) return;
    this.running = true;
    this.currentRunId += 1;
    this.currentSummary = { finalText: '', durationMs: 0 };
    void this.execute(opts);
  }

  private async execute(opts: RunOptions): Promise<void> {
    const runId = this.currentRunId;
    let acc = '';
    const start = Date.now();

    try {
      const handle = await this.bridge.run(opts);
      for await (const evt of this.bridge.events()) {
        if (runId !== this.currentRunId) break;
        this.forward(evt);
        if (evt.kind === 'text') acc += evt.delta;
        if (evt.kind === 'result') {
          this.currentSummary = {
            sessionId: evt.sessionId,
            stopReason: evt.stopReason,
            finalText: acc || evt.finalText,
            durationMs: evt.durationMs,
            usage: evt.usage,
          };
        }
      }
      await handle.done;
      this.currentSummary.durationMs = Date.now() - start;
    } catch (err) {
      this.forward({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.running = false;
      this.forward({ kind: 'run_finished' } as BridgeEvent);
      this.win?.webContents.send('run:event', {
        kind: 'summary',
        summary: this.currentSummary,
      } as BridgeEvent);
    }
  }

  private forward(evt: BridgeEvent): void {
    this.win?.webContents.send('run:event', evt);
  }

  abort(): void {
    this.bridge.abort();
  }
}
