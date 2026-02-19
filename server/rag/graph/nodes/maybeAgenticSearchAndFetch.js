import { incrementBudgetUsage } from '../budgets.js';

export async function maybeAgenticSearchAndFetchNode(state, deps) {
  if (state.control.terminate) return state;

  deps.startRunTracePhase(state.runTrace, 'ROUTING', {
    a2aj_enabled: state.flags.a2ajEnabled,
    a2aj_case_law_enabled: state.flags.a2ajCaseLawEnabled,
    a2aj_legislation_enabled: state.flags.a2ajLegislationEnabled,
  });

  incrementBudgetUsage(state.runtimeBudget, 'usedToolCalls', 1);
  const routeDecision = await deps.routeIntent({
    message: state.request.effectiveMessage,
    a2ajEnabled: state.flags.a2ajEnabled,
    a2ajCaseLawEnabled: state.flags.a2ajCaseLawEnabled,
    a2ajLegislationEnabled: state.flags.a2ajLegislationEnabled,
  });
  state.routing.decision = routeDecision;

  deps.completeRunTracePhase(state.runTrace, 'ROUTING', {
    outputs: {
      use_case_law: Boolean(routeDecision?.useCaseLaw),
      use_legislation: Boolean(routeDecision?.useLegislation),
      route_limit: Number(routeDecision?.limit || 0),
    },
  });
  deps.appendRunTraceEvent(state.runTrace, 'retrieval_complete', {
    queryHash: state.retrieval?.grounding?.retrieval?.queryHash || '',
    filters: state.retrieval?.grounding?.retrieval?.filters || null,
    tiers: state.retrieval?.grounding?.retrieval?.tiers || null,
    topSourceIds: (state.retrieval?.grounding?.retrieval?.topSourceIds || [])
      .map((entry) => entry?.id)
      .filter(Boolean),
    routeDecision,
  });

  let caseLawSources = [];
  let a2ajSearchCount = 0;
  let a2ajEnrichAttempted = false;

  if (state.flags.a2ajEnabled && routeDecision?.useCaseLaw && state.flags.a2ajCaseLawEnabled) {
    try {
      incrementBudgetUsage(state.runtimeBudget, 'usedToolCalls', 1);
      incrementBudgetUsage(state.runtimeBudget, 'usedLiveFetches', 1);
      const searchResults = await deps.a2ajSearchDecisions({
        query: routeDecision?.query || state.request.effectiveMessage,
        limit: routeDecision?.limit || state.defaults.defaultA2ajTopK,
        filters: {
          courts: routeDecision?.courts,
          yearFrom: routeDecision?.yearFrom,
          yearTo: routeDecision?.yearTo,
        },
      });
      caseLawSources = deps.a2ajToCaseSources(searchResults).slice(0, routeDecision?.limit || state.defaults.defaultA2ajTopK);
      a2ajSearchCount = caseLawSources.length;

      a2ajEnrichAttempted = true;
      incrementBudgetUsage(state.runtimeBudget, 'usedToolCalls', 1);
      caseLawSources = await deps.a2ajEnrichCaseSources({
        sources: caseLawSources,
        query: state.request.effectiveMessage,
      });
    } catch (error) {
      console.warn('A2AJ retrieval failed; continuing with Pinecone-only grounding.', error?.message || error);
    }
  }

  if (caseLawSources.length > 0) {
    deps.appendRunTraceEvent(state.runTrace, 'live_fetch_complete', {
      source: 'a2aj',
      canonicalUrl: 'a2aj://case-law',
      retrievedAt: new Date().toISOString(),
      contentHash: '',
      allowlistResult: 'allow',
    });
  }

  state.sources.caseLaw = caseLawSources;
  state.metrics.a2ajSearchCount = a2ajSearchCount;
  state.metrics.a2ajEnrichAttempted = a2ajEnrichAttempted;
  return state;
}
