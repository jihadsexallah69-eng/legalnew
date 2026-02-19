function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampNonNegativeInt(value, fallback = 0) {
  const n = Math.floor(toNumber(value, fallback));
  return n < 0 ? 0 : n;
}

export function createRuntimeBudget(initial = {}) {
  return {
    maxToolCalls: clampNonNegativeInt(initial.maxToolCalls, 0),
    maxLiveFetches: clampNonNegativeInt(initial.maxLiveFetches, 0),
    maxRetries: clampNonNegativeInt(initial.maxRetries, 0),
    usedToolCalls: clampNonNegativeInt(initial.usedToolCalls, 0),
    usedLiveFetches: clampNonNegativeInt(initial.usedLiveFetches, 0),
    usedRetries: clampNonNegativeInt(initial.usedRetries, 0),
  };
}

export function incrementBudgetUsage(runtimeBudget, key, delta = 1) {
  if (!runtimeBudget || typeof runtimeBudget !== 'object') return runtimeBudget;
  if (typeof key !== 'string' || !key.trim()) return runtimeBudget;
  const amount = clampNonNegativeInt(delta, 1);
  const field = key.trim();
  runtimeBudget[field] = clampNonNegativeInt(runtimeBudget[field], 0) + amount;
  return runtimeBudget;
}

export function isRuntimeBudgetExceeded(runtimeBudget = {}) {
  const maxToolCalls = clampNonNegativeInt(runtimeBudget.maxToolCalls, 0);
  const maxLiveFetches = clampNonNegativeInt(runtimeBudget.maxLiveFetches, 0);
  const maxRetries = clampNonNegativeInt(runtimeBudget.maxRetries, 0);
  const usedToolCalls = clampNonNegativeInt(runtimeBudget.usedToolCalls, 0);
  const usedLiveFetches = clampNonNegativeInt(runtimeBudget.usedLiveFetches, 0);
  const usedRetries = clampNonNegativeInt(runtimeBudget.usedRetries, 0);

  if (maxToolCalls > 0 && usedToolCalls > maxToolCalls) return true;
  if (maxLiveFetches > 0 && usedLiveFetches > maxLiveFetches) return true;
  if (maxRetries > 0 && usedRetries > maxRetries) return true;
  return false;
}
