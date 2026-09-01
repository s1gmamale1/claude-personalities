import { join } from 'node:path';
import { readState, writeState } from './state.mjs';
import { loadUniverses, resolveName } from './characters.mjs';

const firstRefusal = (char) =>
  char.sections.Refusals.split('\n').map((l) => l.trim()).filter(Boolean)[0]
    .replace(/^"|"$/g, '');

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
