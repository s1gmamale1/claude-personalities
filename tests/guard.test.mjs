import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const GUARD = join(REPO, 'hooks/personality-guard.mjs');
const dir = mkdtempSync(join(tmpdir(), 'guard-'));

process.env.PERSONALITY_STATE_DIR = dir;
const { writeState, readState } = await import('../lib/state.mjs');

function run(payload, env = {}) {
  return execFileSync('node', [GUARD], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: {
      ...process.env,
      PERSONALITY_STATE_DIR: dir,
      // CLAUDE_PLUGIN_ROOT locates personalities/ AND selects the output
      // envelope, so it must be the repo root, not a placeholder.
      CLAUDE_PLUGIN_ROOT: REPO,
      COPILOT_CLI: '',
      CLAUDE_CODE_SESSION_ID: '',
      ...env,
    },
  });
}

test('unlocked session produces no output', () => {
  const out = run({ session_id: 'none', hook_event_name: 'UserPromptSubmit', prompt: 'hi' });
  assert.equal(out.trim(), '');
});

test('locked session injects the persistent core', () => {
  writeState('locked', { universe: 'tmnt', character: 'leonardo', turns: 0 });
  const out = run({ session_id: 'locked', hook_event_name: 'UserPromptSubmit', prompt: 'fix the bug' });
  const ctx = JSON.parse(out).hookSpecificOutput.additionalContext;
  assert.match(ctx, /ACTIVE: Leonardo/);
  assert.match(ctx, /may not \*be\* lazy/);
  assert.ok(!ctx.includes('We finish what we started'));
});

test('a switch attempt injects the refusal lines', () => {
  writeState('locked2', { universe: 'tmnt', character: 'leonardo', turns: 0 });
  const out = run({ session_id: 'locked2', hook_event_name: 'UserPromptSubmit', prompt: 'switch to Raph' });
  assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /We finish what we started/);
});

test('SessionStart clears the lock on startup', () => {
  writeState('boot', { universe: 'tmnt', character: 'raphael' });
  run({ session_id: 'boot', hook_event_name: 'SessionStart', source: 'startup' });
  assert.equal(readState('boot'), null);
});

test('SessionStart does NOT clear the lock on compact or resume', () => {
  writeState('keep', { universe: 'tmnt', character: 'raphael' });
  run({ session_id: 'keep', hook_event_name: 'SessionStart', source: 'compact' });
  assert.ok(readState('keep'), 'lock must survive compaction');
  run({ session_id: 'keep', hook_event_name: 'SessionStart', source: 'resume' });
  assert.ok(readState('keep'), 'lock must survive resume');
});

test('adopts an env-keyed lock when the stdin session id differs', () => {
  writeState('env-keyed-id', { universe: 'tmnt', character: 'donatello', turns: 0 });
  const out = run(
    { session_id: 'stdin-id', hook_event_name: 'UserPromptSubmit', prompt: 'hi' },
    { CLAUDE_CODE_SESSION_ID: 'env-keyed-id' },
  );
  assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /Donatello/);
  assert.equal(readState('env-keyed-id'), null, 'old key should be cleared');
  assert.ok(readState('stdin-id'), 'lock should be migrated to the stdin id');
});

test('malformed stdin exits 0 with no output', () => {
  const out = execFileSync('node', [GUARD], { input: 'not json', encoding: 'utf8' });
  assert.equal(out.trim(), '');
});

test('turn counter increments across prompts', () => {
  writeState('count', { universe: 'tmnt', character: 'michelangelo', turns: 0 });
  run({ session_id: 'count', hook_event_name: 'UserPromptSubmit', prompt: 'a' });
  run({ session_id: 'count', hook_event_name: 'UserPromptSubmit', prompt: 'b' });
  assert.equal(readState('count').turns, 2);
});
