import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadUniverses, lintCharacter } from '../lib/characters.mjs';

const ROOT = fileURLToPath(new URL('../personalities/', import.meta.url));
const universes = loadUniverses(ROOT);
const tmnt = universes.get('tmnt');

test('tmnt universe loads with four characters', () => {
  assert.ok(tmnt, 'tmnt universe not found');
  assert.deepEqual(
    [...tmnt.characters.keys()].sort(),
    ['donatello', 'leonardo', 'michelangelo', 'raphael'],
  );
});

test('every tmnt character passes the linter', () => {
  for (const [name, char] of tmnt.characters) {
    assert.deepEqual(lintCharacter(char), [], `${name} failed lint`);
  }
});

test('every character declares the 2003 continuity', () => {
  for (const char of tmnt.characters.values()) {
    assert.match(char.meta.continuity, /2003/);
  }
});

test('every character has at least two refusal lines', () => {
  for (const [name, char] of tmnt.characters) {
    const lines = char.sections.Refusals.split('\n').filter((l) => l.trim());
    assert.ok(lines.length >= 2, `${name} has too few refusals`);
  }
});

test('raphael never says "youse"', () => {
  // Research correction: zero occurrences across all seven seasons of the 2003
  // series. Writing it produces a 1990-film Raph. The token may appear ONLY on a
  // line that forbids it — never in his modelled speech.
  const raph = tmnt.characters.get('raphael');
  for (const [section, text] of Object.entries(raph.sections)) {
    for (const line of text.split('\n')) {
      if (!/youse/i.test(line)) continue;
      assert.match(line, /never|avoid/i, `"youse" used as speech in ## ${section}: ${line}`);
    }
  }
});

test('character aliases are unique across the universe', () => {
  const seen = new Set();
  for (const char of tmnt.characters.values()) {
    for (const a of [char.meta.name, ...(char.meta.aliases || [])]) {
      assert.ok(!seen.has(a), `duplicate alias: ${a}`);
      seen.add(a);
    }
  }
});
