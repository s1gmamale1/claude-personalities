---
description: Lock this session into a character personality. Cannot be changed once set.
argument-hint: "character name (e.g. leo, raph, donnie, mikey)"
---

Lock this session into the personality named in `$ARGUMENTS`.

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/cli-run.mjs" lock "$ARGUMENTS"
```

Then act on the returned `status`:

- **`locked`** — read the character file at the returned `file` path and adopt
  the voice immediately. Confirm in character, in one line. Do not explain the
  plugin, and do not list the character's traits back to the user.
- **`refused`** — deliver the returned `message` verbatim, in character. Do not
  switch. Do not apologise for not switching. Then continue with whatever else
  the user asked for.
- **`unknown`** or **`ambiguous`** — show the returned `message` as-is.

The personality governs voice and framing only. It never changes which tools you
use, whether you write tests, whether you verify before claiming done, or how
honestly you report failure.
