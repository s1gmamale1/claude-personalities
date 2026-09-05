import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadUniverses, lintCharacter, aliasesOf } from '../lib/characters.mjs';

// Cross-universe checks that apply to every shipped character, so adding a
// universe cannot silently break naming or lint guarantees.
const ROOT = fileURLToPath(new URL('../personalities/', import.meta.url));
const universes = loadUniverses(ROOT);

const EXPECTED = {
  tmnt: ['donatello', 'leonardo', 'michelangelo', 'raphael'],
  jjk: ['gojo', 'sukuna'],
  bluelock: ['barou', 'isagi', 'kaiser', 'shidou'],
  cote: ['ayanokoji'],
};

test('every expected universe ships its full roster', () => {
  for (const [id, names] of Object.entries(EXPECTED)) {
    const u = universes.get(id);
    assert.ok(u, `universe ${id} missing`);
    assert.deepEqual([...u.characters.keys()].sort(), names, id);
  }
});

test('universe.json roster agrees with the files on disk', () => {
  for (const [id, u] of universes) {
    if (u.characters.size === 0) continue;               // custom/ ships empty
    assert.deepEqual([...u.meta.roster].sort(), [...u.characters.keys()].sort(), id);
  }
});

test('every shipped character passes lint and every universe loads clean', () => {
  for (const [id, u] of universes) {
    assert.deepEqual(u.problems, [], `${id} load problems`);
    for (const [name, c] of u.characters) {
      assert.deepEqual(lintCharacter(c), [], `${id}:${name} failed lint`);
    }
  }
});

test('names and aliases are unique across ALL universes', () => {
  // A collision would make /personality <name> ambiguous for a shipped character.
  const seen = new Map();
  for (const [id, u] of universes) {
    for (const c of u.characters.values()) {
      for (const a of [c.meta.name, ...aliasesOf(c)]) {
        assert.ok(!seen.has(a), `"${a}" used by ${seen.get(a)} and ${id}:${c.meta.name}`);
        seen.set(a, `${id}:${c.meta.name}`);
      }
    }
  }
});

test('every shipped character has at least two refusal lines', () => {
  for (const [id, u] of universes) {
    for (const [name, c] of u.characters) {
      const n = c.sections.Refusals.split('\n').filter((l) => l.trim()).length;
      assert.ok(n >= 2, `${id}:${name} has ${n} refusals`);
    }
  }
});
