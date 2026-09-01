#!/usr/bin/env node
// Entry point for the /personality and /personality-status commands.
// Kept as a real script rather than `node -e "import(...)"` because dynamic
// import of a bare absolute path is not portable to Windows.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lockOrRefuse, status } from './cli.mjs';

const ROOT = process.env.CLAUDE_PLUGIN_ROOT
  || dirname(dirname(fileURLToPath(import.meta.url)));
const sessionId = process.env.CLAUDE_CODE_SESSION_ID || 'unknown-session';

const [cmd, ...rest] = process.argv.slice(2);
const out = (o) => console.log(JSON.stringify(o, null, 2));

if (cmd === 'status') {
  out(status(sessionId));
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
  out({ error: 'usage: cli-run.mjs lock <name> | cli-run.mjs status' });
  process.exit(1);
}
