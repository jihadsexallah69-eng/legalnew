import { createRuntimeBudget } from './budgets.js';
import { getInitialGraphNode } from './transitions.js';

function toText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBoolean(value, fallback = false) {
  if (typeof value === 'undefined') return fallback;
  return Boolean(value);
}

export function createGraphState({
  message = '',
  effectiveMessage = '',
  sanitizedMessage = '',
  promptSafety = null,
  rcicRelated = false,
  sessionId = '',
  userId = null,
  history = [],
  topK = 6,
  analysisDateBasis = 'today',
  asOfDate = '',
  runtimeBudget = {},
  runTrace = null,
  defaultA2ajTopK = 4,
  model = '',
  flags = {},
  loadDocumentSources = null,
} = {}) {
  const normalizedBudget = createRuntimeBudget(runtimeBudget);
  return {
    graph: {
      currentNode: getInitialGraphNode(),
      completedNodes: [],
    },
    request: {
      message: toText(message),
      effectiveMessage: toText(effectiveMessage) || toText(message),
      sanitizedMessage: toText(sanitizedMessage),
      promptSafety: promptSafety && typeof promptSafety === 'object' ? promptSafety : { detected: false, score: 0, matches: [] },
      rcicRelated: toBoolean(rcicRelated, false),
      sessionId: toText(sessionId),
      userId: toText(userId) || null,
      history: Array.isArray(history) ? history : [],
      topK: Math.max(1, Math.floor(toNumber(topK, 6))),
      analysisDateBasis: toText(analysisDateBasis) || 'today',
      asOfDate: toText(asOfDate),
    },
    flags: {
      debugEnabled: toBoolean(flags.debugEnabled, false),
      promptInjectionBlockingEnabled: toBoolean(flags.promptInjectionBlockingEnabled, true),
      a2ajEnabled: toBoolean(flags.a2ajEnabled, true),
      a2ajCaseLawEnabled: toBoolean(flags.a2ajCaseLawEnabled, true),
      a2ajLegislationEnabled: toBoolean(flags.a2ajLegislationEnabled, false),
      auditTraceEnabled: toBoolean(flags.auditTraceEnabled, false),
      auditTracePersistLog: toBoolean(flags.auditTracePersistLog, true),
      auditTraceSampleRate: toNumber(flags.auditTraceSampleRate, 1),
    },
    defaults: {
      defaultA2ajTopK: Math.max(1, Math.floor(toNumber(defaultA2ajTopK, 4))),
      model: toText(model) || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    },
    callbacks: {
      loadDocumentSources: typeof loadDocumentSources === 'function'
        ? loadDocumentSources
        : async () => [],
    },
    runTrace,
    runtimeBudget: normalizedBudget,
    routing: {
      decision: null,
    },
    citationQuery: {
      detected: false,
      sectionKey: null,
      sectionId: null,
    },
    retrieval: {
      grounding: null,
      exactCitationLookup: null,
    },
    sources: {
      caseLaw: [],
      documents: [],
    },
    prompt: {
      system: '',
      user: '',
      citationMap: {},
    },
    generation: {
      text: '',
    },
    guard: {
      text: '',
      issues: [],
      failureState: 'NONE',
    },
    response: {
      text: '',
      citations: [],
      citationIds: [],
      failureState: 'NONE',
      failureStateInfo: null,
      blockedText: '',
    },
    metrics: {
      a2ajSearchCount: 0,
      a2ajEnrichAttempted: false,
    },
    control: {
      terminate: false,
      blocked: false,
    },
    outputs: {
      statusCode: 200,
      text: '',
      citations: [],
      payload: null,
    },
  };
}
