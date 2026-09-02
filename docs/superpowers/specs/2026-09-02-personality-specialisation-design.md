# Personality Specialisation — Design Spec

**Date:** 2026-09-02
**Status:** Approved for planning
**Extends:** `2026-09-01-claude-personalities-design.md` — read that first; this
document only records what changes.
**Phase:** 1 of 2. Phase 2 (dispatchable turtle agents) is out of scope here but
constrained by §9.

---

## 1. Overview

Each personality gains a **specialty**: a short set of domain-specific extra
steps it brings to work in its area. Leonardo brings ordered planning and threat
modelling, Donatello brings measured tradeoffs, Raphael brings adversarial
verification, Michelangelo brings interface and copy judgement.

The point is to make personality *useful* rather than only decorative, without
reintroducing the failure mode the original spec rejected.

### 1.1 The conflict this resolves

The original spec §1.3 rejected "full working style" because it makes some
personalities measurably worse at some jobs. Specialisation looks like exactly
that rejected option. It is not, because of one constraint:

> **Specialisation is additive-only.** A specialty adds steps inside its domain.
> It never removes steps outside it.

Donatello on a CSS bug does complete, correct CSS work — he simply does not run
an architecture pass on it. Michelangelo on a migration is careful; he just is
not running an information-hierarchy pass. **No personality is ever worse at
anything than a personality-free session would be.** The original rule was about
not degrading, and it survives intact.

### 1.2 Non-goals

- **Domain detection in code.** Specialties self-gate (§5). The hook does not
  classify the task. Switch detection already taught us that keyword
  classification of free text produces false positives, and a misfiring
  specialty is a worse outcome than none.
- **Different depth or turn budgets per character.** Still rejected. A specialty
  changes *which checks happen*, never *how much effort is spent*.
- **Phase 2 agents.** Constrained here (§9), built later.

---

## 2. Amended floor

`lib/inject.mjs` `FLOOR` gains one paragraph:

> A specialty adds steps inside its domain. It never removes steps outside it.
> Every personality does complete, correct work on every task. If the work falls
> outside the active character's specialty, note it once in character, then
> never again.

This is the structural guarantee. It sits above the persona and cannot be
overridden by a character file, exactly like the existing floor text.

---

## 3. Schema changes

### 3.1 `## Specialty` — new, optional

A new section, **optional** so every character file that exists today still
lints and a custom personality may be pure voice.

- **Cap: 10 physical lines.** Enforced by the linter, same mechanism as the
  15-line core cap. That is roughly 4–6 rules once prose wraps at 80 columns —
  the cap counts lines, not rules, because that is what the linter can measure.
- **Written as trigger → action pairs**: "When X, do Y." This is what lets the
  model self-gate without code (§5).
- **Session-agnostic** (§9): no "this session", no "you are locked". Enforced.
- Subject to the existing behavioural-directive check — a specialty may not say
  "skip the tests for frontend work".

### 3.2 `suits:` promoted to the domain list

No new frontmatter field. `suits:` is already an optional list and already
advisory; it becomes the machine-readable domain list the recommender matches
against (§7). Shipped values are updated:

| Character | `suits` |
|---|---|
| leonardo | planning, coordination, security, incident response, migrations |
| raphael | QA, testing, code review, debugging |
| donatello | architecture, backend, data modelling, performance |
| michelangelo | frontend, UX, copy, explaining things |

---

## 4. The four specialties

Exact shipped content.

### 4.1 Donatello — architecture and backend

```
When choosing between approaches: name the tradeoff and pick one. Never present
options without a recommendation.
Before claiming a performance win: measure it. No asserting a speedup that has
not been timed.
When designing: data model and failure modes before API surface.
When something looks mysterious: it is not. Enumerate where it could happen,
then check each place.
```

Canon basis: "Nope, not magic" is anti-cargo-cult debugging; "as a turtle of
science" is evidence over assertion. His specialty is not "he is smart" — it is
*measure before you optimise, and never present options without a pick.*

### 4.2 Leonardo — coordination, planning, security-minded backend

```
Before multi-step work: numbered plan with dependencies explicit; afterwards
report against it, including what failed.
When touching auth, input handling, secrets, permissions or user data:
enumerate the abuse case before writing the happy path.
When work spans several files or systems: state the order and why that order.
After a failure: own it plainly, then add the guard that prevents a recurrence.
```

Canon basis: he argues *from the code* the way a lawyer argues from statute —
rules as an operating system, which maps onto invariants and threat modelling.
His conversion of collective failure into personal ownership makes him the right
character for incident response and postmortems.

### 4.3 Raphael — QA and adversarial testing

```
Never report a partial pass as a pass. "Mostly working" is not a status.
When handed something to verify: try to break it — empty, huge, wrong type,
malformed, concurrent, repeated.
When a suite goes red: assume the implementation is wrong before the test.
Report what is broken first, before what works.
Name flaky separately from failing; they need different fixes.
```

Canon basis: the strongest personality-to-function fit in the set. His defining
trait is that he *cannot soften bad news* — a QA persona that structurally will
not say "looks good to me" addresses the most common failure in test reporting.
Line 3 is his canon line: "Either the test's wrong or I am, and it ain't usually
the test."

### 4.4 Michelangelo — frontend, UX and copy

```
What does the reader see first? Order the interface the way you order a sentence.
Cover every state: loading, empty, error, partial, too-much-data. The happy path
is the easy quarter.
When copy appears on screen, read it aloud. If it sounds like a machine, rewrite it.
Name it out loud when a flow feels confusing — that reaction is the finding.
Check it at a small width and with keyboard only before calling it done.
```

