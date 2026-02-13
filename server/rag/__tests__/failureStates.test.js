import test from 'node:test';
import assert from 'node:assert/strict';

import { failureStateCodes, getFailureStateInfo, resolveFailureState } from '../failureStates.js';

test('failureStates exposes all Phase 0 failure codes', () => {
  const codes = failureStateCodes();
  const expected = [
    'NONE',
    'NO_BINDING_AUTHORITY',
    'STALE_VOLATILE_SOURCE',
    'CITATION_MISMATCH',
    'OUT_OF_SCOPE_SOURCE',
    'BUDGET_EXCEEDED',
    'INSUFFICIENT_FACTS',
    'INSUFFICIENT_EVIDENCE',
  ];
  for (const code of expected) {
    assert.equal(codes.includes(code), true, `Missing code: ${code}`);
  }
});

test('failureStates resolves out-of-scope with highest priority', () => {
  const code = resolveFailureState({
    query: 'help me',
    outOfScopeBlocked: true,
    budget: { maxToolCalls: 1, usedToolCalls: 5 },
    guardIssues: ['no_binding_authority_found'],
  });
  assert.equal(code, 'OUT_OF_SCOPE_SOURCE');
});

test('failureStates resolves budget exceeded when usage exceeds limits', () => {
  const code = resolveFailureState({
    query: 'What is IRPR 179(b)?',
    budget: { maxToolCalls: 2, usedToolCalls: 3, maxLiveFetches: 1, usedLiveFetches: 0 },
    retrieval: { topSourceIds: [{ id: 'x' }] },
  });
  assert.equal(code, 'BUDGET_EXCEEDED');
});

test('failureStates maps guard issues deterministically', () => {
  assert.equal(
    resolveFailureState({ guardIssues: ['binding_claim_without_binding_citation'] }),
    'CITATION_MISMATCH'
  );
  assert.equal(
    resolveFailureState({ guardIssues: ['temporal_claim_without_effective_date'] }),
    'STALE_VOLATILE_SOURCE'
  );
  assert.equal(
    resolveFailureState({ guardIssues: ['no_binding_authority_found'] }),
    'NO_BINDING_AUTHORITY'
  );
});

test('failureStates emits insufficient evidence when retrieval and citations are empty', () => {
  const code = resolveFailureState({
    query: 'What is IRPA section 40?',
    retrieval: { topSourceIds: [] },
    citations: [],
  });
  assert.equal(code, 'INSUFFICIENT_EVIDENCE');
});

test('failureStates emits insufficient facts for vague requests', () => {
  const code = resolveFailureState({
    query: 'help me with my case',
    retrieval: { topSourceIds: [{ id: 'p1' }] },
    citations: [{ id: 'P1' }],
  });
  assert.equal(code, 'INSUFFICIENT_FACTS');
});

test('failureStates defaults to NONE when no failure criteria are present', () => {
  const code = resolveFailureState({
    query: 'What is IRPR 179(b)?',
    retrieval: { topSourceIds: [{ id: 'p1' }] },
    citations: [{ id: 'P1' }],
    budget: { maxToolCalls: 8, usedToolCalls: 3 },
  });
  assert.equal(code, 'NONE');
});

test('failureStates returns structured metadata info', () => {
  const info = getFailureStateInfo('NO_BINDING_AUTHORITY');
  assert.equal(info.code, 'NO_BINDING_AUTHORITY');
  assert.equal(info.retryPolicy, 'RETRY_WITH_BETTER_SOURCES');
});
