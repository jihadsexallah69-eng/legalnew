import { incrementBudgetUsage } from '../budgets.js';

export async function draftAnswerAndClaimLedgerNode(state, deps) {
  if (state.control.terminate) return state;

  deps.startRunTracePhase(state.runTrace, 'GENERATION', {
    model: state.defaults.model,
  });

  incrementBudgetUsage(state.runtimeBudget, 'usedToolCalls', 1);
  const { text } = await deps.groqAnswer({
    systemPrompt: state.prompt.system,
    userPrompt: state.prompt.user,
    model: state.defaults.model,
  });
  state.generation.text = String(text || '');

  deps.completeRunTracePhase(state.runTrace, 'GENERATION', {
    outputs: {
      response_chars: state.generation.text.length,
    },
  });
  return state;
}
