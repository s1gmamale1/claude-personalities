import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

test('plugin.json declares required fields', () => {
  const m = read('.claude-plugin/plugin.json');
  assert.equal(m.name, 'claude-personalities');
  assert.match(m.version, /^\d+\.\d+\.\d+$/);
  assert.ok(m.description.length > 10);
  assert.equal(m.license, 'MIT');
});

test('marketplace.json points at this plugin', () => {
  const m = read('.claude-plugin/marketplace.json');
  assert.equal(m.plugins.length, 1);
  assert.equal(m.plugins[0].name, 'claude-personalities');
  assert.equal(m.plugins[0].source, './');
});

test('package.json declares no runtime dependencies', () => {
  const p = read('package.json');
  assert.equal(p.dependencies, undefined);
  assert.equal(p.type, 'module');
});
