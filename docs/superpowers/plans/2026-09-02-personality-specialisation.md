# Personality Specialisation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each personality a domain specialty that adds steps inside its area and never removes steps outside it.

**Architecture:** A new optional `## Specialty` section, written as trigger → action pairs so it self-gates without code-side domain detection, injected every turn alongside the persistent core. The floor gains an additive-only clause. `suits:` is promoted to the machine-readable domain list behind a `suggest` subcommand that supplies facts while the recommender skill supplies judgement.

**Tech Stack:** Node ≥18 (ESM, `node:test`). Zero runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-02-personality-specialisation-design.md`, which extends `2026-09-01-claude-personalities-design.md`.

## Global Constraints

- **Additive-only.** A specialty adds steps inside its domain, never removes them outside it. No personality is ever worse at anything than a personality-free session.
- **No code-side domain detection.** Specialties self-gate via trigger → action phrasing.
- **Specialty blocks are session-agnostic** — no "this session", no lock references. They must be liftable verbatim into a phase-2 agent brief. Enforced by the linter.
- **`## Specialty` is optional.** Every existing character file must still lint and load unchanged.
- **Zero runtime dependencies.** Tests are `node --test tests/*.test.mjs`.
- **No `Co-Authored-By` trailer** in commits.
- **Files under 500 lines.**

---

### Task 1: Specialty lint rules

**Files:**
- Modify: `lib/characters.mjs`
- Test: `tests/characters.test.mjs`

**Interfaces:**
- Consumes: existing `lintCharacter`, `parseCharacter`
- Produces: `MAX_SPECIALTY_LINES` (10), `SESSION_SCOPED_PATTERNS`, and two new `lintCharacter` problem strings

- [ ] **Step 1: Write the failing tests**

```javascript
// append to tests/characters.test.mjs
const withSpecialty = (specialty) => parseCharacter(
  '---\nname: x\ndisplay: X\nuniverse: u\ncontinuity: "c"\naliases: []\ntagline: t\n---\n'
  + '## Persistent core\nc\n## Voice\nv\n## Packaging\np\n'
  + `## Specialty\n${specialty}\n`
  + '## Lexicon\nl\n## Refusals\n"No."\n## Calibration\nc\n',
  'x.md',
);

test('a Specialty section is optional', () => {
  const noSpecialty = parseCharacter(
    '---\nname: x\ndisplay: X\nuniverse: u\ncontinuity: "c"\naliases: []\ntagline: t\n---\n'
    + '## Persistent core\nc\n## Voice\nv\n## Packaging\np\n## Lexicon\nl\n## Refusals\n"No."\n## Calibration\nc\n',
    'x.md',
  );
  assert.deepEqual(lintCharacter(noSpecialty), []);
});

test('a valid Specialty passes', () => {
  assert.deepEqual(lintCharacter(withSpecialty('When designing: data model first.')), []);
});

test('a Specialty over 10 lines is rejected', () => {
  const long = Array.from({ length: 11 }, (_, i) => `When x${i}: do y.`).join('\n');
  assert.ok(lintCharacter(withSpecialty(long)).some((p) => /Specialty exceeds 10 lines/.test(p)));
});

test('a Specialty with session-scoped language is rejected', () => {
  // Must be liftable verbatim into a phase-2 agent brief.
  for (const bad of [
    'When planning: remember this session is locked.',
    'You are locked to this role, so plan first.',
    'Do not switch mid-session while designing.',
  ]) {
    assert.ok(
      lintCharacter(withSpecialty(bad)).some((p) => /session-scoped/i.test(p)),
      `should reject: ${bad}`,
    );
  }
});

