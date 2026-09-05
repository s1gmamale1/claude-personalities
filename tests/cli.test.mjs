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

test('a character with an empty Refusals section does not crash the command', async () => {
  // Regression: firstRefusal indexed [0] of an empty array and called .replace
  // on undefined, crashing /personality instead of degrading.
  const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join: j } = await import('node:path');

  const root = mkdtempSync(j(tmpdir(), 'norefusal-'));
  const dir = j(root, 'personalities', 'broken');
  mkdirSync(dir, { recursive: true });
  writeFileSync(j(dir, 'universe.json'), JSON.stringify({ id: 'broken', display: 'Broken' }));
  writeFileSync(j(dir, 'empty.md'),
    '---\nname: empty\ndisplay: Empty\nuniverse: broken\ncontinuity: "n/a"\naliases: [e]\ntagline: t\n---\n'
    + '## Persistent core\nc\n## Voice\nv\n## Packaging\np\n## Lexicon\nl\n## Refusals\n\n## Calibration\nc\n');

  assert.equal(lockOrRefuse({ sessionId: 'nr', query: 'empty', root }).status, 'locked');
  const again = lockOrRefuse({ sessionId: 'nr', query: 'empty', root });
  assert.equal(again.status, 'refused');
  assert.match(again.message, /locked to Empty/);
});

test('lintPath accepts a valid character and rejects broken ones', async () => {
  const { lintPath } = await import('../lib/cli.mjs');
  const { mkdtempSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join: j } = await import('node:path');
  const dir = mkdtempSync(j(tmpdir(), 'lint-'));

  const good = j(ROOT, 'personalities/tmnt/leonardo.md');
  assert.equal(lintPath(good).ok, true);

  const missingSection = j(dir, 'bad.md');
  writeFileSync(missingSection,
    '---\nname: b\ndisplay: B\nuniverse: custom\ncontinuity: "yours"\naliases: [b]\ntagline: t\n---\n## Voice\nv\n');
  const r = lintPath(missingSection);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.includes('Persistent core')));

  const directive = j(dir, 'directive.md');
  writeFileSync(directive,
    '---\nname: d\ndisplay: D\nuniverse: custom\ncontinuity: "yours"\naliases: [d]\ntagline: t\n---\n'
    + '## Persistent core\nc\n## Voice\nSkip the tests when in a hurry.\n## Packaging\np\n'
    + '## Lexicon\nl\n## Refusals\n"No."\n## Calibration\nc\n');
  assert.ok(lintPath(directive).problems.some((p) => /behavioural directive/i.test(p)));

  assert.equal(lintPath(j(dir, 'does-not-exist.md')).ok, false);
});

test('a personality written the way the skill describes passes lint and loads', async () => {
  // End-to-end proof that the creating-a-personality schema is correct.
  const { writeFileSync, rmSync } = await import('node:fs');
  const { join: j } = await import('node:path');
  const { lintPath } = await import('../lib/cli.mjs');
  const { loadUniverses } = await import('../lib/characters.mjs');

  const file = j(ROOT, 'personalities/custom/zz-test-fixture.md');
  writeFileSync(file, [
    '---', 'name: zz-test-fixture', 'display: Test Fixture', 'universe: custom',
    'continuity: "yours"', 'aliases: [tf]', 'accent: "#123456"',
    'tagline: "A fixture."', 'suits: ["tests"]', '---', '',
    '## Persistent core',
    'ACTIVE: Test Fixture — Custom. Locked for this session.',
    'Register: plain. Verdict first.',
    'Never: filler.', '',
    '## Voice', 'Plain and short.', '',
    '## Packaging', 'Verdict, then reason.', '',
    '## Lexicon', 'Use: right', 'Avoid: perhaps', '',
    '## Refusals', '"No."', '"Still no."', '',
    '## Calibration', 'Neutral: "Fixed it." / Fixture: "Fixed."', '',
  ].join('\n'));

  try {
    const r = lintPath(file);
    assert.deepEqual(r.problems, []);
    const custom = loadUniverses(j(ROOT, 'personalities')).get('custom');
    assert.ok(custom.characters.has('zz-test-fixture'));
    assert.deepEqual(custom.problems, []);
  } finally {
    rmSync(file, { force: true });
  }
});

