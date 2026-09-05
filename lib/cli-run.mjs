#!/usr/bin/env node
// Entry point for the /personality and /personality-status commands.
// Kept as a real script rather than `node -e "import(...)"` because dynamic
// import of a bare absolute path is not portable to Windows.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lockOrRefuse, status, lintPath, suggest } from './cli.mjs';

// Claude Code sets CLAUDE_PLUGIN_ROOT; Codex sets both it and PLUGIN_ROOT.
const ROOT = process.env.CLAUDE_PLUGIN_ROOT
  || process.env.PLUGIN_ROOT
  || dirname(dirname(fileURLToPath(import.meta.url)));
// Codex exports no session id to commands. Leave it undefined and lockOrRefuse
// writes a pending lock that the guard hook adopts on the next turn.
const sessionId = process.env.CLAUDE_CODE_SESSION_ID || undefined;

const [cmd, ...rest] = process.argv.slice(2);
const out = (o) => console.log(JSON.stringify(o, null, 2));

if (cmd === 'status') {
  out(status(sessionId, ROOT));
} else if (cmd === 'suggest') {
  out(suggest(rest.join(' '), ROOT));
} else if (cmd === 'lint') {
  if (!rest[0]) {
    out({ error: 'usage: cli-run.mjs lint <path-to-character.md>' });
    process.exit(1);
  }
  const result = lintPath(rest.join(' '));
  out(result);
  if (!result.ok) process.exit(1);   // non-zero so the skill cannot miss a failure
} else if (cmd === 'lock') {
  const r = lockOrRefuse({ sessionId, query: rest.join(' '), root: ROOT });
  out({
    status: r.status,
    message: r.message,
    character: r.character?.meta?.name,
    display: r.character?.meta?.display,
    universe: r.universe?.meta?.display,
    continuity: r.character?.meta?.continuity,
    file: r.character?.path,
  });
} else {
  out({ error: 'usage: cli-run.mjs lock <name> | status | lint <path> | suggest <task>' });
  process.exit(1);
}
