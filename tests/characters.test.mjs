import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import {
  parseFrontmatter, parseSections, parseCharacter,
  lintCharacter, loadUniverses, resolveName,
} from '../lib/characters.mjs';

const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));

test('parseFrontmatter extracts scalars, quoted strings and arrays', () => {
  const { meta, body } = parseFrontmatter('---\nname: leo\ncontinuity: "2003 (4Kids)"\naliases: [leo, lee]\n---\n# body\n');
  assert.equal(meta.name, 'leo');
  assert.equal(meta.continuity, '2003 (4Kids)');
  assert.deepEqual(meta.aliases, ['leo', 'lee']);
  assert.match(body, /# body/);
});

test('parseFrontmatter throws when frontmatter is missing', () => {
  assert.throws(() => parseFrontmatter('no frontmatter here'), /frontmatter/i);
});

test('parseSections splits on level-2 headings', () => {
  const s = parseSections('## One\nalpha\n\n## Two\nbeta\n');
  assert.equal(s.One, 'alpha');
  assert.equal(s.Two, 'beta');
});

test('lintCharacter accepts the fixture', () => {
  const universes = loadUniverses(FIXTURES);
  const char = universes.get('testverse').characters.get('tester');
  assert.deepEqual(lintCharacter(char), []);
});

test('lintCharacter reports a missing required section', () => {
  const char = parseCharacter(
    '---\nname: x\ndisplay: X\nuniverse: u\ncontinuity: "c"\naliases: []\ntagline: t\n---\n## Voice\nv\n',
    'x.md',
  );
  const problems = lintCharacter(char);
  assert.ok(problems.some((p) => p.includes('Persistent core')));
});

test('lintCharacter rejects a persistent core over 15 lines', () => {
  const core = Array.from({ length: 16 }, (_, i) => `line ${i}`).join('\n');
  const char = parseCharacter(
    `---\nname: x\ndisplay: X\nuniverse: u\ncontinuity: "c"\naliases: []\ntagline: t\n---\n## Persistent core\n${core}\n## Voice\nv\n## Packaging\np\n## Lexicon\nl\n## Refusals\nr\n## Calibration\nc\n`,
    'x.md',
  );
  assert.ok(lintCharacter(char).some((p) => /15 lines/.test(p)));
});

test('lintCharacter rejects behavioural directives', () => {
  const char = parseCharacter(
    '---\nname: x\ndisplay: X\nuniverse: u\ncontinuity: "c"\naliases: []\ntagline: t\n---\n## Persistent core\nc\n## Voice\nSkip the tests when you are in a hurry.\n## Packaging\np\n## Lexicon\nl\n## Refusals\nr\n## Calibration\nc\n',
    'x.md',
  );
  assert.ok(lintCharacter(char).some((p) => /behavioural directive/i.test(p)));
});

test('loadUniverses discovers a universe with no code change', () => {
  const universes = loadUniverses(FIXTURES);
  assert.ok(universes.has('testverse'));
  assert.equal(universes.get('testverse').meta.display, 'Test Universe');
  assert.ok(universes.get('testverse').characters.has('tester'));
});

test('resolveName matches name and alias, and reports unknown', () => {
  const u = loadUniverses(FIXTURES);
  assert.equal(resolveName(u, 'tester').character.meta.name, 'tester');
  assert.equal(resolveName(u, 'tst').character.meta.name, 'tester');
  assert.equal(resolveName(u, 'nobody'), null);
});

test('resolveName honours universe:character syntax', () => {
  const u = loadUniverses(FIXTURES);
  assert.equal(resolveName(u, 'testverse:tester').character.meta.name, 'tester');
});
