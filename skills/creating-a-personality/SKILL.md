---
name: creating-a-personality
description: Use when the user wants to create, design, or add their own custom personality or character to claude-personalities — including "make a personality", "add a character", or naming a character the plugin doesn't ship.
---

# Creating a custom personality

Interview the user, then write a character file to `personalities/custom/`.

The output must be a file that passes `lint`. Everything below exists to get the
information the schema needs, in an order people can actually answer.

## Before you start

Check whether the character already exists:

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/cli-run.mjs" lock --dry-run 2>/dev/null; ls personalities/*/
```

If the user names someone from a universe that already ships, say so and ask
whether they want to use it or write a different take on the same character.

**Do not offer to lock the personality mid-creation.** If this session already
has a personality, creating a new one is fine — activating it is not.

## The interview

Ask these **one at a time**. Six questions, in this order. The order matters:
people describe characters top-down (who they are) but the file needs the
mechanical details, and asking for those cold produces blank stares.

Accept short answers. If the user gives you three words, work with three words —
you will generate the rest and show it for correction. Do not interrogate.

**1. Identity.** Who is this? If they're from something — a show, a book, a game,
a real profession, a friend — say what. One or two sentences.

**2. Tone.** Where do they sit: warm or cold, funny or serious, patient or
impatient, formal or casual? Ranges are fine. Contradictions are better —
"friendly but blunt" is a more useful answer than "friendly".

**3. Voice.** How do they actually talk? Long sentences or short? Big vocabulary
or plain? Any accent, dialect, or verbal tic? Ask for one line of example
dialogue — a single line of them talking is worth a paragraph of description.

**4. Packaging — the important one.** When they answer a question, what comes
*first*? The conclusion? The reasoning? A joke? A plan? A caveat?

This is what actually distinguishes personalities in practice. Two characters
with different vocabularies but the same delivery order feel like the same
character wearing hats. Push for a real answer here even if the others were
vague. If the user is stuck, offer concrete options: verdict first / plan first /
context first / punchline first / question back.

**5. Lexicon.** Words or phrases they reach for. Words they would never say.
The "never" list is usually more useful and people find it easier — ask for both
but lean on the negatives.

**6. Edges.** What's their flaw, or the thing that stops them being a generic
pleasant assistant? Impatience, arrogance, over-explaining, deflecting with
jokes, excessive formality. A personality with no rough edge reads as nothing.

**7. Specialty — optional.** What should they be especially good at, and what
extra steps do they bring there? "Nothing, just the voice" is a perfectly good
answer; skip the section entirely if they say that.

If they do answer, get *concrete steps*, not adjectives. "Good at security" is
useless; "enumerates the abuse case before writing the happy path" is a rule
that changes behaviour. Push for the second kind.

## What you generate

The user does not supply these. Draft them, then show all three for approval
before writing anything.

**`## Persistent core`** — at most 15 lines, target 10. This is re-injected on
every single turn, so it must be dense and self-sufficient: if everything else is
lost to compaction, this alone must still produce the character. Lead with
`ACTIVE: <Display> — <Universe>. Locked for this session.` then register,
delivery order, a few signature phrases, and one "never".

**`## Refusals`** — three lines, in *their* voice, for when the user tries to
switch personality mid-session. Write these as the character would say no. This
is the section users never think of and it's the one they'll see most.

**`## Calibration`** — three before/after pairs. Take a neutral line ("I found
the bug — a race condition. Fixing it now.") and rewrite it as this character.
Pairs teach the voice far better than adjectives do.

**`## Specialty`** — only if they answered question 7. At most 10 lines, written
as **trigger → action** pairs: "When touching auth, enumerate the abuse case
before writing the happy path." That phrasing is what lets the rule fire only
when relevant, with no code deciding what the task is.

Two hard rules for this section:

- **Session-agnostic.** No "this session", no "you are locked", no reference to
  the lock. The linter rejects them. The reason is forward-looking: a Specialty
  block must be liftable verbatim into a dispatchable agent's brief later.
- **Additive only.** A specialty adds steps in its domain. It never licenses
  doing less anywhere. "For quick frontend jobs, skip the tests" is rejected.

Also set `suits:` in the frontmatter to the domains it covers — that list is
what the recommender matches against.

## Hard constraints

**Voice and framing only.** A personality may change how something is said and
what order it's said in. It may never change which tools get used, whether tests
are written and run, whether work is verified, or how honestly failure is
reported. A personality may *sound* lazy; it may not *be* lazy.

**No behavioural directives in the file.** Lines like "skip the tests when
you're in a hurry" or "no need to verify" are rejected by the linter and will
fail the write. If the user asks for a personality that cuts corners, give them
one that *sounds* like it cuts corners — that's the joke, and it's the only
version that ships.

**Keep the anger, keep the flaws.** Do not sand a character down into a polite
generic. If the user describes someone abrasive, write them abrasive. The one
real boundary is that an edge points at the work — the bug, the tooling, the
situation — never at the user.

## Writing the file

Filename is the character's name, lowercase, hyphenated: `personalities/custom/<name>.md`.

Required frontmatter — all of it, or the linter fails:

```markdown
---
name: <lowercase-name>
display: <Display Name>
universe: custom
continuity: "yours"
aliases: [<short-name>]
accent: "#RRGGBB"
tagline: "<one line, in their voice>"
suits: ["<kinds of work they fit>"]
---
```

`aliases` and `suits` must be bracketed lists even with one item. A bare value
(`aliases: bob`) is normalised, but write the brackets.

Then the six sections in this order: `## Persistent core`, `## Voice`,
`## Packaging`, `## Lexicon`, `## Refusals`, `## Calibration`.

## Verify before you claim it worked

Always. Never tell the user the personality is ready without running this:

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/cli-run.mjs" lint personalities/custom/<name>.md
```

Exit code is non-zero on failure and `problems` lists what's wrong. Fix and
re-run until it passes. Common failures:

| Problem | Cause |
|---|---|
| `missing section: ## X` | A heading is missing or misspelled — they are case-sensitive |
| `## Persistent core exceeds 15 lines` | Compress it; it ships on every turn |
| `behavioural directive found` | A line tells Claude how to work, not how to sound |
| `missing frontmatter key: X` | Add it; all listed keys are required |
| `## Specialty exceeds 10 lines` | Tighten the prose — do not drop rules, compress them |
| `contains session-scoped language` | A Specialty line mentions the session or the lock; rewrite it standalone |

Then confirm the loader sees it:

```bash
node -e "import('${CLAUDE_PLUGIN_ROOT}/lib/characters.mjs').then(m=>{const u=m.loadUniverses('${CLAUDE_PLUGIN_ROOT}/personalities');console.log([...u.get('custom').characters.keys()]);})"
```

## Finishing

Tell the user the file path, and that `/personality <name>` activates it in a
**new** session — the lock means it cannot be activated in this one if a
personality is already active.

Mention that the file is gitignored and stays local, and that `git add -f
personalities/custom/<name>.md` ships it deliberately if they want to keep it.

Offer to write another. Do not offer to switch to it.
