#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { readState, writeState, clearState, pruneOlderThan } from '../lib/state.mjs';
import { loadUniverses } from '../lib/characters.mjs';
import { detectSwitch } from '../lib/detect.mjs';
import { buildContext, emit } from '../lib/inject.mjs';

const ROOT = process.env.CLAUDE_PLUGIN_ROOT
  || dirname(dirname(fileURLToPath(import.meta.url)));

function readStdin() {
  try { return JSON.parse(readFileSync(0, 'utf8')); } catch { return null; }
}

function main() {
  const input = readStdin();
  if (!input || !input.session_id) return;

  if (input.hook_event_name === 'SessionStart') {
    // Matcher is startup|clear, but re-check: never clear on compact or resume.
    if (input.source === 'startup' || input.source === 'clear') {
      clearState(input.session_id);
      pruneOlderThan(30);
    }
    return;
  }

  if (input.hook_event_name !== 'UserPromptSubmit') return;

  // Commands key the lock on CLAUDE_CODE_SESSION_ID; hooks are authoritative and
  // key on the stdin session_id. They normally match. If they ever don't, adopt
  // the env-keyed lock once rather than failing silently.
  let state = readState(input.session_id);
  const envId = process.env.CLAUDE_CODE_SESSION_ID;
  if (!state && envId && envId !== input.session_id) {
    const migrated = readState(envId);
    if (migrated) {
      clearState(envId);
      writeState(input.session_id, migrated);
      state = migrated;
    }
  }
  if (!state) return;                                   // inert by default

  const universes = loadUniverses(join(ROOT, 'personalities'));
  const universe = universes.get(state.universe);
  const character = universe?.characters.get(state.character);
  if (!character) return;                               // degrade to no personality

  const targets = [];
  for (const u of universes.values()) {
    targets.push(...(u.meta.commandAliases || []));
    for (const c of u.characters.values()) {
      targets.push(c.meta.name, ...(c.meta.aliases || []));
    }
  }

  const switchAttempt = detectSwitch(input.prompt || '', targets);
  writeState(input.session_id, { ...state, turns: (state.turns || 0) + 1 });
  process.stdout.write(emit('UserPromptSubmit', buildContext({ character, universe, switchAttempt })));
}

try { main(); } catch { /* never break a turn */ }
process.exit(0);
