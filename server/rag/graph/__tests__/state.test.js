import test from 'node:test';
import assert from 'node:assert/strict';

import { createGraphState } from '../state.js';

test('createGraphState initializes request, flags, and budgets', () => {
  const state = createGraphState({
    message: '  Test question  ',
    effectiveMessage: 'Effective question',
    sanitizedMessage: 'Sanitized question',
    promptSafety: { detected: false, score: 0, matches: [] },
    rcicRelated: true,
    sessionId: '11111111-1111-4111-8111-111111111111',
    userId: 'user-1',
    topK: 9,
    analysisDateBasis: 'today',
    asOfDate: '2026-02-17',
    runtimeBudget: {
      maxToolCalls: 8,
      maxLiveFetches: 3,
      maxRetries: 1,
    },
    flags: {
      debugEnabled: true,
      a2ajEnabled: false,
    },
  });

  assert.equal(state.request.message, 'Test question');
  assert.equal(state.request.effectiveMessage, 'Effective question');
  assert.equal(state.request.sessionId, '11111111-1111-4111-8111-111111111111');
  assert.equal(state.request.userId, 'user-1');
  assert.equal(state.request.topK, 9);
  assert.equal(state.flags.debugEnabled, true);
  assert.equal(state.flags.a2ajEnabled, false);
  assert.equal(state.runtimeBudget.maxToolCalls, 8);
  assert.equal(state.runtimeBudget.maxLiveFetches, 3);
  assert.equal(state.runtimeBudget.maxRetries, 1);
  assert.equal(state.graph.currentNode, 'classify');
});
