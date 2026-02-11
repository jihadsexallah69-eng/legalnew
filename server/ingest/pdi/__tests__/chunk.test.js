import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkSections, chunkTextWithOverlap } from '../chunk.js';

test('chunks text with overlap boundaries', () => {
  const text = 'maintained status guidance '.repeat(500);
  const chunks = chunkTextWithOverlap(text, { maxChars: 600, overlapChars: 120 });

  assert.ok(chunks.length > 1);

  chunks.forEach((chunk) => {
    assert.ok(chunk.text.length <= 600);
    assert.ok(chunk.end > chunk.start);
  });

  for (let i = 1; i < chunks.length; i += 1) {
    assert.ok(chunks[i].start < chunks[i - 1].end);
  }
});

test('preserves section metadata across chunked sections', () => {
  const sections = [
    {
      heading_path: ['Top', 'Sub'],
      top_heading: 'Top',
      anchor: '#a',
      text: 'x '.repeat(3000),
    },
  ];

  const chunks = chunkSections(sections, { maxChars: 700, overlapChars: 100 });
  assert.ok(chunks.length > 1);

  chunks.forEach((chunk, idx) => {
    assert.equal(chunk.section_index, 0);
    assert.equal(chunk.chunk_index, idx);
    assert.deepEqual(chunk.heading_path, ['Top', 'Sub']);
    assert.equal(chunk.top_heading, 'Top');
    assert.equal(chunk.anchor, '#a');
  });
});