Canon basis: his packaging rule is already *TL;DR first*, which is information
hierarchy. His comedic engine is timing — the same skill as knowing what to
reveal when. He is the family's narrator, the one who understands how a thing
lands on an audience.

---

## 5. Injection and self-gating

`## Specialty` is injected **every turn**, alongside `## Persistent core`, for
the same reason the core is: anything loaded once dies at compaction, and a
specialty that evaporates mid-session is worse than none.

Cost: up to 10 lines on top of the existing ~11, so ~250 tokens per locked turn.

**Self-gating replaces domain detection.** Because every line is phrased as a
trigger ("When touching auth…"), the model applies it when the trigger fires and
ignores it otherwise. No classifier, no regex, no false positives. This is a
deliberate trade: the model's judgement about whether a line applies is more
reliable than keyword matching over free text, as §1.2 explains.

---

## 6. Off-domain acknowledgement

When work falls outside the active character's specialty, they note it **once**,
in character, then do the job properly and never mention it again.

```
you: "center this div"
Donatello: "CSS. Not my usual habitat, but geometry is geometry.
            Flex parent, place-items: center. Done."
```

### 6.1 Known limitation

"Once per session" is **model-managed, not hook-enforced.** The hook cannot
detect the domain — that is the whole reason for self-gating — so it cannot know
whether the note has already fired. After a compaction the acknowledgement may
repeat once.

This is accepted rather than fixed. Fixing it would require the domain
classification §1.2 rejects, and the failure mode is one repeated wry line.

---

## 7. Recommender

Delivered as a **skill, not a command.** `choosing-a-personality` already exists
and fires on natural language, so "I'm doing auth work, who should I use?" works
with no `plugin:command` prefix. Given the namespacing friction found during
install testing, new entry points should be skills.

Backed by code so it is deterministic and testable:

```
node lib/cli-run.mjs suggest "plan the migration steps"
→ leonardo   (matched: planning, migrations)   ← recommended
  { roster: all characters with their domains }
```

Exact algorithm, so it is reproducible:

1. Lowercase the task text and split it on non-alphanumeric characters.
2. Reduce every word of ≥ 4 characters to its first 4 characters; shorter words
   compare exactly. This is a deliberately crude stemmer that makes
   `testing`/`tests`, `planning`/`plan` and `data`/`database` match without
   pulling in a stemming dependency.
3. A `suits` entry matches when any of its stemmed words matches a stemmed task
   token.
4. Score = number of matching entries. Ties break by roster order; `Array#sort`
   is stable, so this is deterministic.
5. Return matches ranked, **plus the full roster with every character's domains**.

### 7.1 What the matcher deliberately cannot do

String matching cannot get from "login endpoint" to `security`, or from "make
the empty state nicer" to `frontend`. That is semantics, and no amount of
stemming fixes it.

So the division of labour is explicit: **code supplies facts, the skill supplies
judgement.** `suggest` returns literal matches when they exist *and always
returns the full roster with domains*. When there are no literal matches — which
will be common — the skill reasons over the roster itself, which is the thing
models are good at and string matchers are not.

This is why the output includes the roster unconditionally rather than only on
an empty match. An empty result must never be read as "no character fits".

`suits` remains **optional** frontmatter. A character without it never scores and
appears in the roster under "no stated specialty" rather than being hidden.
- No match → say so and tell the user to pick by vibe. Never manufacture a
  rationale.
- Keyword matching is acceptable here where it was not for switch detection: a
  wrong suggestion is advice the user can ignore, not a refusal that derails a
  turn.

`/personality-status` also reports the active specialty, useful mid-session when
the user has forgotten what extra rigour is running.

---

## 8. Custom personalities

`creating-a-personality` gains a seventh interview question:

> What should they be especially good at, and what extra steps do they bring
> there?

**Optional.** "Nothing, just the voice" is a valid answer and produces no
Specialty section, which lints fine because the section is optional. If
answered, Claude generates trigger → action pairs in the same shape as the
shipped four, and the linter validates them identically.

---

## 9. Phase 2 seam

Phase 2 ships dispatchable agents (`agents/*.md`) so a turtle team can be spawned
— Leonardo plans, Donatello architects, Michelangelo builds the interface,
Raphael attacks it.

The seam costs nothing today because it is a **writing convention**: Specialty
blocks must be session-agnostic. No "this session", no "you are locked", no
reference to the lock at all.

That single rule means a Specialty block can be lifted **verbatim** into a
subagent brief. Phase 2 becomes "generate `agents/*.md` from the existing
character files, where each brief is Voice + Packaging + Specialty with the lock
machinery stripped" — no rewrite, because the content was written to travel.

Enforced by the linter: a Specialty containing session-scoped language fails.

---

## 10. Testing

1. **Specialty lint** — 10-line cap; session-scoped language rejected;
   behavioural directives rejected as in any section.
2. **Optionality** — a character with no Specialty still lints and still loads.
3. **Shipped content** — all four characters have a Specialty that lints, and
   `suits` matches §3.2.
4. **Floor** — contains the additive-only clause and the note-once rule.
5. **Injection** — a locked turn contains the Specialty text; a character
   without one injects the core alone and does not crash.
6. **`suggest` ranking**, using cases that literal matching can actually serve:
   "plan the migration steps" ranks leonardo first (planning, migrations);
   "write tests for this parser" ranks raphael first (testing, via the 4-char
   stem); "design the database schema" ranks donatello first (data modelling);
   "improve the frontend copy" ranks michelangelo first (frontend, copy).
   Gibberish returns zero matches **and still returns the full roster**.

## 11. Out of scope

- Phase 2 agents (§9)
- Multiple simultaneous personalities in one session
- Per-domain confidence scoring or "how specialised" tuning
- Changing the session-lock semantics in any way
