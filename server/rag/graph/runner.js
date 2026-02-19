import {
  a2ajEnrichCaseSources,
  a2ajSearchDecisions,
  a2ajToCaseSources,
} from '../../clients/a2aj.js';
import { groqAnswer } from '../../clients/groq.js';
import {
  appendRunTraceEvent,
  buildAuditRunTraceContract,
  buildPromptHashes,
  completeRunTracePhase,
  finalizeRunTrace,
  persistRunTraceLog,
  startRunTracePhase,
  summarizeRunTrace,
  validateAuditRunTraceContract,
} from '../auditTrace.js';
import { buildCitationFromSource } from '../citations.js';
import {
  applyFailureStateNotice,
  getFailureStateInfo,
  resolveFailureState,
} from '../failureStates.js';
import {
  buildPrompt,
  extractCitations,
  retrieveGrounding,
  retrieveBindingGrounding,
  validateCitationTokens,
} from '../grounding.js';
import { prependAnalysisDateHeader } from '../responsePolicy.js';
import { enforceAuthorityGuard } from '../responseGuard.js';
import { routeIntent } from '../router.js';
import { createGraphState } from './state.js';
import {
  getInitialGraphNode,
  isValidGraphTransition,
  resolveNextGraphNode,
} from './transitions.js';
import { assembleEvidenceBundleNode } from './nodes/assembleEvidenceBundle.js';
import { classifyNode } from './nodes/classify.js';
import { draftAnswerAndClaimLedgerNode } from './nodes/draftAnswerAndClaimLedger.js';
import { finalizeResponseNode } from './nodes/finalizeResponse.js';
import { maybeAgenticSearchAndFetchNode } from './nodes/maybeAgenticSearchAndFetch.js';
import { parseCitationQueryNode } from './nodes/parseCitationQuery.js';
import { retrieveBindingTierNode } from './nodes/retrieveBindingTier.js';
import { retrieveExactCiteLookupNode } from './nodes/retrieveExactCiteLookup.js';
import { retrieveGuidanceTierNode } from './nodes/retrieveGuidanceTier.js';
import { rewriteOrFailNode } from './nodes/rewriteOrFail.js';
import { verifierGateNode } from './nodes/verifierGate.js';

const NODE_HANDLERS = {
  classify: classifyNode,
  parse_citation_query: parseCitationQueryNode,
  retrieve_exact_cite_lookup: retrieveExactCiteLookupNode,
  retrieve_binding_tier: retrieveBindingTierNode,
  retrieve_guidance_tier: retrieveGuidanceTierNode,
  maybe_agentic_search_and_fetch: maybeAgenticSearchAndFetchNode,
  assemble_evidence_bundle: assembleEvidenceBundleNode,
  draft_answer_and_claim_ledger: draftAnswerAndClaimLedgerNode,
  verifier_gate: verifierGateNode,
  rewrite_or_fail: rewriteOrFailNode,
  finalize_response: finalizeResponseNode,
};

function buildDependencies(overrides = {}) {
  return {
    retrieveGrounding,
    retrieveBindingGrounding,
    routeIntent,
    a2ajSearchDecisions,
    a2ajToCaseSources,
    a2ajEnrichCaseSources,
    buildPrompt,
    buildPromptHashes,
    groqAnswer,
    validateCitationTokens,
    extractCitations,
    enforceAuthorityGuard,
    resolveFailureState,
    getFailureStateInfo,
    applyFailureStateNotice,
    prependAnalysisDateHeader,
    buildCitationFromSource,
    appendRunTraceEvent,
    startRunTracePhase,
    completeRunTracePhase,
    finalizeRunTrace,
    buildAuditRunTraceContract,
    validateAuditRunTraceContract,
    persistRunTraceLog,
    summarizeRunTrace,
    ...overrides,
  };
}

export async function runChatGraph(input = {}, dependencyOverrides = {}) {
  const deps = buildDependencies(dependencyOverrides);
  let state = createGraphState(input);
  let currentNode = getInitialGraphNode();

  while (currentNode) {
    const handler = NODE_HANDLERS[currentNode];
    if (typeof handler !== 'function') {
      throw new Error(`Graph runner missing node handler: ${currentNode}`);
    }

    state.graph.currentNode = currentNode;
    state = await handler(state, deps);
    state.graph.completedNodes.push(currentNode);

    const nextNode = resolveNextGraphNode({
      currentNode,
      state,
    });
    if (!nextNode) break;

    if (!isValidGraphTransition({
      fromNode: currentNode,
      toNode: nextNode,
      state,
    })) {
      throw new Error(`Graph runner invalid transition: ${currentNode} -> ${nextNode}`);
    }
    currentNode = nextNode;
  }

  if (!state.outputs?.payload) {
    throw new Error('Graph runner completed without payload.');
  }

  return state.outputs;
}
