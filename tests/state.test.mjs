import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, utimesSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'personality-state-'));
process.env.PERSONALITY_STATE_DIR = dir;

const { readState, writeState, clearState, pruneOlderThan, stateDir } = await import('../lib/state.mjs');

test('stateDir honours the env override', () => {
  assert.equal(stateDir(), dir);
});

test('read returns null when no lock exists', () => {
  assert.equal(readState('missing-session'), null);
});

test('write then read round-trips', () => {
  writeState('s1', { universe: 'tmnt', character: 'leonardo', turns: 0 });
  const s = readState('s1');
  assert.equal(s.character, 'leonardo');
  assert.equal(s.universe, 'tmnt');
});

test('clear removes the lock', () => {
  writeState('s2', { universe: 'tmnt', character: 'raphael' });
  clearState('s2');
  assert.equal(readState('s2'), null);
});

test('corrupt state is treated as no lock and deleted', () => {
  writeFileSync(join(dir, 's3.json'), '{ not json');
  assert.equal(readState('s3'), null);
  assert.equal(existsSync(join(dir, 's3.json')), false);
});

test('session ids are sanitised into safe filenames', () => {
  writeState('../../etc/passwd', { character: 'leonardo' });
  const files = readdirSync(dir);
  assert.ok(files.every((f) => !f.includes('/') && !f.includes('..')));
});

test('prune removes files older than the cutoff and keeps fresh ones', () => {
  writeState('old', { character: 'leonardo' });
  writeState('fresh', { character: 'raphael' });
  const ancient = Date.now() / 1000 - 60 * 60 * 24 * 40;
  utimesSync(join(dir, 'old.json'), ancient, ancient);
  const removed = pruneOlderThan(30);
  assert.ok(removed >= 1);
  assert.equal(readState('old'), null);
  assert.ok(readState('fresh'));
});

test('write returns false rather than throwing when the dir is unwritable', () => {
  // /dev/null is not a directory, so mkdir under it fails with ENOTDIR on
  // both macOS and Linux. Portable way to force the failure path.
  process.env.PERSONALITY_STATE_DIR = '/dev/null/nope';
  assert.equal(writeState('x', { character: 'leonardo' }), false);
  process.env.PERSONALITY_STATE_DIR = dir;
});

test('re-writing a state object under a new id does not keep the old session_id', () => {
  // Regression: writeState spread `data` after session_id, so a state object
  // read from another key silently carried its old session_id forward.
  writeState('first-id', { universe: 'tmnt', character: 'leonardo' });
  const carried = readState('first-id');
  writeState('second-id', carried);
  assert.equal(readState('second-id').session_id, 'second-id');
});
