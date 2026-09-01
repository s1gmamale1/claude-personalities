// Longest-first so "switch to" is tried before "switch".
export const STRONG_VERBS = [
  'switch to', 'switch', 'become', 'swap', 'turn into', 'go back to',
  'stop being', 'act like', 'talk like', 'impersonate', 'roleplay as',
  'pretend to be', 'pretend',
];

// Common in ordinary speech — only fire when directly followed by a target.
export const WEAK_VERBS = ['be', 'act', 'change', 'drop', 'make you'];

export const GENERIC_TARGETS = [
  'personality', 'persona', 'your character', 'your default',
  'your normal self', 'normal', 'yourself', 'someone else',
];

// A target followed immediately by another noun is a reference to something in
// the user's own code — "the personality column", "the normal flow", "the turtle
// graphics module" — not a request to change personality. Genuine switch
// phrasings end the clause or trail off into filler.
export const FILLER_AFTER_TARGET = [
  'thing', 'stuff', 'mode', 'bit', 'shtick', 'vibe', 'act',
  'please', 'again', 'now', 'for', 'and', 'then', 'ok', 'okay', 'just',
  'instead', 'already', 'immediately', 'temporarily',
];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function stripExempt(text) {
  return String(text)
    .replace(/`[^`]*`/g, ' ')       // backticked spans
    .replace(/\S+\.md\b/g, ' ');    // markdown paths
}

// True when `target` appears in `sentence` as a switch target rather than as a
// noun the user is talking about.
function isSwitchUse(sentence, target) {
  const m = new RegExp(`\\b${esc(target)}\\b\\s*(\\w+)?`).exec(sentence);
  if (!m) return false;
  const next = m[1];
  return !next || FILLER_AFTER_TARGET.includes(next);
}

export function detectSwitch(prompt, targets = []) {
  const all = [...targets, ...GENERIC_TARGETS].map((t) => t.toLowerCase());
  for (const raw of stripExempt(prompt).split(/[.!?;\n]+/)) {
    const s = raw.toLowerCase();
    const hits = all.filter((t) => isSwitchUse(s, t));
    if (hits.length === 0) continue;
    if (STRONG_VERBS.some((v) => new RegExp(`\\b${esc(v)}\\b`).test(s))) return true;
    for (const v of WEAK_VERBS) {
      for (const t of hits) {
        if (new RegExp(`\\b${esc(v)}\\b\\s+(?:a\\s+|an\\s+|the\\s+)?${esc(t)}\\b`).test(s)) return true;
      }
    }
  }
  return false;
}
