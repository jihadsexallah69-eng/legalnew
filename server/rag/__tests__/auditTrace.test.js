import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAuditRunTraceContract,
  completeRunTracePhase,
  finalizeRunTrace,
  startRunTrace,
  startRunTracePhase,
  summarizeRunTrace,
  validateAuditRunTraceContract,
} from '../auditTrace.js';

test('auditTrace builds schema-compatible contract with phases', () => {
  const trace = startRunTrace({
    sessionId: '11111111-1111-4111-8111-111111111111',
    userId: 'user-1',
    message: 'Test query about IRPA section 40',
    analysisDateBasis: 'explicit_as_of',
    asOfDate: '2026-02-13',
    includeRedactedMessage: true,
    topK: 6,
    budgets: { maxToolCalls: 8, maxLiveFetches: 3, maxRetries: 1 },
    modelVersion: 'llama-3.3-70b-versatile',
  });

  startRunTracePhase(trace, 'RETRIEVAL', { top_k: 6 });
  completeRunTracePhase(trace, 'RETRIEVAL', {
    outputs: { pinecone_count: 4, tier_a_count: 2, tier_b_count: 2, tier_c_count: 0 },
  });

  startRunTracePhase(trace, 'ROUTING', { use_a2aj: false });
  completeRunTracePhase(trace, 'ROUTING', {
    outputs: { use_case_law: false },
    status: 'SUCCESS',
  });

  finalizeRunTrace(trace, {
    status: 'ok',
    responseText: 'IRPA section 40 addresses misrepresentation [P1].',
    citations: [{ id: 'P1' }],
  });

  const contract = buildAuditRunTraceContract(trace);
  const validation = validateAuditRunTraceContract(contract);

  assert.equal(validation.valid, true);
  assert.equal(contract.as_of, '2026-02-13');
  assert.equal(typeof contract.run_id, 'string');
  assert.equal(contract.run_id.length, 26);
  assert.equal(Array.isArray(contract.phases), true);
  assert.equal(contract.phases.length >= 1, true);
  assert.equal(contract.metadata.retrieval_top_k, 6);
});

test('auditTrace validator rejects invalid contracts', () => {
  const invalid = {
    trace_id: '',
    run_id: 'not-a-ulid',
    query: '',
    as_of: '13-02-2026',
    phases: [],
  };

  const validation = validateAuditRunTraceContract(invalid);

  assert.equal(validation.valid, false);
  assert.equal(validation.errors.length > 0, true);
});

test('auditTrace summary includes contract validation snapshot', () => {
  const trace = startRunTrace({
    sessionId: '22222222-2222-4222-8222-222222222222',
    message: 'Study permit question',
    topK: 5,
  });

  startRunTracePhase(trace, 'GENERATION', { model: 'llama-3.3-70b-versatile' });
  completeRunTracePhase(trace, 'GENERATION', {
    outputs: { response_chars: 128 },
  });

  finalizeRunTrace(trace, {
    status: 'ok',
    responseText: 'Summary response.',
    citations: [],
  });

  const summary = summarizeRunTrace(trace);

  assert.equal(typeof summary.runId, 'string');
  assert.equal(typeof summary.contractValidation, 'object');
  assert.equal(summary.contractValidation.valid, true);
  assert.equal(Array.isArray(summary.phaseStatuses), true);
  assert.equal(summary.phaseStatuses.length >= 1, true);
});

test('auditTrace: success path with all phases', () => {
  const trace = startRunTrace({
    sessionId: '33333333-3333-4333-8333-333333333333',
    userId: 'user-success',
    message: 'Express Entry eligibility',
    analysisDateBasis: 'today',
    asOfDate: '2026-02-13',
    topK: 10,
  });

  const phases = ['RETRIEVAL', 'ROUTING', 'GROUNDING', 'GENERATION', 'VALIDATION', 'RESPONSE_GUARD'];
  for (const phase of phases) {
    startRunTracePhase(trace, phase, { input: 'test' });
    completeRunTracePhase(trace, phase, { outputs: { success: true }, status: 'SUCCESS' });
  }

  finalizeRunTrace(trace, {
    status: 'ok',
    responseText: 'Eligible for Express Entry.',
    citations: [{ id: 'P1' }, { id: 'P2' }],
  });

  const contract = buildAuditRunTraceContract(trace);
  const validation = validateAuditRunTraceContract(contract);

  assert.equal(validation.valid, true);
  assert.equal(contract.phases.length, 6);
  assert.equal(contract.phases.every(p => p.status === 'SUCCESS'), true);
  assert.equal(contract.as_of, '2026-02-13');
});

