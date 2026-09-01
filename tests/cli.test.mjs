import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.PERSONALITY_STATE_DIR = mkdtempSync(join(tmpdir(), 'cli-'));
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const { lockOrRefuse, status } = await import('../lib/cli.mjs');

test('first invocation locks the session', () => {
  const r = lockOrRefuse({ sessionId: 'a', query: 'leo', root: ROOT });
  assert.equal(r.status, 'locked');
  assert.equal(r.character.meta.name, 'leonardo');
});

test('second invocation is refused in character', () => {
  lockOrRefuse({ sessionId: 'b', query: 'leo', root: ROOT });
  const r = lockOrRefuse({ sessionId: 'b', query: 'mikey', root: ROOT });
  assert.equal(r.status, 'refused');
  assert.match(r.message, /finish what we started|revisit|mid-mission/i);
});

test('re-invoking the SAME character is refused too, not silently re-locked', () => {
  lockOrRefuse({ sessionId: 'c', query: 'raph', root: ROOT });
  assert.equal(lockOrRefuse({ sessionId: 'c', query: 'raph', root: ROOT }).status, 'refused');
});

test('unknown name lists the roster and writes no lock', () => {
  const r = lockOrRefuse({ sessionId: 'd', query: 'shredder', root: ROOT });
  assert.equal(r.status, 'unknown');
  assert.match(r.message, /leonardo/);
  assert.equal(status('d').locked, false);
});

test('status reports character, continuity and turns', () => {
  lockOrRefuse({ sessionId: 'e', query: 'donnie', root: ROOT });
  const s = status('e');
  assert.equal(s.locked, true);
  assert.equal(s.character, 'donatello');
  assert.match(s.continuity, /2003/);
});

test('cli-run locks and reports status through the real entry point', async () => {
  const { execFileSync } = await import('node:child_process');
  const runner = join(ROOT, 'lib/cli-run.mjs');
  const env = {
    ...process.env,
    CLAUDE_PLUGIN_ROOT: ROOT,
    CLAUDE_CODE_SESSION_ID: 'cli-run-session',
  };
  const locked = JSON.parse(execFileSync('node', [runner, 'lock', 'mikey'], { encoding: 'utf8', env }));
  assert.equal(locked.status, 'locked');
  assert.equal(locked.character, 'michelangelo');
  assert.match(locked.file, /michelangelo\.md$/);

  const s = JSON.parse(execFileSync('node', [runner, 'status'], { encoding: 'utf8', env }));
  assert.equal(s.locked, true);
  assert.equal(s.character, 'michelangelo');

  const again = JSON.parse(execFileSync('node', [runner, 'lock', 'leo'], { encoding: 'utf8', env }));
  assert.equal(again.status, 'refused');
});
