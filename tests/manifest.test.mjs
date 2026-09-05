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

test('all four manifests declare the same version', () => {
  // Drift here is silent and expensive: `claude plugin update` compares versions,
  // not commits, so a stale version means merged work never reaches an install.
  const plugin = read('.claude-plugin/plugin.json').version;
  const market = read('.claude-plugin/marketplace.json').plugins[0].version;
  const pkg = read('package.json').version;
  const codex = read('.codex-plugin/plugin.json').version;
  assert.equal(plugin, market, 'plugin.json vs marketplace.json');
  assert.equal(plugin, pkg, 'plugin.json vs package.json');
  assert.equal(plugin, codex, 'plugin.json vs .codex-plugin/plugin.json');
});

test('the Codex manifest points at the same skills and hooks', () => {
  const c = read('.codex-plugin/plugin.json');
  assert.equal(c.name, 'claude-personalities');
  assert.equal(c.skills, './skills/');
  assert.equal(c.hooks, './hooks/hooks.json');
  assert.ok(c.interface?.displayName);
});

test('the Codex marketplace points at this plugin', () => {
  const m = read('.agents/plugins/marketplace.json');
  assert.equal(m.plugins[0].name, 'claude-personalities');
  assert.equal(m.plugins[0].source.url, './');
});

test('hooks.json sets no timeout — the unit differs between hosts', () => {
  // Claude Code reads `timeout` in milliseconds, Codex in seconds. A single
  // value cannot be right for both, and both defaults comfortably cover a hook
  // that finishes in ~30ms. Leaving it unset is the only portable choice.
  const h = read('hooks/hooks.json');
  for (const groups of Object.values(h.hooks)) {
    for (const g of groups) for (const hook of g.hooks) {
      assert.equal(hook.timeout, undefined, `${hook.command} sets a timeout`);
    }
  }
});

test('hooks.json uses the shared plugin-root variable both hosts set', () => {
  const h = read('hooks/hooks.json');
  for (const groups of Object.values(h.hooks)) {
    for (const g of groups) for (const hook of g.hooks) {
      assert.match(hook.command, /\$\{CLAUDE_PLUGIN_ROOT\}/);
    }
  }
});
