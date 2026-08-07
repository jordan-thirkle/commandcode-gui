// End-to-end bridge check: spawn the real `cmd -p --output-format json` and
// collect the NDJSON stream. Run with: node tests/bridge-e2e.mjs
//
// This is an INTEGRATION test: it needs the Command Code CLI installed and
// authenticated on $PATH. In CI (CLI absent) it SKIPS with a clear marker —
// it never exits green on a spawn failure, so CI can't false-pass here.
import { CliBridge } from '../dist/main/src/main/cli/CliBridge.js';
import { getResolvedExecutable } from '../dist/main/src/main/cli/resolveCmd.js';

const resolved = getResolvedExecutable();
if (!resolved) {
  console.warn('E2E_SKIP: command-code CLI not resolved — install Command Code to run this e2e.');
  console.log('E2E_RESULT=skipped');
  process.exit(0);
}

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

const kinds = [...new Set(seen)].join(',');
console.log('KINDS SEEN:', kinds);

// A successful e2e must produce a `result` event. Seeing only `error` means the
// CLI never ran — that's a real failure, not something to green-light.
if (!seen.includes('result')) {
  console.error('E2E_FAIL: no result event — the NDJSON integration is not working.');
  process.exit(1);
}
console.log('E2E_RESULT=ok');
