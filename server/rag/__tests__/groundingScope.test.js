import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildScopeFilter,
  buildTierFilters,
  inferQueryProfile,
} from '../grounding.js';

function collectScopePredicates(filter, out = []) {
  if (!filter || typeof filter !== 'object') return out;

  if (Object.prototype.hasOwnProperty.call(filter, 'scope')) {
    out.push(filter.scope);
  }

  const andList = Array.isArray(filter.$and) ? filter.$and : [];
  for (const clause of andList) {
    collectScopePredicates(clause, out);
  }
  const orList = Array.isArray(filter.$or) ? filter.$or : [];
  for (const clause of orList) {
    collectScopePredicates(clause, out);
  }

  return out;
}

function hasScopeEq(filter, value) {
  return collectScopePredicates(filter).some((pred) => pred && pred.$eq === value);
}

function hasScopeExistsFalse(filter) {
  return collectScopePredicates(filter).some((pred) => pred && pred.$exists === false);
}

test('default legal-requirement query stays in default scope', () => {
  const profile = inferQueryProfile('What is required under IRPR 200(1)(b)?');
  assert.equal(profile.scopeIntent, 'default');

  const { bindingFilter, guidanceFilter } = buildTierFilters(profile);
  assert.equal(hasScopeEq(bindingFilter, 'default'), true);
  assert.equal(hasScopeEq(guidanceFilter, 'default'), true);
  assert.equal(hasScopeExistsFalse(bindingFilter), true);
  assert.equal(hasScopeExistsFalse(guidanceFilter), true);
});

test('glossary intent uses glossary scope only', () => {
  const profile = inferQueryProfile('What does IRPA stand for?');
  assert.equal(profile.scopeIntent, 'glossary');

  const scopeFilter = buildScopeFilter(profile);
  const { guidanceFilter } = buildTierFilters(profile);

  assert.deepEqual(scopeFilter, { scope: { $eq: 'glossary' } });
  assert.equal(hasScopeEq(guidanceFilter, 'glossary'), true);
  assert.equal(hasScopeEq(guidanceFilter, 'default'), false);
  assert.equal(hasScopeExistsFalse(guidanceFilter), false);
});

test('links intent uses links scope', () => {
  const profile = inferQueryProfile('Where can I find useful links for ENF resources?');
  assert.equal(profile.scopeIntent, 'links');

  const { guidanceFilter } = buildTierFilters(profile);
  assert.equal(hasScopeEq(guidanceFilter, 'links'), true);
  assert.equal(hasScopeEq(guidanceFilter, 'default'), false);
});

test('toc intent uses toc scope', () => {
  const profile = inferQueryProfile('Show me the table of contents for ENF 1');
  assert.equal(profile.scopeIntent, 'toc');

  const { guidanceFilter } = buildTierFilters(profile);
  assert.equal(hasScopeEq(guidanceFilter, 'toc'), true);
  assert.equal(hasScopeEq(guidanceFilter, 'default'), false);
});
