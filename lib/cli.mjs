import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { readState, writeState } from './state.mjs';
import { loadUniverses, resolveName, parseCharacter, lintCharacter } from './characters.mjs';

/**
 * Validate a single character file on disk. Used by the creating-a-personality
 * skill to check its own output instead of hoping it got the schema right.
 */
export function lintPath(filePath) {
  let char;
  try {
    char = parseCharacter(readFileSync(filePath, 'utf8'), filePath);
  } catch (e) {
    return { ok: false, problems: [e.message] };
  }
  const problems = lintCharacter(char);
  return {
    ok: problems.length === 0,
    problems,
    name: char.meta.name,
    display: char.meta.display,
  };
}

// A community character file may have an empty Refusals section. Degrade to a
// plain message rather than crashing the command.
const firstRefusal = (char) => {
  const line = (char?.sections?.Refusals || '')
    .split('\n').map((l) => l.trim()).filter(Boolean)[0];
  return line
    ? line.replace(/^"|"$/g, '')
    : `This session is locked to ${char?.meta?.display || 'a personality'}. Start a new session to choose again.`;
};

export function lockOrRefuse({ sessionId, query, root }) {
  const universes = loadUniverses(join(root, 'personalities'));
  const existing = readState(sessionId);

  if (existing) {
    const current = universes.get(existing.universe)?.characters.get(existing.character);
    return {
      status: 'refused',
      message: current ? firstRefusal(current) : 'This session already has a personality.',
      character: current,
    };
  }

  const hit = resolveName(universes, query);
  if (!hit) {
    const roster = [...universes.values()]
      .filter((u) => u.characters.size > 0)      // an empty custom/ is not worth listing
      .map((u) => `${u.meta.display}: ${[...u.characters.keys()].join(', ')}`)
      .join('\n');
    return { status: 'unknown', message: `Unknown personality "${query}".\nAvailable:\n${roster}` };
  }
  if (hit.ambiguous) {
    return { status: 'ambiguous', message: `Ambiguous. Use one of: ${hit.ambiguous.join(', ')}` };
  }

  writeState(sessionId, {
    universe: hit.universe.meta.id,
    character: hit.character.meta.name,
    continuity: hit.character.meta.continuity,   // so status() never re-reads files
    locked_at: new Date().toISOString(),
    turns: 0,
  });
  return { status: 'locked', character: hit.character, universe: hit.universe };
}

export function status(sessionId) {
  const s = readState(sessionId);
  if (!s) return { locked: false };
  return {
    locked: true,
    character: s.character,
    universe: s.universe,
    continuity: s.continuity || 'unknown',
    locked_at: s.locked_at,
    turns: s.turns || 0,
  };
}
