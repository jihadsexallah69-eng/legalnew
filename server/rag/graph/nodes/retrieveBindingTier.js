import { incrementBudgetUsage } from '../budgets.js';
import { enforceStatuteGate } from '../../statuteGate.js';

export async function retrieveBindingTierNode(state, deps) {
  if (state.control.terminate) return state;

  deps.startRunTracePhase(state.runTrace, 'RETRIEVAL', {
    top_k: state.request.topK,
    analysis_date_basis: state.request.analysisDateBasis,
    as_of_date: state.request.asOfDate,
  });

  incrementBudgetUsage(state.runtimeBudget, 'usedToolCalls', 1);
  const grounding = await deps.retrieveGrounding({
    query: state.request.effectiveMessage,
    topK: state.request.topK,
  });
  state.retrieval.grounding = grounding;

  const statuteGateResult = await enforceStatuteGate({
    query: state.request.effectiveMessage,
    grounding,
    topK: state.request.topK,
    retrieveBindingGrounding: async (params) => {
      incrementBudgetUsage(state.runtimeBudget, 'usedToolCalls', 1);
      return deps.retrieveBindingGrounding(params);
    },
  });
  deps.appendRunTraceEvent(state.runTrace, 'statute_gate', {
    status: statuteGateResult.status,
    rerunUsed: statuteGateResult.rerunUsed,
    reason: statuteGateResult?.check?.reason || '',
    canonicalKey: statuteGateResult?.check?.canonicalKey || '',
  });
  if (statuteGateResult?.rerunUsed && statuteGateResult?.grounding) {
    state.retrieval.grounding = statuteGateResult.grounding;
  }
  if (statuteGateResult?.status === 'fail') {
    const failureState = 'NO_BINDING_AUTHORITY';
    const failureStateInfo = deps.getFailureStateInfo(failureState);
    const failText = deps.prependAnalysisDateHeader(
      'No binding statute/regulation authority found for this legal-requirement question after binding-only retrieval.',
      {
        analysisDateBasis: state.request.analysisDateBasis,
        asOfDate: state.request.asOfDate,
      }
    );
    state.response.text = failText;
    state.response.citations = [];
    state.response.failureState = failureState;
    state.response.failureStateInfo = failureStateInfo;
    state.control.terminate = true;
    deps.appendRunTraceEvent(state.runTrace, 'failure_state', {
      failureState,
    });
  }

  deps.completeRunTracePhase(state.runTrace, 'RETRIEVAL', {
    outputs: {
      pinecone_count: Array.isArray(state.retrieval?.grounding?.pinecone) ? state.retrieval.grounding.pinecone.length : 0,
      tier_a_count: Number(state.retrieval?.grounding?.retrieval?.tiers?.binding?.count || 0),
      tier_b_count: Number(state.retrieval?.grounding?.retrieval?.tiers?.guidance?.count || 0),
      tier_c_count: Number(state.retrieval?.grounding?.retrieval?.tiers?.compare?.count || 0),
    },
  });
  return state;
}
