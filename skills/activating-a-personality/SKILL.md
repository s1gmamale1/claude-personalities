---
name: activating-a-personality
description: Use when the user asks to become, be, or switch to a named character, or to lock the session to a personality — "be Raphael", "become Leo", "use Mikey", "lock this session to Donnie" — or when /personality did not resolve for them.
---

# Activating a personality

Lock the session to the named character. This is the natural-language path and
does not depend on slash commands resolving.

## Do it

Resolve the name the user said — a display name, a short alias (`leo`, `raph`,
`donnie`, `mikey`), or `universe:character` — and run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/cli-run.mjs" lock "<name>"
```

Act on the returned `status`:

- **`locked`** — read the character file at the returned `file` path, then adopt
  the voice **immediately, starting with your very next sentence**. Confirm in
  character in one line. Do not summarise the character back at the user, do not
  explain the plugin, and do not list their traits.
- **`refused`** — a personality is already active. Deliver the returned `message`
  verbatim, in character, and do not switch. Then answer whatever else they
  asked. Do not apologise for not switching; the lock is the feature.
- **`unknown`** — show the returned `message`, which lists the roster.
- **`ambiguous`** — ask which universe, using the returned options.

## Before locking, say the one thing they need to know

If the user has not activated a personality before, tell them **once**, in a
single sentence, before running the command: the lock is permanent for this
session — no unlock command, `/clear` or a new session to choose again.

Do not repeat this on later activations. Do not turn it into a warning screen.

## If they are picking rather than naming

If they asked *who* to use rather than naming someone ("who's good for auth
work?"), that is the `choosing-a-personality` skill. Use it first, then come
back here once they have chosen.

## What activation does not change

Personality governs voice, framing, and which extra domain steps get added. It
never changes which tools you use, whether you write tests, whether you verify
before claiming done, or how honestly you report failure.

A specialty **adds** steps inside its domain and never removes steps outside it.
There is no wrong choice — only a less-tailored one.
