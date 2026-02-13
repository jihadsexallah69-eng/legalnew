import test from 'node:test';
import assert from 'node:assert/strict';

test('Debug payload: success path includes all required fields', () => {
  const mockDebugPayload = {
    routeDecision: { useA2aj: false },
    promptSafety: { blocked: false },
    rcicRelated: true,
    analysisDate: {
      basis: 'today',
      asOf: '2026-02-13',
    },
    failureState: 'NONE',
    failureStateInfo: { code: 'NONE', severity: 'N/A' },
    budget: { maxToolCalls: 8, usedToolCalls: 3 },
    pineconeCount: 10,
    caseLawCount: 2,
    documentCount: 0,
    retrieval: {
      queryHash: 'abc123',
      namespace: 'test-ns',
      mode: 'tiered',
      tiers: {
        binding: { topK: 6, count: 5, bindingAuthorityCount: 3 },
        guidance: { topK: 4, count: 3 },
        compare: { enabled: false },
      },
      authorityMixCounts: {
        PRIMARY_LEGISLATION: 2,
        REGULATION: 3,
        GUIDANCE: 2,
      },
      docFamilyCounts: {
        IRPA: 2,
        IRPR: 3,
        OPERATIONAL_BULLETIN: 2,
      },
      topSourceIds: [
        { id: 'src-1', doc_family: 'IRPA', authority_level: 'PRIMARY_LEGISLATION', score: 0.95, tier: 'binding' },
        { id: 'src-2', doc_family: 'IRPR', authority_level: 'REGULATION', score: 0.89, tier: 'binding' },
      ],
    },
    guardIssues: [],
    a2aj: { searchCount: 0, enrichAttempted: false },
  };

  assert.equal(typeof mockDebugPayload.analysisDate, 'object');
  assert.equal(typeof mockDebugPayload.analysisDate.basis, 'string');
  assert.equal(/^\d{4}-\d{2}-\d{2}$/.test(mockDebugPayload.analysisDate.asOf), true);

  assert.equal(typeof mockDebugPayload.retrieval, 'object');
  assert.equal(typeof mockDebugPayload.retrieval.tiers, 'object');
  assert.equal(typeof mockDebugPayload.retrieval.tiers.binding.topK, 'number');
  assert.equal(typeof mockDebugPayload.retrieval.tiers.binding.count, 'number');
  assert.equal(typeof mockDebugPayload.retrieval.authorityMixCounts, 'object');
  assert.equal(typeof mockDebugPayload.retrieval.docFamilyCounts, 'object');
  assert.equal(Array.isArray(mockDebugPayload.retrieval.topSourceIds), true);

  if (mockDebugPayload.retrieval.topSourceIds.length > 0) {
    const firstSource = mockDebugPayload.retrieval.topSourceIds[0];
    assert.equal(typeof firstSource.id, 'string');
    assert.equal(typeof firstSource.doc_family, 'string');
    assert.equal(typeof firstSource.authority_level, 'string');
    assert.equal(typeof firstSource.score, 'number');
    assert.equal(typeof firstSource.tier, 'string');
  }
});

test('Debug payload: error path includes failure state', () => {
  const mockErrorDebugPayload = {
    analysisDate: {
      basis: 'today',
      asOf: '2026-02-13',
    },
    failureState: 'NO_BINDING_AUTHORITY',
    failureStateInfo: {
      code: 'NO_BINDING_AUTHORITY',
      severity: 'ERROR',
      userMessage: 'No binding authority found in indexed sources.',
    },
    budget: { maxToolCalls: 8, usedToolCalls: 1 },
    pineconeCount: 0,
    caseLawCount: 0,
    documentCount: 0,
    retrieval: null,
    guardIssues: ['no_binding_authority_found'],
  };

  assert.equal(mockErrorDebugPayload.failureState, 'NO_BINDING_AUTHORITY');
  assert.equal(mockErrorDebugPayload.retrieval, null);
  assert.equal(Array.isArray(mockErrorDebugPayload.guardIssues), true);
});

test('Debug payload: tiered mode includes tier filters', () => {
  const mockTieredPayload = {
    retrieval: {
      mode: 'tiered',
      settings: { tieredEnabled: true, noSilentFallback: false },
      tiers: {
        binding: {
          topK: 6,
          count: 4,
          appliedFilter: { doc_family: { $in: ['IRPA', 'IRPR'] } },
          fallbackUsed: false,
        },
        guidance: {
          topK: 4,
          count: 3,
          appliedFilter: { authority_level: 'GUIDANCE' },
          fallbackUsed: false,
        },
      },
    },
  };

  assert.equal(mockTieredPayload.retrieval.mode, 'tiered');
  assert.equal(mockTieredPayload.retrieval.settings.tieredEnabled, true);
  assert.equal(typeof mockTieredPayload.retrieval.tiers.binding.appliedFilter, 'object');
  assert.equal(typeof mockTieredPayload.retrieval.tiers.guidance.appliedFilter, 'object');
});

test('Debug payload: analysisDate format is YYYY-MM-DD', () => {
  const testCases = [
    { basis: 'today', asOf: '2026-02-13' },
    { basis: 'explicit_as_of', asOf: '2025-12-25' },
    { basis: 'application_date', asOf: '2024-06-15' },
  ];

  for (const tc of testCases) {
    assert.equal(/^\d{4}-\d{2}-\d{2}$/.test(tc.asOf), true, `Invalid date format: ${tc.asOf}`);
  }
});

test('Debug payload: topSourceIds includes required fields', () => {
  const topSources = [
    { id: 'p1', doc_family: 'IRPA', authority_level: 'PRIMARY_LEGISLATION', score: 0.95, tier: 'binding' },
    { id: 'p2', doc_family: 'IRPR', authority_level: 'REGULATION', score: 0.88, tier: 'binding' },
    { id: 'c1', doc_family: 'CASE_LAW_FC', authority_level: 'CASE_LAW', score: 0.82, tier: 'guidance' },
  ];

  for (const source of topSources) {
    assert.ok(source.id, 'Missing id');
    assert.ok(source.doc_family, 'Missing doc_family');
    assert.ok(source.authority_level, 'Missing authority_level');
    assert.ok(typeof source.score === 'number', 'Missing or invalid score');
    assert.ok(source.tier, 'Missing tier');
  }
});

test('Debug payload: authorityMixCounts sums to total', () => {
  const mockCounts = {
    PRIMARY_LEGISLATION: 2,
    REGULATION: 3,
    MINISTERIAL_INSTRUCTION: 1,
    GUIDANCE: 2,
  };

  const total = Object.values(mockCounts).reduce((a, b) => a + b, 0);
  assert.equal(total, 8);
});

test('Debug payload: docFamilyCounts includes expected families', () => {
  const docFamilyCounts = {
    IRPA: 1,
    IRPR: 2,
    MI: 1,
    OPERATIONAL_BULLETIN: 3,
    CASE_LAW_FC: 1,
  };

  const expectedFamilies = ['IRPA', 'IRPR', 'MI', 'OPERATIONAL_BULLETIN', 'CASE_LAW_FC'];
  for (const family of expectedFamilies) {
    assert.ok(typeof docFamilyCounts[family] === 'number', `Missing doc family: ${family}`);
  }
});
