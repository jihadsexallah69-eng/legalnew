import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from 'cheerio';
import { linearizeTable } from '../sectionize.js';

test('linearizes tables with headers and caption', () => {
  const html = `
    <table>
      <caption>Fees</caption>
      <tr><th>Type</th><th>Amount</th></tr>
      <tr><td>Work permit</td><td>$155</td></tr>
      <tr><td>Study permit</td><td>$150</td></tr>
    </table>
  `;

  const $ = load(html);
  const table = $('table').first().get(0);
  const out = linearizeTable($, table);

  assert.match(out, /^Table: Fees/m);
  assert.match(out, /Type: Work permit \| Amount: \$155/);
  assert.match(out, /Type: Study permit \| Amount: \$150/);
});

test('linearizes tables without headers', () => {
  const html = `
    <table>
      <tr><td>A</td><td>B</td></tr>
      <tr><td>1</td><td>2</td></tr>
    </table>
  `;

  const $ = load(html);
  const table = $('table').first().get(0);
  const out = linearizeTable($, table);

  assert.match(out, /^Table:/m);
  assert.match(out, /A \| B/);
  assert.match(out, /1 \| 2/);
});
