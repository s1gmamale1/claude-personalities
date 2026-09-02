import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLOOR, buildContext, emit } from '../lib/inject.mjs';

const character = {
  meta: { display: 'Leonardo', name: 'leonardo', continuity: '2003 (4Kids)' },
  sections: { 'Persistent core': 'ACTIVE: Leonardo.', Refusals: '"No."\n"Not happening."' },
};
const universe = { meta: { id: 'tmnt', display: 'TMNT' } };

test('the floor forbids lowering the quality bar', () => {
  assert.match(FLOOR, /voice and framing only/i);
  assert.match(FLOOR, /may sound lazy\. It may not \*be\* lazy/i);
});

test('context includes the floor and the persistent core', () => {
  const ctx = buildContext({ character, universe, switchAttempt: false });
  assert.ok(ctx.includes(FLOOR));
  assert.ok(ctx.includes('ACTIVE: Leonardo.'));
});

test('context omits refusals when no switch was attempted', () => {
  assert.ok(!buildContext({ character, universe, switchAttempt: false }).includes('Not happening'));
});

test('a switch attempt appends the refusal instruction and the lines', () => {
  const ctx = buildContext({ character, universe, switchAttempt: true });
  assert.ok(ctx.includes('Not happening'));
  assert.match(ctx, /answer .*(remainder|rest)/i);
});

test('emit produces the Claude Code envelope when CLAUDE_PLUGIN_ROOT is set', () => {
  process.env.CLAUDE_PLUGIN_ROOT = '/tmp/x';
  delete process.env.COPILOT_CLI;
  const out = JSON.parse(emit('UserPromptSubmit', 'hello'));
  assert.equal(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.equal(out.hookSpecificOutput.additionalContext, 'hello');
  assert.equal(out.additional_context, undefined);
});

test('emit falls back to the SDK-standard field elsewhere', () => {
  delete process.env.CLAUDE_PLUGIN_ROOT;
  const out = JSON.parse(emit('UserPromptSubmit', 'hello'));
  assert.equal(out.additionalContext, 'hello');
  assert.equal(out.hookSpecificOutput, undefined);
});

const specialised = {
  meta: { display: 'Donatello', name: 'donatello', continuity: '2003 (4Kids)' },
  sections: {
    'Persistent core': 'ACTIVE: Donatello.',
    Specialty: 'When choosing between approaches: name the tradeoff and pick one.',
    Refusals: '"No."',
  },
};

test('the floor states specialisation is additive-only', () => {
  assert.match(FLOOR, /adds steps inside its domain/i);
  assert.match(FLOOR, /never removes steps outside it/i);
  assert.match(FLOOR, /note it once in character/i);
});

test('a specialty is injected when present', () => {
  const ctx = buildContext({ character: specialised, universe, switchAttempt: false });
  assert.match(ctx, /name the tradeoff and pick one/);
});

test('a character with no specialty injects the core alone and does not crash', () => {
  const ctx = buildContext({ character, universe, switchAttempt: false });
  assert.ok(ctx.includes('ACTIVE: Leonardo.'));
  assert.ok(!/Specialty:/.test(ctx));
});
