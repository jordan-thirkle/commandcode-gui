// End-to-end bridge smoke: spawn the real `cmd -p --output-format json` and
// collect the NDJSON stream. Run with: node tests/bridge-e2e.mjs
import { CliBridge } from '../dist/main/src/main/cli/CliBridge.js';

const bridge = new CliBridge();
const seen = [];
const handle = await bridge.run({
  prompt: 'Reply with exactly: BRIDGE_E2E_OK',
  model: 'deepseek/deepseek-v4-pro',
  effort: 'high',
  cwd: process.cwd(),
  trust: true,
});

for await (const evt of bridge.events()) {
  seen.push(evt.kind);
  if (evt.kind === 'result') {
    console.log('RESULT:', JSON.stringify({
      subtype: evt.subtype,
      sessionId: evt.sessionId ?? null,
      stopReason: evt.stopReason ?? null,
      durationMs: evt.durationMs,
      finalText: (evt.finalText ?? '').slice(0, 120),
    }));
  }
  if (evt.kind === 'exit') {
    console.log('EXIT CODE:', evt.code);
  }
}
await handle.done;
console.log('KINDS SEEN:', [...new Set(seen)].join(','));
