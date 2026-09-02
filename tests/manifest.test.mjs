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

test('all three manifests declare the same version', () => {
  // Drift here is silent and expensive: `claude plugin update` compares versions,
  // not commits, so a stale version means merged work never reaches an install.
  const plugin = read('.claude-plugin/plugin.json').version;
  const market = read('.claude-plugin/marketplace.json').plugins[0].version;
  const pkg = read('package.json').version;
  assert.equal(plugin, market, 'plugin.json vs marketplace.json');
  assert.equal(plugin, pkg, 'plugin.json vs package.json');
});
