export const GRAPH_NODE_SEQUENCE = [
  'classify',
  'parse_citation_query',
  'retrieve_exact_cite_lookup',
  'retrieve_binding_tier',
  'retrieve_guidance_tier',
  'maybe_agentic_search_and_fetch',
  'assemble_evidence_bundle',
  'draft_answer_and_claim_ledger',
  'verifier_gate',
  'rewrite_or_fail',
  'finalize_response',
];

const NODE_SET = new Set(GRAPH_NODE_SEQUENCE);

function indexOfNode(nodeName) {
  return GRAPH_NODE_SEQUENCE.indexOf(nodeName);
}

export function getInitialGraphNode() {
  return GRAPH_NODE_SEQUENCE[0];
}

export function getDefaultNextNode(currentNode) {
  const idx = indexOfNode(currentNode);
  if (idx < 0) return null;
  return GRAPH_NODE_SEQUENCE[idx + 1] || null;
}

export function resolveNextGraphNode({ currentNode, state } = {}) {
  if (!NODE_SET.has(currentNode)) return null;
  if (state?.control?.terminate && currentNode !== 'finalize_response') {
    return 'finalize_response';
  }
  return getDefaultNextNode(currentNode);
}

export function isValidGraphTransition({ fromNode, toNode, state } = {}) {
  if (!NODE_SET.has(fromNode)) return false;
  if (toNode === null) return fromNode === 'finalize_response';
  if (!NODE_SET.has(toNode)) return false;

  if (state?.control?.terminate && fromNode !== 'finalize_response' && toNode === 'finalize_response') {
    return true;
  }

  return getDefaultNextNode(fromNode) === toNode;
}