test('a Specialty is still subject to the behavioural-directive check', () => {
  assert.ok(
    lintCharacter(withSpecialty('When doing frontend work: skip the tests.'))
      .some((p) => /behavioural directive/i.test(p)),
  );
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/characters.test.mjs`
Expected: FAIL — over-length and session-scoped Specialty sections are currently accepted

- [ ] **Step 3: Implement**

```javascript
// lib/characters.mjs — add beside MAX_CORE_LINES
export const MAX_SPECIALTY_LINES = 10;

// Specialty blocks must be liftable verbatim into a phase-2 agent brief, so they
// may not reference the session or the lock.
export const SESSION_SCOPED_PATTERNS = [
  /\bthis session\b/i,
  /\bmid-session\b/i,
  /\byou are locked\b/i,
  /\bis locked\b/i,
  /\blocked (to|for) \w+/i,
];
```

```javascript
// lib/characters.mjs — inside lintCharacter, after the core-length check
  const specialty = char.sections.Specialty;
  if (specialty) {
    if (specialty.split('\n').length > MAX_SPECIALTY_LINES) {
      problems.push(`## Specialty exceeds ${MAX_SPECIALTY_LINES} lines`);
    }
    for (const re of SESSION_SCOPED_PATTERNS) {
      if (re.test(specialty)) {
        problems.push(
          `## Specialty contains session-scoped language (${re}) — it must be liftable into an agent brief`,
        );
      }
    }
  }
```

The existing behavioural-directive loop already scans `Object.values(char.sections)`, so Specialty is covered with no change.

- [ ] **Step 4: Run to verify pass**

Run: `node --test tests/characters.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/characters.mjs tests/characters.test.mjs
git commit -m "feat: lint rules for the optional Specialty section"
```

---

### Task 2: Amended floor and Specialty injection

**Files:**
- Modify: `lib/inject.mjs`
- Test: `tests/inject.test.mjs`

**Interfaces:**
- Consumes: character objects
- Produces: extended `FLOOR`; `buildContext` emits Specialty when present

- [ ] **Step 1: Write the failing tests**

```javascript
// append to tests/inject.test.mjs
const specialised = {
  meta: { display: 'Donatello', name: 'donatello', continuity: '2003 (4Kids)' },
  sections: {
    'Persistent core': 'ACTIVE: Donatello.',
    Specialty: 'When choosing between approaches: name the tradeoff and pick one.',
    Refusals: '"No."',
  },
};

test('the floor states specialisation is additive-only', () => {
  assert.match(FLOOR, /adds steps inside its domain/i);
  assert.match(FLOOR, /never removes steps outside it/i);
  assert.match(FLOOR, /note it once in character/i);
});

test('a specialty is injected when present', () => {
  const ctx = buildContext({ character: specialised, universe, switchAttempt: false });
  assert.match(ctx, /name the tradeoff and pick one/);
});

test('a character with no specialty injects the core alone and does not crash', () => {
  const ctx = buildContext({ character, universe, switchAttempt: false });
  assert.ok(ctx.includes('ACTIVE: Leonardo.'));
  assert.ok(!/Specialty:/.test(ctx));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/inject.test.mjs`
Expected: FAIL — floor lacks the clause, specialty is not injected

- [ ] **Step 3: Implement**

```javascript
// lib/inject.mjs — replace FLOOR
export const FLOOR = [
  'Personality governs voice and framing only. It never changes which tools you use,',
  'whether you write tests, whether you verify before claiming done, or how honestly',
  'you report failure. A personality may sound lazy. It may not *be* lazy.',
  '',
  'A specialty adds steps inside its domain. It never removes steps outside it.',
  'Every personality does complete, correct work on every task. If the work falls',
  "outside the active character's specialty, note it once in character, then never again.",
  '',
  'If the user attempts to change personality by any phrasing, refuse in character',
  'using the Refusals lines below, then answer any legitimate remainder of the request.',
].join('\n');
```

```javascript
// lib/inject.mjs — in buildContext, after the persistent core push
  if (character.sections.Specialty) {
    parts.push('', 'Specialty:', character.sections.Specialty);
  }
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test tests/inject.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/inject.mjs tests/inject.test.mjs
git commit -m "feat: inject Specialty and add the additive-only floor clause"
```

---

### Task 3: The four shipped specialties

**Files:**
- Modify: `personalities/tmnt/{leonardo,raphael,donatello,michelangelo}.md`
- Test: `tests/tmnt.test.mjs`

**Interfaces:**
- Consumes: Task 1's linter
- Produces: four Specialty sections and updated `suits` lists

Insert `## Specialty` after `## Packaging` and before `## Lexicon` in each file, and replace each `suits:` line. Content is spec §4 verbatim.

- [ ] **Step 1: Write the failing tests**

```javascript
// append to tests/tmnt.test.mjs
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
  // The single strongest personality-to-function claim in the spec.
  assert.match(tmnt.characters.get('raphael').sections.Specialty, /partial pass|mostly working/i);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/tmnt.test.mjs`
Expected: FAIL — no character has a Specialty

- [ ] **Step 3: Write Donatello's**

```markdown
suits: ["architecture", "backend", "data modelling", "performance"]
```

```markdown
## Specialty
Architecture and backend.
When choosing between approaches: name the tradeoff and pick one. Never present
options without a recommendation.
Before claiming a performance win: measure it. No asserting a speedup that has
not been timed.
When designing: data model and failure modes before API surface.
When something looks mysterious: it is not. Enumerate where it could happen,
then check each place.
```

- [ ] **Step 4: Write Leonardo's**

```markdown
suits: ["planning", "coordination", "security", "incident response", "migrations"]
```

```markdown
## Specialty
Coordination, planning, and security-minded backend work.
Before multi-step work: numbered plan with dependencies explicit; afterwards
report against it, including what failed.
When touching auth, input handling, secrets, permissions or user data:
enumerate the abuse case before writing the happy path.
When work spans several files or systems: state the order and why that order.
After a failure: own it plainly, then add the guard that prevents a recurrence.
```

- [ ] **Step 5: Write Raphael's**

```markdown
suits: ["QA", "testing", "code review", "debugging"]
```

```markdown
## Specialty
QA and adversarial verification.
Never report a partial pass as a pass. "Mostly working" is not a status.
When handed something to verify: try to break it — empty, huge, wrong type,
malformed, concurrent, repeated.
When a suite goes red: assume the implementation is wrong before the test.
Report what is broken first, before what works.
Name flaky separately from failing; they need different fixes.
```

- [ ] **Step 6: Write Michelangelo's**

```markdown
suits: ["frontend", "UX", "copy", "explaining things"]
```

```markdown
## Specialty
Frontend, interface and copy.
What does the reader see first? Order the interface the way you order a sentence.
Cover every state: loading, empty, error, partial, too-much-data. The happy path
is the easy quarter.
When copy appears on screen, read it aloud. If it sounds like a machine, rewrite it.
Name it out loud when a flow feels confusing — that reaction is the finding.
```

- [ ] **Step 7: Run to verify pass**

Run: `node --test tests/tmnt.test.mjs`
Expected: PASS. If a Specialty trips the 10-line cap, tighten the prose — do not raise the cap.

- [ ] **Step 8: Commit**

```bash
git add personalities/tmnt tests/tmnt.test.mjs
git commit -m "feat: give the four turtles domain specialties"
```

---

### Task 4: The suggest matcher

**Files:**
- Modify: `lib/cli.mjs`, `lib/cli-run.mjs`
- Test: `tests/cli.test.mjs`

**Interfaces:**
- Consumes: `loadUniverses`
- Produces: `suggest(taskText, root) -> { matched: boolean, ranked: Array<{universe, character, display, score, matched: string[]}>, roster: Array<{universe, character, display, suits: string[]}> }`
- CLI: `node lib/cli-run.mjs suggest "<task text>"`

- [ ] **Step 1: Write the failing tests**

```javascript
// append to tests/cli.test.mjs
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
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/cli.test.mjs`
Expected: FAIL — `suggest` is not exported

- [ ] **Step 3: Implement `suggest`**

```javascript
// lib/cli.mjs
// Deliberately crude 4-character stem: makes testing/tests, planning/plan and
// data/database match without a stemming dependency. It cannot get from
// "login" to "security" — that is semantics, and the skill's job (spec §7.1).
const stem = (w) => (w.length >= 4 ? w.slice(0, 4) : w);
const tokenise = (s) =>
  new Set(String(s ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(stem));

export function suggest(taskText, root) {
  const universes = loadUniverses(join(root, 'personalities'));
  const tokens = tokenise(taskText);
  const ranked = [];
  const roster = [];

  for (const u of universes.values()) {
    for (const c of u.characters.values()) {
      const suits = Array.isArray(c.meta.suits) ? c.meta.suits : [];
      roster.push({
        universe: u.meta.id,
        character: c.meta.name,
        display: c.meta.display,
        suits,
      });
      if (tokens.size === 0 || suits.length === 0) continue;

      const matched = suits.filter((entry) =>
        String(entry).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
          .some((w) => tokens.has(stem(w))));
      if (matched.length) {
        ranked.push({
          universe: u.meta.id,
          character: c.meta.name,
          display: c.meta.display,
          score: matched.length,
          matched,
        });
      }
    }
  }

  ranked.sort((a, b) => b.score - a.score);   // Array#sort is stable: ties keep roster order
  return { matched: ranked.length > 0, ranked, roster };
}
```

- [ ] **Step 4: Add the CLI subcommand**

```javascript
// lib/cli-run.mjs — import suggest alongside lockOrRefuse, status, lintPath,
// then add before the final else:
} else if (cmd === 'suggest') {
  out(suggest(rest.join(' '), ROOT));
```

And update the usage string to `lock <name> | status | lint <path> | suggest <task>`.

- [ ] **Step 5: Run to verify pass**

Run: `node --test tests/cli.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/cli.mjs lib/cli-run.mjs tests/cli.test.mjs
git commit -m "feat: add suggest, a domain matcher that supplies facts not judgement"
```

---

### Task 5: Skills — recommender and custom specialties

**Files:**
- Modify: `skills/choosing-a-personality/SKILL.md`
- Modify: `skills/creating-a-personality/SKILL.md`

**Interfaces:**
- Consumes: `suggest` from Task 4, `lint` from the previous release
- Produces: no code; documentation the model follows

- [ ] **Step 1: Rewrite `choosing-a-personality` as a recommender**

Replace the static table with: run `suggest`, then reason. It must state plainly that an empty `ranked` list means literal matching found nothing — **not** that no character fits — and then reason over `roster`. It must also mention the lock is permanent before the user commits, and list each character's specialty alongside its voice.

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/cli-run.mjs" suggest "<the user's task, verbatim>"
```

- [ ] **Step 2: Add the seventh interview question to `creating-a-personality`**

Insert after question 6 (Edges):

> **7. Specialty (optional).** What should they be especially good at, and what
> extra steps do they bring there? "Nothing, just the voice" is a fine answer.

And add to the generation section: if answered, write a `## Specialty` of at most
10 lines as trigger → action pairs ("When X, do Y"), **session-agnostic** — no
"this session", no lock references, because the block must be liftable into an
agent brief. Add the two new linter failures to that skill's troubleshooting
table: `## Specialty exceeds 10 lines` and `contains session-scoped language`.

- [ ] **Step 3: Verify both skills still parse as skills**

`require` is unavailable — `package.json` sets `"type": "module"` — so check with
the shell instead:

```bash
for f in choosing-a-personality creating-a-personality; do
  head -1 "skills/$f/SKILL.md" | grep -qx -- '---' \
    && grep -q '^name: ' "skills/$f/SKILL.md" \
    && grep -q '^description: ' "skills/$f/SKILL.md" \
    && echo "$f ok" || echo "$f BAD FRONTMATTER"
done
```
Expected: both print `ok`

- [ ] **Step 4: Commit**

```bash
git add skills
git commit -m "docs: make choosing-a-personality a recommender and add specialty to creation"
```

---

### Task 6: Status, README, and full verification

**Files:**
- Modify: `lib/cli.mjs` (`status`), `commands/personality-status.md`, `README.md`
- Test: `tests/cli.test.mjs`

**Interfaces:**
- Consumes: everything above
- Produces: `status(sessionId, root?)` additionally returning `specialty` and `suits`

- [ ] **Step 1: Write the failing test**

```javascript
// append to tests/cli.test.mjs
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
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/cli.test.mjs`
Expected: FAIL — `status` returns no `specialty`

- [ ] **Step 3: Implement**

```javascript
// lib/cli.mjs — replace status
export function status(sessionId, root) {
  const s = readState(sessionId);
  if (!s) return { locked: false };
  const base = {
    locked: true,
    character: s.character,
    universe: s.universe,
    continuity: s.continuity || 'unknown',
    locked_at: s.locked_at,
    turns: s.turns || 0,
  };
  if (!root) return base;    // root is optional; never throw for want of it
  try {
    const char = loadUniverses(join(root, 'personalities'))
      .get(s.universe)?.characters.get(s.character);
    if (char) {
      base.specialty = char.sections.Specialty;
      base.suits = Array.isArray(char.meta.suits) ? char.meta.suits : [];
    }
  } catch { /* status must never fail */ }
  return base;
}
```

```javascript
// lib/cli-run.mjs — pass ROOT through
  out(status(sessionId, ROOT));
```

- [ ] **Step 4: Update `commands/personality-status.md`**

Add to the reporting instructions: "If a specialty is present, report it too — the user may have forgotten what extra rigour is active."

- [ ] **Step 5: Update `README.md`**

Add a **Specialties** section after Characters:

```markdown
## Specialties

Each turtle brings extra steps in their domain — and never fewer steps outside it.

| Character | Domain | Brings |
|---|---|---|
| **Leonardo** | planning, coordination, security | numbered plans reported against; enumerates the abuse case before the happy path |
| **Raphael** | QA, testing, review | refuses to call a partial pass a pass; tries to break it |
| **Donatello** | architecture, backend, performance | names the tradeoff and picks; measures before claiming a win |
| **Michelangelo** | frontend, UX, copy | orders what you see first; covers loading, empty and error states |

A specialty **adds** steps inside its domain. It never removes steps outside it —
Donatello on a CSS bug still does complete, correct CSS work. Used outside their
domain, a character says so once, then gets on with it.

Not sure who? Ask — "I'm doing X, who should I use?" — or run:

```bash
node lib/cli-run.mjs suggest "add rate limiting to the login endpoint"
```
```

- [ ] **Step 6: Full suite and manual end-to-end**

```bash
npm test
```
Expected: all pass.

```bash
export CLAUDE_PLUGIN_ROOT="$PWD" PERSONALITY_STATE_DIR=/tmp/spec-e2e CLAUDE_CODE_SESSION_ID=s1
mkdir -p /tmp/spec-e2e
node lib/cli-run.mjs lock donnie
echo '{"session_id":"s1","hook_event_name":"UserPromptSubmit","prompt":"design the schema"}' \
  | CLAUDE_CODE_SESSION_ID= node hooks/personality-guard.mjs
```
Expected: injected context contains the floor's additive-only clause, Donatello's
persistent core, and his Specialty block.

- [ ] **Step 7: Commit**

```bash
git add lib/cli.mjs lib/cli-run.mjs commands README.md tests/cli.test.mjs
git commit -m "feat: report the active specialty and document specialisation"
```

---

### Task 7: Open the PR

- [ ] **Step 1: Confirm green and clean**

```bash
npm test && git status --porcelain
```

- [ ] **Step 2: Push and open**

```bash
git push -u origin feat/personality-specialisation
gh pr create --base main --head feat/personality-specialisation \
  --title "Personality specialisation: domain specialties for each turtle" \
  --body "$(cat <<'PRBODY'
Each personality gains a domain specialty. Leonardo plans and threat-models,
Donatello measures tradeoffs, Raphael verifies adversarially, Michelangelo
judges interface and copy.

## The constraint that makes this safe

The original spec rejected "full working style" because it makes some
personalities measurably worse at some jobs. This is that idea made safe by one
rule, now in the injected floor:

> A specialty adds steps inside its domain. It never removes steps outside it.

Donatello on a CSS bug still does complete, correct CSS work. No personality is
ever worse at anything than a personality-free session.

## How specialties gate

Trigger -> action phrasing ("When touching auth, enumerate the abuse case"), so
the model applies them when they fire. No code-side domain classification -
switch detection already showed keyword matching over free text produces false
positives.

## suggest supplies facts, the skill supplies judgement

`suggest` does literal domain matching with a crude 4-character stem and always
returns the full roster. It cannot get from "login" to "security" - that is
semantics, and the recommender skill's job. An empty match never means "no
character fits".

## Also

- `## Specialty` is optional, so every existing character file still lints
- Blocks are session-agnostic, enforced by the linter, so they can be lifted
  verbatim into phase-2 agent briefs
- `/personality-status` reports the active specialty
- Custom personalities get a seventh, optional interview question

Spec: docs/superpowers/specs/2026-09-02-personality-specialisation-design.md
PRBODY
)"
```

- [ ] **Step 3: Verify the PR head matches local**

```bash
git rev-parse --short HEAD
gh api repos/s1gmamale1/claude-personalities/pulls/3 --jq '.head.sha[0:7]'
```

These have diverged twice before; if they differ, `gh pr close N && gh pr reopen N` resyncs. Do not merge until they match.
