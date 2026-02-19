import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GRAPH_NODE_SEQUENCE,
  getDefaultNextNode,
  getInitialGraphNode,
  isValidGraphTransition,
  resolveNextGraphNode,
} from '../transitions.js';

test('graph transitions expose expected initial node and ordered sequence', () => {
  assert.equal(getInitialGraphNode(), 'classify');
  assert.equal(GRAPH_NODE_SEQUENCE[GRAPH_NODE_SEQUENCE.length - 1], 'finalize_response');
  assert.equal(getDefaultNextNode('classify'), 'parse_citation_query');
  assert.equal(getDefaultNextNode('rewrite_or_fail'), 'finalize_response');
});

test('resolveNextGraphNode jumps to finalize when state is terminated', () => {
  const next = resolveNextGraphNode({
    currentNode: 'classify',
    state: { control: { terminate: true } },
  });
  assert.equal(next, 'finalize_response');

  assert.equal(
    isValidGraphTransition({
      fromNode: 'classify',
      toNode: 'finalize_response',
      state: { control: { terminate: true } },
    }),
    true
  );
});

test('isValidGraphTransition rejects non-sequential transitions in normal flow', () => {
  assert.equal(
    isValidGraphTransition({
      fromNode: 'classify',
      toNode: 'retrieve_binding_tier',
      state: { control: { terminate: false } },
    }),
    false
  );

  assert.equal(
    isValidGraphTransition({
      fromNode: 'rewrite_or_fail',
      toNode: 'finalize_response',
      state: { control: { terminate: false } },
    }),
    true
  );
});
