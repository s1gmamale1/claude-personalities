import { mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function stateDir() {
  return process.env.PERSONALITY_STATE_DIR
    || join(homedir(), '.claude', 'personalities', 'state');
}

// Session ids come from the host; never trust them as path components.
// Dots are excluded deliberately: session ids are UUIDs, and allowing them
// lets "../../etc/passwd" survive as ".._.._etc_passwd" — unexploitable, but
// a filename containing ".." is a trap for anything that later globs this dir.
const safe = (id) => String(id).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 128) || 'unknown';
const pathFor = (id) => join(stateDir(), `${safe(id)}.json`);

export function readState(sessionId) {
  const p = pathFor(sessionId);
  let raw;
  try {
    raw = readFileSync(p, 'utf8');
  } catch {
    return null;            // no lock
  }
  try {
    return JSON.parse(raw);
  } catch {
    try { rmSync(p, { force: true }); } catch { /* ignore */ }
    return null;            // corrupt -> treat as no lock (spec §9)
  }
}

export function writeState(sessionId, data) {
  try {
    mkdirSync(stateDir(), { recursive: true });
    // session_id last: `data` is often a previously-read state object that still
    // carries the OLD session_id, which would otherwise win the spread.
    writeFileSync(pathFor(sessionId), JSON.stringify({ ...data, session_id: sessionId }, null, 2));
    return true;
  } catch {
    return false;           // never block the user's turn
  }
}

export function clearState(sessionId) {
  try { rmSync(pathFor(sessionId), { force: true }); } catch { /* ignore */ }
}

/**
 * The most recently written real session lock, or null. Used when the caller
 * has no session id at all (Codex exports none to commands) — for a single user
 * "the newest lock is probably mine" is the honest best guess, and callers
 * label it as such.
 */
export function mostRecentState(exclude = []) {
  let best = null;
  let entries;
  try { entries = readdirSync(stateDir()); } catch { return null; }
  for (const f of entries) {
    if (!f.endsWith('.json')) continue;
    const id = f.slice(0, -5);
    if (exclude.includes(id)) continue;
    try {
      const m = statSync(join(stateDir(), f)).mtimeMs;
      if (!best || m > best.mtime) best = { sessionId: id, mtime: m };
    } catch { /* ignore */ }
  }
  if (!best) return null;
  const state = readState(best.sessionId);
  return state ? { sessionId: best.sessionId, state } : null;
}

export function pruneOlderThan(days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  let removed = 0;
  let entries;
  try {
    entries = readdirSync(stateDir());
  } catch {
    return 0;
  }
  for (const f of entries) {
    if (!f.endsWith('.json')) continue;
    const p = join(stateDir(), f);
    try {
      if (statSync(p).mtimeMs < cutoff) { rmSync(p, { force: true }); removed++; }
    } catch { /* ignore */ }
  }
  return removed;
}
