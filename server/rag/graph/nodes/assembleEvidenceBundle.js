export async function assembleEvidenceBundleNode(state, deps) {
  if (state.control.terminate) return state;

  let documentSources = [];
  try {
    documentSources = await state.callbacks.loadDocumentSources({
      query: state.request.effectiveMessage,
    });
  } catch (error) {
    console.warn('Document grounding failed; continuing without document sources.', error?.message || error);
    documentSources = [];
  }
  state.sources.documents = Array.isArray(documentSources) ? documentSources : [];

  deps.startRunTracePhase(state.runTrace, 'GROUNDING', {
    history_count: Array.isArray(state.request.history) ? state.request.history.length : 0,
    prior_case_law_count: state.sources.caseLaw.length,
    prior_document_count: state.sources.documents.length,
  });

  const prompt = deps.buildPrompt({
    query: state.request.effectiveMessage,
    grounding: {
      ...(state.retrieval.grounding || {}),
      caseLaw: state.sources.caseLaw,
      documents: state.sources.documents,
    },
    history: state.request.history,
  });
  state.prompt.system = prompt.system;
  state.prompt.user = prompt.user;
  state.prompt.citationMap = prompt.citationMap || {};

  deps.completeRunTracePhase(state.runTrace, 'GROUNDING', {
    outputs: {
      citation_map_size: Object.keys(state.prompt.citationMap || {}).length,
      case_law_count: state.sources.caseLaw.length,
      document_count: state.sources.documents.length,
    },
  });
  deps.appendRunTraceEvent(state.runTrace, 'prompt_built', deps.buildPromptHashes({
    systemPrompt: state.prompt.system,
    userPrompt: state.prompt.user,
  }));
  return state;
}
