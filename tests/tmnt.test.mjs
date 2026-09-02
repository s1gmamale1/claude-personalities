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

test('shipped universes load with zero problems', () => {
  // `problems` collects files that failed to parse. Shipped content must be clean,
  // otherwise a character silently disappears from the roster.
  for (const [id, u] of universes) {
    assert.deepEqual(u.problems, [], `${id} reported load problems`);
  }
});

test('every tmnt character has a Specialty within the cap', () => {
  for (const [name, char] of tmnt.characters) {
    const s = char.sections.Specialty;
    assert.ok(s, `${name} has no Specialty`);
    assert.ok(s.split('\n').length <= 10, `${name} Specialty too long`);
  }
});

test('specialties are session-agnostic so they can become agent briefs', () => {
  for (const [name, char] of tmnt.characters) {
    assert.doesNotMatch(char.sections.Specialty, /this session|mid-session|locked/i, name);
  }
});

test('suits lists match the specialisation spec', () => {
  const expected = {
    leonardo: ['planning', 'coordination', 'security', 'incident response', 'migrations'],
    raphael: ['QA', 'testing', 'code review', 'debugging'],
    donatello: ['architecture', 'backend', 'data modelling', 'performance'],
    michelangelo: ['frontend', 'UX', 'copy', 'explaining things'],
  };
  for (const [name, suits] of Object.entries(expected)) {
    assert.deepEqual(tmnt.characters.get(name).meta.suits, suits, name);
  }
});

test("raphael's specialty forbids reporting a partial pass as a pass", () => {
  assert.match(tmnt.characters.get('raphael').sections.Specialty, /partial pass|mostly working/i);
});
