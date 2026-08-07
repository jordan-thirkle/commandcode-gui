/**
 * Bridge abstraction — the swap seam between the CLI transport (now) and a
 * future embedded harness (createHarness from a published @commandcode/harness).
 */
import type { BridgeEvent } from '../../shared/bridgeEvents.js';
import type { RunOptions } from './commandBuilder.js';

export interface RunHandle {
  /** Abort the current run (SIGTERM to the child). */
  abort(): void;
  /** Resolve once the process has exited. */
  done: Promise<void>;
}

export interface Bridge {
  /** Start a run; yields typed events until completion or abort. */
  run(opts: RunOptions): Promise<RunHandle>;
  /** Async iteration of events for the active run. */
  events(): AsyncIterable<BridgeEvent>;
}
