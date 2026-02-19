import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createRuntimeBudget,
  incrementBudgetUsage,
  isRuntimeBudgetExceeded,
} from '../budgets.js';

test('createRuntimeBudget normalizes numeric fields', () => {
  const budget = createRuntimeBudget({
    maxToolCalls: '8',
    maxLiveFetches: 3,
    maxRetries: 1,
    usedToolCalls: -2,
    usedLiveFetches: '2',
    usedRetries: null,
  });

  assert.equal(budget.maxToolCalls, 8);
  assert.equal(budget.maxLiveFetches, 3);
  assert.equal(budget.maxRetries, 1);
  assert.equal(budget.usedToolCalls, 0);
  assert.equal(budget.usedLiveFetches, 2);
  assert.equal(budget.usedRetries, 0);
});

test('incrementBudgetUsage increments known counters', () => {
  const budget = createRuntimeBudget({ maxToolCalls: 8 });
  incrementBudgetUsage(budget, 'usedToolCalls', 2);
  incrementBudgetUsage(budget, 'usedLiveFetches', 1);

  assert.equal(budget.usedToolCalls, 2);
  assert.equal(budget.usedLiveFetches, 1);
});

test('isRuntimeBudgetExceeded detects each budget class', () => {
  assert.equal(
    isRuntimeBudgetExceeded(createRuntimeBudget({
      maxToolCalls: 2,
      usedToolCalls: 3,
    })),
    true
  );

  assert.equal(
    isRuntimeBudgetExceeded(createRuntimeBudget({
      maxLiveFetches: 1,
      usedLiveFetches: 2,
    })),
    true
  );

  assert.equal(
    isRuntimeBudgetExceeded(createRuntimeBudget({
      maxRetries: 1,
      usedRetries: 2,
    })),
    true
  );

  assert.equal(
    isRuntimeBudgetExceeded(createRuntimeBudget({
      maxToolCalls: 5,
      usedToolCalls: 2,
      maxLiveFetches: 2,
      usedLiveFetches: 1,
    })),
    false
  );
});
