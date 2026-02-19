function buildBlockedDebugPayload(state, deps, failureState, failureStateInfo, auditTraceContract, auditTraceContractValidation) {
  return {
    promptSafety: state.request.promptSafety,
    rcicRelated: state.request.rcicRelated,
    analysisDate: {
      basis: state.request.analysisDateBasis,
      asOf: state.request.asOfDate,
    },
    failureState,
    failureStateInfo,
    auditTrace: deps.summarizeRunTrace(state.runTrace),
    auditTraceContract,
    auditTraceContractValidation,
  };
}

function buildSuccessDebugPayload(state, deps, auditTraceContract, auditTraceContractValidation) {
  return {
    routeDecision: state.routing.decision,
    promptSafety: state.request.promptSafety,
    rcicRelated: state.request.rcicRelated,
    analysisDate: {
      basis: state.request.analysisDateBasis,
      asOf: state.request.asOfDate,
    },
    failureState: state.response.failureState,
    failureStateInfo: state.response.failureStateInfo,
    budget: state.runtimeBudget,
    pineconeCount: Array.isArray(state.retrieval?.grounding?.pinecone) ? state.retrieval.grounding.pinecone.length : 0,
    caseLawCount: state.sources.caseLaw.length,
    documentCount: state.sources.documents.length,
    retrieval: state.retrieval?.grounding?.retrieval || null,
    guardIssues: state.guard.issues,
    a2aj: {
      searchCount: state.metrics.a2ajSearchCount,
      enrichAttempted: state.metrics.a2ajEnrichAttempted,
      fetchTopK: Number(process.env.A2AJ_FETCH_DETAILS_TOP_K) || 3,
    },
    auditTrace: deps.summarizeRunTrace(state.runTrace),
    auditTraceContract,
    auditTraceContractValidation,
  };
}

export async function finalizeResponseNode(state, deps) {
  let finalResponseText = state.response.text;
  let citations = Array.isArray(state.response.citations) ? state.response.citations : [];
  let failureState = state.response.failureState || 'NONE';
  let failureStateInfo = state.response.failureStateInfo || deps.getFailureStateInfo(failureState);

  if (state.control.blocked) {
    finalResponseText = deps.prependAnalysisDateHeader(state.response.blockedText, {
      analysisDateBasis: state.request.analysisDateBasis,
      asOfDate: state.request.asOfDate,
    });
    citations = [];
    failureState = deps.resolveFailureState({
      query: state.request.effectiveMessage,
      outOfScopeBlocked: true,
      budget: state.runtimeBudget,
    });
    failureStateInfo = deps.getFailureStateInfo(failureState);
    deps.appendRunTraceEvent(state.runTrace, 'failure_state', { failureState });
    state.response.failureState = failureState;
    state.response.failureStateInfo = failureStateInfo;
  }

  deps.finalizeRunTrace(state.runTrace, {
    status: 'ok',
    responseText: finalResponseText,
    citations,
  });

  const auditTraceContract = state.runTrace
    ? deps.buildAuditRunTraceContract(state.runTrace)
    : null;
  const auditTraceContractValidation = auditTraceContract
    ? deps.validateAuditRunTraceContract(auditTraceContract)
    : null;
  if (state.runTrace && state.flags.auditTraceEnabled && state.flags.auditTracePersistLog) {
    deps.persistRunTraceLog(state.runTrace, {
      sampleRate: state.flags.auditTraceSampleRate,
    });
  }

  const payload = {
    text: finalResponseText,
    citations,
    sessionId: state.request.sessionId,
    ...(state.flags.debugEnabled
      ? {
          debug: state.control.blocked
            ? buildBlockedDebugPayload(state, deps, failureState, failureStateInfo, auditTraceContract, auditTraceContractValidation)
            : buildSuccessDebugPayload(state, deps, auditTraceContract, auditTraceContractValidation),
        }
      : {}),
  };

  state.outputs = {
    statusCode: 200,
    text: finalResponseText,
    citations,
    payload,
  };

  return state;
}
