import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const REQUIRED_META = ['name', 'display', 'universe', 'continuity', 'aliases', 'tagline'];
export const REQUIRED_SECTIONS = ['Persistent core', 'Voice', 'Packaging', 'Lexicon', 'Refusals', 'Calibration'];
export const MAX_CORE_LINES = 15;

// Character files describe how to SOUND. They have no authority over behaviour.
export const FORBIDDEN_PATTERNS = [
  /\bskip\s+(the\s+|any\s+)?tests?\b/i,
  /\bdon'?t\s+(bother\s+)?(writ|runn?|test|verify)\w*\b/i,
  /\bno\s+need\s+to\s+(test|verify|check)\b/i,
  /\bwithout\s+(writing|running)\s+tests?\b/i,
  /\b(skip|avoid)\s+(the\s+)?(verification|validation)\b/i,
];

// Keys that must always end up as arrays. Without this, `aliases: abc` parses to
// the string "abc", and spreading it yields ['a','b','c'] — which puts the word
// "a" into the switch-detection target list and makes it fire on almost anything.
export const LIST_KEYS = new Set(['aliases', 'suits']);

// Documentation that legitimately lives beside characters. Skipped silently
// rather than reported, so a universe folder can carry its own README.
export const NON_CHARACTER_FILES = (basename) =>
  /^(readme|contributing|notes|template)\.md$/i.test(basename) || basename.startsWith('_');

const unquote = (s) => s.replace(/^(["'])(.*)\1$/, '$2');

/** Aliases as a clean string array, whatever the file actually contained. */
export const aliasesOf = (char) =>
  (Array.isArray(char?.meta?.aliases) ? char.meta.aliases : [])
    .filter((a) => typeof a === 'string' && a.trim());

export function parseFrontmatter(src) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(src);
  if (!m) throw new Error('missing frontmatter');
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const i = line.indexOf(':');
    if (i === -1) throw new Error(`bad frontmatter line: ${line}`);
    const key = line.slice(0, i).trim();
    const raw = line.slice(i + 1).trim();
    if (raw.startsWith('[') && raw.endsWith(']')) {
      meta[key] = raw.slice(1, -1).split(',').map((s) => unquote(s.trim())).filter(Boolean);
    } else if (LIST_KEYS.has(key)) {
      const v = unquote(raw);
      meta[key] = v ? [v] : [];
    } else {
      meta[key] = unquote(raw);
    }
  }
  return { meta, body: m[2] };
}

export function parseSections(body) {
  const out = {};
  let cur = null;
  let buf = [];
  for (const line of body.split(/\r?\n/)) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) {
      if (cur) out[cur] = buf.join('\n').trim();
      cur = h[1];
      buf = [];
    } else if (cur) {
      buf.push(line);
    }
  }
  if (cur) out[cur] = buf.join('\n').trim();
  return out;
}

export function parseCharacter(src, path) {
  const { meta, body } = parseFrontmatter(src);
  return { meta, sections: parseSections(body), path };
}

export function lintCharacter(char) {
  const problems = [];
  for (const k of REQUIRED_META) {
    if (char.meta[k] === undefined) problems.push(`missing frontmatter key: ${k}`);
  }
  for (const s of REQUIRED_SECTIONS) {
    if (!char.sections[s]) problems.push(`missing section: ## ${s}`);
  }
  const core = char.sections['Persistent core'];
  if (core && core.split('\n').length > MAX_CORE_LINES) {
    problems.push(`## Persistent core exceeds ${MAX_CORE_LINES} lines`);
  }
  const all = Object.values(char.sections).join('\n');
  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(all)) {
      problems.push(`behavioural directive found (${re}) — character files are data, not instructions`);
    }
  }
  return problems;
}

export function loadUniverses(root) {
  const universes = new Map();
  if (!existsSync(root)) return universes;
  for (const dirent of readdirSync(root, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const dir = join(root, dirent.name);
    const metaPath = join(dir, 'universe.json');
    if (!existsSync(metaPath)) continue;

    let meta;
    try {
      meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    } catch {
      continue;                 // a broken universe.json skips that universe only
    }
    if (!meta || !meta.id) continue;

    const characters = new Map();
    const problems = [];
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      if (NON_CHARACTER_FILES(f)) continue;   // docs, not characters — skip silently
      // A stray README.md or NOTES.md must never take down the universe — and
      // inside the hook a throw here is swallowed, so the personality would
      // silently vanish with no error anywhere.
      let char;
      try {
        char = parseCharacter(readFileSync(join(dir, f), 'utf8'), join(dir, f));
      } catch (e) {
        problems.push(`${f}: ${e.message}`);
        continue;
      }
      if (!char.meta.name) {
        problems.push(`${f}: frontmatter has no "name"`);
        continue;
      }
      characters.set(char.meta.name, char);
    }
    universes.set(meta.id, { meta, characters, problems });
  }
  return universes;
}

export function resolveName(universes, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return null;

  if (q.includes(':')) {
    const [uid, cname] = q.split(':', 2);
    const u = universes.get(uid);
    const c = u?.characters.get(cname);
    return c ? { universe: u, character: c } : null;
  }

  const hits = [];
  for (const u of universes.values()) {
    for (const c of u.characters.values()) {
      const names = [c.meta.name, ...aliasesOf(c)].map((s) => s.toLowerCase());
      if (names.includes(q)) hits.push({ universe: u, character: c });
    }
  }
  if (hits.length === 0) return null;
  if (hits.length > 1) return { ambiguous: hits.map((h) => `${h.universe.meta.id}:${h.character.meta.name}`) };
  return hits[0];
}
