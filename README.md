# claude-personalities

Give a Claude Code session a character's voice. Personality affects
**presentation only** — the same tools run, the same tests run, the same bugs get
found.

```
/personality leo
```
> Assessment: race condition in the cache layer. Two writers, no lock.
> Plan: 1. Reproduce under load. 2. Add the mutex. 3. Verify under the same load.
> Beginning step one.

```
/personality mikey
```
> TL;DR: no base case, so it calls itself forever. `[trailer voice]` IN A WORLD...
> where one function refuses to stop... anyway it's cooked, twin. Adding the base
> case now.

Same diff. Same tests. Different wrapper.

## Install

```
/plugin marketplace add s1gmamale1/claude-personalities
/plugin install claude-personalities
```

## Use

Just say it:

> **be Raphael** · **become Leo** · **lock this session to Donnie**

That's the reliable path — it goes through a skill, so it works regardless of how
your client namespaces plugin commands. Ask *"who should I use for auth work?"*
and you'll get a recommendation first.

Slash commands exist too, but plugin commands are namespaced by client, so the
bare `/personality` may not resolve for you:

```
/personality leo          # locks the session
/personality-status       # who am I talking to?
```

**Once chosen, it is locked for the session.** Asking to switch gets refused in
character — Leonardo will tell you that changing leaders mid-mission is how
people get hurt. Start a new session or `/clear` to choose again. There is no
unlock command; that is the point.

## Characters

TMNT, 2003 continuity — the darker Mirage-faithful series, not the 1987 cartoon.

| Name | Aliases | Opens with |
|---|---|---|
| `leonardo` | `leo` | A one-line assessment, then a numbered plan |
| `raphael` | `raph` | The verdict, then the one thing that's broken |
| `donatello` | `don`, `donnie`, `donny` | The mechanism, the tradeoff, and his pick |
| `michelangelo` | `mike`, `mikey` | TL;DR, then the bit |

## Specialties

Each turtle brings extra steps in their domain — and never fewer steps outside it.

| Character | Domain | Brings |
|---|---|---|
| **Leonardo** | planning, coordination, security | Numbered plans reported against, failures included. Enumerates the abuse case before writing the happy path. |
| **Raphael** | QA, testing, review | Refuses to call a partial pass a pass. Tries to break what he's handed — empty, huge, malformed, concurrent. |
| **Donatello** | architecture, backend, performance | Names the tradeoff and picks one. Measures before claiming a performance win. |
| **Michelangelo** | frontend, UX, copy | Orders what you see first. Covers loading, empty, error and too-much-data states. |

A specialty **adds** steps inside its domain. It never removes steps outside it —
Donatello on a CSS bug still does complete, correct CSS work, he just won't run
an architecture pass on it. Used outside their domain, a character says so once,
in character, then gets on with it.

Not sure who fits? Just ask — *"I'm doing X, who should I use?"* — or run:

```bash
node lib/cli-run.mjs suggest "plan the migration steps"
```

That does literal domain matching and always returns the full roster. An empty
match means no word overlap, not that no character fits.

## What personality does and does not change

**Changes:** tone, word choice, what gets said first, how work is framed.

**Never changes:** which tools are used, whether tests are written and run,
whether work is verified before being called done, or how honestly failure is
reported.

A personality may *sound* lazy. It may not *be* lazy. This is enforced
structurally, not by good intentions: a fixed floor is injected above every
persona, and character files are validated as data — a linter fails the build if
one contains a behavioural directive.

## Making your own

Ask Claude to **create a custom personality**. The `creating-a-personality` skill
interviews you — identity, tone, voice, what they say *first*, their lexicon, and
their rough edge — then generates the parts nobody thinks of (the compressed
per-turn core, in-character refusals, and before/after calibration pairs), shows
them for approval, and writes the file to `personalities/custom/`.

Custom personalities behave exactly like shipped ones: `/personality <name>`
locks them, aliases work, and switch attempts get refused in *their* voice.

They're gitignored, so what you make stays local. Ship one deliberately with:

```bash
git add -f personalities/custom/your-character.md
```

To check a file you wrote or edited by hand:

```bash
node lib/cli-run.mjs lint personalities/custom/your-character.md
```

It reports missing sections, an over-length persistent core, non-array aliases,
and behavioural directives — and exits non-zero, so it can gate a script.

## Adding a universe

Drop a folder into `personalities/`:

```
personalities/<universe>/universe.json
personalities/<universe>/<character>.md
```

No code changes — the loader globs that path. Continuity is a frontmatter field
rather than a directory level, so a second continuity of the same universe ships
as a sibling file (`leonardo-2012.md`), not a restructure.

Run `npm test` to lint a new character: it checks required sections, caps the
persistent core at 15 lines, and rejects behavioural directives.

## How it works

- `/personality <name>` writes a session-scoped lock keyed on the session id.
- A `UserPromptSubmit` hook re-injects the character's ~10-line core every turn,
  so the voice survives compaction without re-sending the full profile.
- The same hook screens prompts for **switch grammar** — a switch verb next to a
  character name or a generic like "personality". Bare mentions don't trip it, so
  "what would Raph do here?" and editing `raphael.md` both pass.
- A `SessionStart` hook clears the lock on `startup` and `clear` only —
  deliberately **not** on `compact` or `resume`, which would silently drop your
  personality in exactly the long sessions where it matters.

Zero runtime dependencies. Node only, no build step.

## Disclaimer

Unaffiliated, non-commercial fan project. TMNT characters are the property of
their rights holders; created by Kevin Eastman and Peter Laird.

## License

MIT (code). Character names and traits belong to their respective rights holders.
