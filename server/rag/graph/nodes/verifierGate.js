export async function verifierGateNode(state, deps) {
  if (state.control.terminate) return state;

  deps.startRunTracePhase(state.runTrace, 'RESPONSE_GUARD');

  const validatedText = deps.validateCitationTokens(
    state.generation.text,
    state.prompt.citationMap
  );
  const guardResult = deps.enforceAuthorityGuard({
    text: validatedText,
    citationMap: state.prompt.citationMap,
    retrieval: state.retrieval?.grounding?.retrieval,
  });

  const guardFailureState = deps.resolveFailureState({
    query: state.request.effectiveMessage,
    guardIssues: guardResult.issues,
    retrieval: state.retrieval?.grounding?.retrieval,
    citations: [],
    budget: state.runtimeBudget,
  });

  state.guard = {
    text: guardResult.text,
    issues: guardResult.issues,
    failureState: guardFailureState,
  };

  deps.completeRunTracePhase(state.runTrace, 'RESPONSE_GUARD', {
    status: guardFailureState !== 'NONE' ? 'PARTIAL' : 'SUCCESS',
    outputs: {
      guard_issue_count: Array.isArray(guardResult?.issues) ? guardResult.issues.length : 0,
      failure_state: guardFailureState,
    },
  });
  return state;
}
