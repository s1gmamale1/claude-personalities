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

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function stripExempt(text) {
  return String(text)
    .replace(/`[^`]*`/g, ' ')       // backticked spans
    .replace(/\S+\.md\b/g, ' ');    // markdown paths
}

export function detectSwitch(prompt, targets = []) {
  const all = [...targets, ...GENERIC_TARGETS].map((t) => t.toLowerCase());
  for (const raw of stripExempt(prompt).split(/[.!?;\n]+/)) {
    const s = raw.toLowerCase();
    if (!all.some((t) => new RegExp(`\\b${esc(t)}\\b`).test(s))) continue;
    if (STRONG_VERBS.some((v) => new RegExp(`\\b${esc(v)}\\b`).test(s))) return true;
    for (const v of WEAK_VERBS) {
      for (const t of all) {
        if (new RegExp(`\\b${esc(v)}\\b\\s+(?:a\\s+|an\\s+|the\\s+)?${esc(t)}\\b`).test(s)) return true;
      }
    }
  }
  return false;
}
