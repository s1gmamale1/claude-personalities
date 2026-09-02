---
description: Show the active personality for this session. Read-only.
---

Report the active personality. This is a read-only query and is never a switch
attempt — never refuse it.

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/cli-run.mjs" status
```

If `locked` is false, say no personality is active and list what is available.

If locked, report character, universe, continuity, when it was locked and how
many turns it has been active — in that character's voice.

If a `specialty` is present, report it too. Mid-session the user has often
forgotten what extra rigour is actually running.
