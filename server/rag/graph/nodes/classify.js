export async function classifyNode(state, deps) {
  deps.appendRunTraceEvent(state.runTrace, 'input_safety', {
    detected: Boolean(state.request.promptSafety?.detected),
    rcicRelated: state.request.rcicRelated,
    sanitized: state.request.sanitizedMessage !== state.request.message,
  });

  const promptBlocked = Boolean(state.flags.promptInjectionBlockingEnabled)
    && Boolean(state.request.promptSafety?.detected)
    && !Boolean(state.request.rcicRelated);

  if (!promptBlocked) {
    return state;
  }

  deps.startRunTracePhase(state.runTrace, 'ROUTING', {
    prompt_injection_detected: true,
    rcic_related: state.request.rcicRelated,
  });
  deps.completeRunTracePhase(state.runTrace, 'ROUTING', {
    status: 'FAILED',
    outputs: {
      blocked: true,
      reason: 'prompt_injection_out_of_scope',
    },
  });

  state.control.terminate = true;
  state.control.blocked = true;
  state.response.blockedText = 'I can only assist with RCIC-focused Canadian immigration research. Please rephrase your question without instruction-overrides.';
  return state;
}
