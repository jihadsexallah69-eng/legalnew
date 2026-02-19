export async function rewriteOrFailNode(state, deps) {
  if (state.control.terminate) return state;

  deps.startRunTracePhase(state.runTrace, 'VALIDATION');

  const guardedText = deps.validateCitationTokens(state.guard.text, state.prompt.citationMap);
  const citationIds = deps.extractCitations(guardedText);
  const citations = citationIds
    .map((id) => deps.buildCitationFromSource(id, state.prompt.citationMap?.[id] || {}))
    .filter(Boolean);

  const failureState = deps.resolveFailureState({
    query: state.request.effectiveMessage,
    guardIssues: state.guard.issues,
    retrieval: state.retrieval?.grounding?.retrieval,
    citations,
    budget: state.runtimeBudget,
  });
  const failureStateInfo = deps.getFailureStateInfo(failureState);

  const responseWithFailureNotice = deps.applyFailureStateNotice(guardedText, failureState);
  const finalResponseText = deps.prependAnalysisDateHeader(responseWithFailureNotice, {
    analysisDateBasis: state.request.analysisDateBasis,
    asOfDate: state.request.asOfDate,
  });

  state.response.text = finalResponseText;
  state.response.citations = citations;
  state.response.citationIds = citationIds;
  state.response.failureState = failureState;
  state.response.failureStateInfo = failureStateInfo;

  deps.completeRunTracePhase(state.runTrace, 'VALIDATION', {
    outputs: {
      citation_id_count: citationIds.length,
      citation_count: citations.length,
    },
  });
  deps.appendRunTraceEvent(state.runTrace, 'validation_complete', {
    guardIssues: state.guard.issues,
    citationIds,
    failureState,
  });
  if (failureState && failureState !== 'NONE') {
    deps.appendRunTraceEvent(state.runTrace, 'failure_state', {
      failureState,
    });
  }

  return state;
}
