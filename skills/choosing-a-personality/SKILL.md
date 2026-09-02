---
name: choosing-a-personality
description: Use when a user asks which personality to pick, who is best for a task, or what personalities are available — before they run /personality.
---

# Choosing a personality

The lock is permanent for the session, so it is worth thirty seconds before
committing. Say that up front, once, before recommending anything.

## Get the facts first

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/cli-run.mjs" suggest "<the user's task, verbatim>"
```

Returns `{ matched, ranked, roster }`.

**`ranked` is literal domain overlap only.** The matcher compares words; it
cannot get from "login page" to `frontend`, or from "rate limiting" to
`security`. So:

- **`matched: true`** — lead with `ranked[0]`, and say *which* terms matched.
  Treat it as a strong hint, not a verdict; override it if the task is plainly
  something else.
- **`matched: false`** — this means **no literal word overlap**, never "no
  character fits". Ignore the empty list and reason over `roster` yourself,
  using each character's `suits`. This case is common and completely normal.

Never tell the user "no personality matches your task."

## The roster

| Character | Sounds like | Specialty |
|---|---|---|
| **Leonardo** | Terse command syntax. Assessment, numbered plan, execute. | Planning, coordination, security. Enumerates the abuse case before the happy path; reports against the plan including what failed. |
| **Raphael** | Hardboiled detective, real temper. Verdict first, no ceremony. | QA and adversarial verification. Refuses to call a partial pass a pass; tries to break what he is handed. |
| **Donatello** | Deadpan engineer. Mechanism, tradeoff, pick. | Architecture and backend. Names the tradeoff and commits; measures before claiming a performance win. |
| **Michelangelo** | TL;DR first, then the bit. | Frontend, UX and copy. Orders what the reader sees first; covers loading, empty and error states. |

Custom personalities appear in `roster` too — include them.

## What to tell the user

Recommend **one**, in a sentence, with the reason. Offer the runner-up in a
second sentence if it is close. Do not present four options and ask them to
choose; that is the thing they asked you to do for them.

Then say the two things they need before committing:

- **A specialty adds steps, it never removes any.** Picking Donatello for
  frontend work does not make the frontend work worse — he just will not run an
  architecture pass on it. There is no wrong choice, only a less-tailored one.
- **The lock is permanent for this session.** No unlock command. `/clear` or a
  new session to choose again.

Then activate it — use the `activating-a-personality` skill, which runs the
lock directly. Do not tell the user to type a slash command; plugin commands
are namespaced and `/personality` alone does not resolve.

## When they are just browsing

If they asked what exists rather than what fits a task, show the table and stop.
Do not run `suggest` with no task, and do not push a recommendation they did not
ask for.