test('auditTrace: blocked/out-of-scope path', () => {
  const trace = startRunTrace({
    sessionId: '44444444-4444-4444-8444-444444444444',
    userId: 'user-blocked',
    message: 'Tell me about immigration to USA',
    analysisDateBasis: 'today',
    asOfDate: '2026-02-13',
    topK: 5,
  });

  startRunTracePhase(trace, 'RETRIEVAL', { top_k: 5 });
  completeRunTracePhase(trace, 'RETRIEVAL', {
    outputs: { sources_count: 0, blocked: true, reason: 'OUT_OF_SCOPE_QUERY' },
    status: 'SUCCESS',
  });

  finalizeRunTrace(trace, {
    status: 'blocked',
    responseText: 'This query is outside the scope of Canadian immigration.',
    citations: [],
  });

  const contract = buildAuditRunTraceContract(trace);
  const validation = validateAuditRunTraceContract(contract);

  assert.equal(validation.valid, true);
  assert.equal(contract.phases.some(p => p.outputs?.blocked === true), true);
});

test('auditTrace: exception path with errors', () => {
  const trace = startRunTrace({
    sessionId: '55555555-5555-4555-8555-555555555555',
    userId: 'user-error',
    message: 'What are the CRS requirements?',
    analysisDateBasis: 'today',
    asOfDate: '2026-02-13',
    topK: 5,
  });

  startRunTracePhase(trace, 'RETRIEVAL', { top_k: 5 });
  completeRunTracePhase(trace, 'RETRIEVAL', {
    errors: [{ code: 'RETRIEVAL_ERROR', message: 'Pinecone timeout' }],
    status: 'FAILED',
  });

  finalizeRunTrace(trace, {
    status: 'error',
    responseText: 'Unable to retrieve information.',
    citations: [],
  });

  const contract = buildAuditRunTraceContract(trace);
  const validation = validateAuditRunTraceContract(contract);
  const retrievalPhase = contract.phases.find(p => p.phase_name === 'RETRIEVAL');

  assert.equal(validation.valid, true);
  assert.equal(retrievalPhase.status, 'FAILED');
  assert.equal(retrievalPhase.errors?.length > 0, true);
});

test('auditTrace: contract-invalid payload detection', () => {
  const invalidContract1 = {
    trace_id: 'trace-1',
    run_id: 'INVALID_ULID',
    query: 'Test',
    as_of: 'invalid-date',
    phases: [],
  };

  const validation1 = validateAuditRunTraceContract(invalidContract1);
  assert.equal(validation1.valid, false);
  assert.equal(validation1.errors.some(e => e.includes('run_id')), true);

  const invalidContract2 = {
    trace_id: 'trace-2',
    run_id: '01HW3V8XK4Z5Y2J3M7P9Q0R2S6',
    query: 'Test',
    as_of: '2026-02-13',
    phases: [{ phase_name: 'INVALID_PHASE' }],
  };

  const validation2 = validateAuditRunTraceContract(invalidContract2);
  assert.equal(validation2.valid, false);
  assert.equal(validation2.errors.some(e => e.includes('phase_name')), true);

  const invalidContract3 = {
    trace_id: 'trace-3',
    run_id: '01HW3V8XK4Z5Y2J3M7P9Q0R2S6',
    query: 'Test',
    as_of: '2026-02-13',
    phases: [{ phase_name: 'RETRIEVAL', status: 'INVALID_STATUS' }],
  };

  const validation3 = validateAuditRunTraceContract(invalidContract3);
  assert.equal(validation3.valid, false);
});

test('auditTrace: run_id is valid ULID format', () => {
  const trace = startRunTrace({
    sessionId: '66666666-6666-4666-8666-666666666666',
    message: 'PNP requirements',
    topK: 5,
  });

  finalizeRunTrace(trace, { status: 'ok', responseText: 'Test', citations: [] });

  const contract = buildAuditRunTraceContract(trace);

  assert.equal(/^[0-9A-Z]{26}$/.test(contract.run_id), true);
  assert.equal(contract.run_id.length, 26);
});

test('auditTrace: required phases present', () => {
  const trace = startRunTrace({
    sessionId: '77777777-7777-4777-8777-777777777777',
    message: 'Work permit question',
    topK: 5,
  });

  startRunTracePhase(trace, 'RETRIEVAL', {});
  completeRunTracePhase(trace, 'RETRIEVAL', { outputs: {} });

  startRunTracePhase(trace, 'GENERATION', {});
  completeRunTracePhase(trace, 'GENERATION', { outputs: {} });

  finalizeRunTrace(trace, { status: 'ok', responseText: 'Test', citations: [] });

  const contract = buildAuditRunTraceContract(trace);

  assert.equal(contract.phases.some(p => p.phase_name === 'RETRIEVAL'), true);
  assert.equal(contract.phases.some(p => p.phase_name === 'GENERATION'), true);
});

test('auditTrace: as_of format is YYYY-MM-DD', () => {
  const trace = startRunTrace({
    sessionId: '88888888-8888-4888-8888-888888888888',
    message: 'Family sponsorship',
    analysisDateBasis: 'explicit_as_of',
    asOfDate: '2025-12-25',
    topK: 5,
  });

  finalizeRunTrace(trace, { status: 'ok', responseText: 'Test', citations: [] });

  const contract = buildAuditRunTraceContract(trace);

  assert.equal(/^\d{4}-\d{2}-\d{2}$/.test(contract.as_of), true);
  assert.equal(contract.as_of, '2025-12-25');
});
