import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { readState, writeState, mostRecentState } from './state.mjs';
import { loadUniverses, resolveName, parseCharacter, lintCharacter } from './characters.mjs';

// When the CLI has no session id (Codex exports none to commands), the lock is
// written here and the guard hook — which always knows the real id — adopts it
// on the next turn. A pending lock older than the TTL is a leftover, not intent.
export const PENDING_KEY = '_pending';
export const PENDING_TTL_MS = 2 * 60 * 1000;

export const isFreshPending = (s) =>
  !!s && !!s.locked_at && (Date.now() - Date.parse(s.locked_at)) <= PENDING_TTL_MS;

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
  const key = sessionId || PENDING_KEY;
  let existing = readState(key);
  if (key === PENDING_KEY && existing && !isFreshPending(existing)) existing = null;  // stale leftover

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

  writeState(key, {
    universe: hit.universe.meta.id,
    character: hit.character.meta.name,
    continuity: hit.character.meta.continuity,   // so status() never re-reads files
    locked_at: new Date().toISOString(),
    turns: 0,
  });
  return { status: 'locked', character: hit.character, universe: hit.universe };
}

// Deliberately crude 4-character stem: makes testing/tests, planning/plan and
// data/database match without a stemming dependency. It cannot get from "login"
// to "security" — that is semantics, and the recommender skill's job.
const stem = (w) => (w.length >= 4 ? w.slice(0, 4) : w);
const tokenise = (s) =>
  new Set(String(s ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(stem));

/**
 * Literal domain matching. Always returns the full roster alongside any matches,
 * because an empty `ranked` means "no literal overlap", never "no character fits".
 */
export function suggest(taskText, root) {
  if (!root) return { matched: false, ranked: [], roster: [] };
  const universes = loadUniverses(join(root, 'personalities'));
  const tokens = tokenise(taskText);
  const ranked = [];
  const roster = [];

  for (const u of universes.values()) {
    for (const c of u.characters.values()) {
      const suits = Array.isArray(c.meta.suits) ? c.meta.suits : [];
      roster.push({
        universe: u.meta.id,
        character: c.meta.name,
        display: c.meta.display,
        suits,
      });
      if (tokens.size === 0 || suits.length === 0) continue;

      const matched = suits.filter((entry) =>
        String(entry).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
          .some((w) => tokens.has(stem(w))));
      if (matched.length) {
        ranked.push({
          universe: u.meta.id,
          character: c.meta.name,
          display: c.meta.display,
          score: matched.length,
          matched,
        });
      }
    }
  }

  ranked.sort((a, b) => b.score - a.score);   // Array#sort is stable: ties keep roster order
  return { matched: ranked.length > 0, ranked, roster };
}

export function status(sessionId, root) {
  let s = readState(sessionId);
  let resolved_by;
  if (!s && !sessionId) {
    // No session id at all: report the newest real lock and say how we chose it.
    const recent = mostRecentState([PENDING_KEY]);
    if (recent) { s = recent.state; resolved_by = 'most-recent'; }
  }
  if (!s) return { locked: false };
  const base = {
    locked: true,
    ...(resolved_by ? { resolved_by } : {}),
    character: s.character,
    universe: s.universe,
    continuity: s.continuity || 'unknown',
    locked_at: s.locked_at,
    turns: s.turns || 0,
  };
  if (!root) return base;          // root is optional; never throw for want of it
  try {
    const char = loadUniverses(join(root, 'personalities'))
      .get(s.universe)?.characters.get(s.character);
    if (char) {
      base.specialty = char.sections.Specialty;
      base.suits = Array.isArray(char.meta.suits) ? char.meta.suits : [];
    }
  } catch { /* status must never fail */ }
  return base;
}