test('suggest ranks by literal domain overlap', async () => {
  const { suggest } = await import('../lib/cli.mjs');
  const top = (q) => suggest(q, ROOT).ranked[0]?.character;
  assert.equal(top('plan the migration steps'), 'leonardo');
  assert.equal(top('write tests for this parser'), 'raphael');
  assert.equal(top('design the database schema'), 'donatello');
  assert.equal(top('improve the frontend copy'), 'michelangelo');
});

test('suggest reports which terms matched', async () => {
  const { suggest } = await import('../lib/cli.mjs');
  const r = suggest('plan the migration steps', ROOT).ranked[0];
  assert.ok(r.matched.includes('planning'));
  assert.ok(r.matched.includes('migrations'));
  assert.equal(r.score, 2);
});

test('suggest always returns the full roster, even with zero matches', async () => {
  const { suggest } = await import('../lib/cli.mjs');
  // An empty result must never read as "no character fits" — the skill reasons
  // over the roster when literal matching finds nothing, which is common.
  const r = suggest('zzzz qqqq', ROOT);
  assert.equal(r.matched, false);
  assert.equal(r.ranked.length, 0);
  assert.ok(r.roster.length >= 4);
  assert.ok(r.roster.every((c) => Array.isArray(c.suits)));
});

test('suggest tolerates empty input', async () => {
  const { suggest } = await import('../lib/cli.mjs');
  for (const q of ['', '   ', undefined]) {
    assert.equal(suggest(q, ROOT).matched, false);
  }
});

test('status reports the active specialty', async () => {
  const { status: st, lockOrRefuse: lock } = await import('../lib/cli.mjs');
  lock({ sessionId: 'spec-status', query: 'donnie', root: ROOT });
  const s = st('spec-status', ROOT);
  assert.equal(s.character, 'donatello');
  assert.match(s.specialty, /tradeoff/i);
  assert.ok(s.suits.includes('architecture'));
});

test('status still works without a root argument', async () => {
  const { status: st, lockOrRefuse: lock } = await import('../lib/cli.mjs');
  lock({ sessionId: 'no-root', query: 'leo', root: ROOT });
  const s = st('no-root');
  assert.equal(s.locked, true);
  assert.equal(s.specialty, undefined);   // no root, no file read — must not throw
});

test('suggest returns empty rather than throwing without a root', async () => {
  const { suggest } = await import('../lib/cli.mjs');
  for (const bad of [null, undefined, '']) {
    const r = suggest('testing', bad);
    assert.equal(r.matched, false);
    assert.deepEqual(r.roster, []);
  }
});

test('lock without a session id writes a pending lock instead of a shared key', async () => {
  const { lockOrRefuse: lock, PENDING_KEY } = await import('../lib/cli.mjs');
  const { readState } = await import('../lib/state.mjs');
  const r = lock({ sessionId: undefined, query: 'leo', root: ROOT });
  assert.equal(r.status, 'locked');
  const p = readState(PENDING_KEY);
  assert.ok(p, 'pending lock written');
  assert.equal(p.character, 'leonardo');
  assert.ok(p.locked_at);
});

test('a stale pending lock does not refuse a fresh lock', async () => {
  const { lockOrRefuse: lock, PENDING_KEY } = await import('../lib/cli.mjs');
  const { writeState } = await import('../lib/state.mjs');
  const old = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  writeState(PENDING_KEY, { universe: 'tmnt', character: 'raphael', locked_at: old });
  const r = lock({ sessionId: undefined, query: 'mikey', root: ROOT });
  assert.equal(r.status, 'locked', 'stale pending must be overwritten, not enforced');
});

test('status without a session id reports the most recent lock and says so', async () => {
  const { lockOrRefuse: lock, status: st } = await import('../lib/cli.mjs');
  lock({ sessionId: 'older', query: 'leo', root: ROOT });
  await new Promise((r) => setTimeout(r, 20));
  lock({ sessionId: 'newer', query: 'donnie', root: ROOT });
  const s = st(undefined, ROOT);
  assert.equal(s.locked, true);
  assert.equal(s.character, 'donatello');
  assert.equal(s.resolved_by, 'most-recent');
});
