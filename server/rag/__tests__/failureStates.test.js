import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applyFailureStateNotice,
  failureStateCodes,
  failureStatePrecedence,
  getFailureStateInfo,
  resolveFailureState,
} from '../failureStates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const MATRIX_PATH = join(PROJECT_ROOT, 'eval', 'failure_state_matrix.json');

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

test('failureStates prepends user-facing notice for actionable failure states', () => {
  const out = applyFailureStateNotice(
    'Binding authority says: unavailable in current retrieval set.',
    'NO_BINDING_AUTHORITY'
  );
  assert.equal(
    out.startsWith('No binding authority found in indexed sources for this question.'),
    true
  );
});

test('failureStates does not prepend notice for NONE', () => {
  const text = 'Answer body';
  const out = applyFailureStateNotice(text, 'NONE');
  assert.equal(out, text);
});

test('failureStates exposes deterministic precedence order', () => {
  const order = failureStatePrecedence();
  assert.deepEqual(order, [
    'OUT_OF_SCOPE_SOURCE',
    'BUDGET_EXCEEDED',
    'CITATION_MISMATCH',
    'STALE_VOLATILE_SOURCE',
    'NO_BINDING_AUTHORITY',
    'INSUFFICIENT_EVIDENCE',
    'INSUFFICIENT_FACTS',
    'NONE',
  ]);
});

test('failureStates: runtime matches eval/failure_state_matrix.json (J4 sync)', () => {
  const matrixContent = readFileSync(MATRIX_PATH, 'utf-8');
  const matrix = JSON.parse(matrixContent);
  
  const runtimeCodes = failureStateCodes();
  const matrixCodes = matrix.failure_states.map(s => s.code);
  
  assert.equal(
    runtimeCodes.length,
    matrixCodes.length,
    `Runtime has ${runtimeCodes.length} codes, matrix has ${matrixCodes.length}`
  );
  
  for (const code of runtimeCodes) {
    assert.equal(
      matrixCodes.includes(code),
      true,
      `Runtime code '${code}' not found in matrix`
    );
  }
  
  for (const code of matrixCodes) {
    assert.equal(
      runtimeCodes.includes(code),
      true,
      `Matrix code '${code}' not found in runtime`
    );
  }
});

test('failureStates: severity enum matches matrix (J4 sync)', () => {
  const matrixContent = readFileSync(MATRIX_PATH, 'utf-8');
  const matrix = JSON.parse(matrixContent);
  
  const severityEnums = ['ERROR', 'WARNING', 'INFO', 'N/A'];
  
  for (const state of matrix.failure_states) {
    const runtimeInfo = getFailureStateInfo(state.code);
    
    assert.equal(
      severityEnums.includes(state.severity),
      true,
      `Matrix severity '${state.severity}' for ${state.code} is not a valid enum`
    );
    
    assert.equal(
      runtimeInfo.severity,
      state.severity,
      `Severity mismatch for ${state.code}: runtime='${runtimeInfo.severity}' vs matrix='${state.severity}'`
    );
  }
});

test('failureStates: retry policy matches matrix (J4 sync)', () => {
  const matrixContent = readFileSync(MATRIX_PATH, 'utf-8');
  const matrix = JSON.parse(matrixContent);
  
  for (const state of matrix.failure_states) {
    const runtimeInfo = getFailureStateInfo(state.code);
    
    assert.equal(
      runtimeInfo.retryPolicy,
      state.retry_policy,
      `Retry policy mismatch for ${state.code}: runtime='${runtimeInfo.retryPolicy}' vs matrix='${state.retry_policy}'`
    );
  }
});
