/**
 * CliBridge — spawns the real `cmd -p --output-format json` child process and
 * streams typed events. This is the production transport; it uses the exact
 * documented CLI flags (no private protocol).
 */
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type { Bridge, RunHandle } from './Bridge.js';
import type { BridgeEvent } from '../../shared/bridgeEvents.js';
import { buildRunCommand, type RunOptions } from './commandBuilder.js';
import { exitCodeToBridgeEvent, parseFrameLine, frameToBridgeEvent } from './bridgeParser.js';
interface ActiveRun {
  child: ReturnType<typeof spawn>;
  emitter: EventEmitter;
  done: Promise<void>;
}

const EVENT = 'evt';

export class CliBridge implements Bridge {
  private active: ActiveRun | null = null;

  run(opts: RunOptions): Promise<RunHandle> {
    this.abort(); // one active run at a time (GUI sends one prompt per run)
    const built = buildRunCommand(opts);
    const child = spawn(built.cmd, built.args, {
      cwd: built.cwd,
      env: built.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const emitter = new EventEmitter();
    let buffer = '';

    const emit = (evt: BridgeEvent): void => {
      emitter.emit(EVENT, evt);
    };

    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      buffer += chunk;
      let nl: number;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        const frame = parseFrameLine(line);
        if (frame) {
          const evt = frameToBridgeEvent(frame);
          if (evt) emit(evt);
        }
      }
    });

    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => {
      // Headless writes errors/warnings to stderr; surface non-empty lines.
      const lines = chunk.split('\n').map((s) => s.trim()).filter(Boolean);
      for (const line of lines) {
        emit({ kind: 'notice', level: 'warning', message: line });
      }
    });

    const done = new Promise<void>((resolve) => {
      child.on('close', (code) => {
        emit(exitCodeToBridgeEvent(code));
        this.active = null;
        resolve();
      });
      child.on('error', (err) => {
        emit({ kind: 'error', message: err.message });
        resolve();
      });
    });

    this.active = { child, emitter, done };

    return Promise.resolve({
      abort: () => this.abort(),
      done,
    });
  }

  async *events(): AsyncIterable<BridgeEvent> {
    const run = this.active;
    if (!run) return;
    const queue: BridgeEvent[] = [];
    const waiters: Array<(evt: BridgeEvent | undefined) => void> = [];
    let done = false;

    const push = (evt: BridgeEvent): void => {
      if (done) return;
      const waiter = waiters.shift();
      if (waiter) waiter(evt);
      else queue.push(evt);
    };
    const finish = (): void => {
      done = true;
      for (const w of waiters.splice(0)) w(undefined);
    };

    run.emitter.on(EVENT, push);
    run.done.then(finish).catch(() => finish());

    try {
      while (!done || queue.length > 0) {
        if (queue.length > 0) {
          yield queue.shift() as BridgeEvent;
        } else if (done) {
          break;
        } else {
          const evt = await new Promise<BridgeEvent | undefined>((res) => waiters.push(res));
          if (evt === undefined) break;
          yield evt;
        }
      }
    } finally {
      run.emitter.removeListener(EVENT, push);
    }
  }

  abort(): void {
    const run = this.active;
    if (run) {
      run.child.kill('SIGTERM');
    }
  }
}
