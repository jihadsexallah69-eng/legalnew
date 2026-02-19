import test from 'node:test';
import assert from 'node:assert/strict';

import {
  enforceStatuteGate,
  evaluateClauseRecall,
  extractCanonicalClauseKey,
} from '../statuteGate.js';

function source({
  id,
  text,
  authorityLevel = 'regulation',
  authorityLevelNum = 4,
  sectionId,
}) {
  return {
    id,
    text,
    authorityLevel,
    sectionId,
    raw: {
      authority_level: authorityLevel,
      authority_level_num: authorityLevelNum,
      section_id: sectionId,
    },
  };
}

test('extractCanonicalClauseKey parses explicit clause prompts', () => {
  assert.equal(
    extractCanonicalClauseKey('What does IRPA s.34(1)(c) say?'),
    'IRPA:34(1)(c)'
  );
  assert.equal(
    extractCanonicalClauseKey('What is required under IRPR 200(1)(b)?'),
    'IRPR:200(1)(b)'
  );
});

test('extractCanonicalClauseKey maps inadmissible terrorism heuristic', () => {
  assert.equal(
    extractCanonicalClauseKey('Inadmissible for terrorism under IRPA?'),
    'IRPA:34(1)(c)'
  );
});

test('statute gate recall passes when exact canonical clause in top-3 with authority level 4', () => {
  const check = evaluateClauseRecall({
    query: 'What does IRPA s.34(1)(c) say?',
    sources: [
      source({
        id: 'a',
        text: 'IRPA 34(1)(a)',
        sectionId: 'IRPA_34_1_a',
      }),
      source({
        id: 'c',
        text: 'IRPA 34(1)(c) engaging in terrorism',
        sectionId: 'IRPA_34_1_c',
      }),
      source({
        id: 'b',
        text: 'IRPA 34(1)(b)',
        sectionId: 'IRPA_34_1_b',
      }),
    ],
    topK: 3,
  });

  assert.equal(check.canonicalKey, 'IRPA:34(1)(c)');
  assert.equal(check.passed, true);
  assert.equal(check.reason, 'ok');
});

test('statute gate recall fails when top-3 misses exact canonical match', () => {
  const check = evaluateClauseRecall({
    query: 'What is required under IRPR 200(1)(b)?',
    sources: [
      source({
        id: 'a',
        text: 'IRPR 200(1)(a)',
        sectionId: 'IRPR_200_1_a',
      }),
      source({
        id: 'c',
        text: 'IRPR 200(1)(c)',
        sectionId: 'IRPR_200_1_c',
      }),
      source({
        id: 'd',
        text: 'IRPR 200(1)(d)',
        sectionId: 'IRPR_200_1_d',
      }),
    ],
    topK: 3,
  });

  assert.equal(check.canonicalKey, 'IRPR:200(1)(b)');
  assert.equal(check.passed, false);
  assert.equal(check.reason, 'canonical_not_in_top_k');
});

test('statute gate recall fails when authority level is not 4', () => {
  const check = evaluateClauseRecall({
    query: 'What does IRPA s.34(1)(c) say?',
    sources: [
      source({
        id: 'c',
        text: 'IRPA 34(1)(c) engaging in terrorism',
        sectionId: 'IRPA_34_1_c',
        authorityLevel: 'policy',
        authorityLevelNum: 2,
      }),
    ],
    topK: 3,
  });

  assert.equal(check.passed, false);
  assert.equal(check.reason, 'missing_authority_level_4');
});

test('enforceStatuteGate retries with binding-only retrieval and passes on retry', async () => {
  const initialGrounding = {
    pinecone: [
      source({
        id: 'a',
        text: 'IRPR 200(1)(a)',
        sectionId: 'IRPR_200_1_a',
      }),
    ],
    retrieval: {},
  };

  const result = await enforceStatuteGate({
    query: 'What is required under IRPR 200(1)(b)?',
    grounding: initialGrounding,
    topK: 6,
    retrieveBindingGrounding: async () => ({
      pinecone: [
        source({
          id: 'b',
          text: 'IRPR 200(1)(b) officer requirements',
          sectionId: 'IRPR_200_1_b',
        }),
      ],
      retrieval: { mode: 'binding_gate' },
    }),
  });

  assert.equal(result.status, 'pass');
  assert.equal(result.rerunUsed, true);
  assert.equal(result.check.canonicalKey, 'IRPR:200(1)(b)');
});

test('enforceStatuteGate fails hard when retry still lacks required binding clause', async () => {
  const result = await enforceStatuteGate({
    query: 'Inadmissible for terrorism under IRPA?',
    grounding: { pinecone: [], retrieval: {} },
    topK: 6,
    retrieveBindingGrounding: async () => ({
      pinecone: [
        source({
          id: 'a',
          text: 'IRPA 34(1)(a)',
          sectionId: 'IRPA_34_1_a',
        }),
      ],
      retrieval: { mode: 'binding_gate' },
    }),
  });

  assert.equal(result.status, 'fail');
  assert.equal(result.rerunUsed, true);
  assert.equal(result.check.canonicalKey, 'IRPA:34(1)(c)');
});
