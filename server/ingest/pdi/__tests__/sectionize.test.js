import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePdiHtml } from '../parse.js';
import { extractSectionsFromContainer } from '../sectionize.js';

test('extracts heading_path hierarchy and anchors', () => {
  const html = `
    <html>
      <head><title>Fallback Title</title></head>
      <body>
        <main>
          <h1>Temporary resident permits</h1>
          <p>Intro overview paragraph.</p>
          <h2 id="eligibility">Eligibility</h2>
          <p>Applicant must be admissible.</p>
          <h3 id="documents">Required documents</h3>
          <ul><li>Passport</li><li>Supporting letter</li></ul>
        </main>
      </body>
    </html>
  `;

  const parsed = parsePdiHtml(html);
  const sections = extractSectionsFromContainer(parsed.$, parsed.$container, {
    title: parsed.title,
  });

  assert.ok(sections.length >= 3);

  assert.deepEqual(sections[0].heading_path, ['Temporary resident permits']);
  assert.equal(sections[0].top_heading, 'Temporary resident permits');

  const eligibility = sections.find((s) => s.anchor === '#eligibility');
  assert.ok(eligibility);
  assert.deepEqual(eligibility.heading_path, ['Temporary resident permits', 'Eligibility']);

  const docs = sections.find((s) => s.anchor === '#documents');
  assert.ok(docs);
  assert.deepEqual(docs.heading_path, ['Temporary resident permits', 'Eligibility', 'Required documents']);
  assert.match(docs.text, /- Passport/);
});

test('uses page title as top heading when no h1 exists', () => {
  const html = `
    <html>
      <head><title>IRCC Guidance</title></head>
      <body>
        <main>
          <h2 id="status">Maintained status</h2>
          <p>Applicants may remain in Canada while awaiting a decision.</p>
        </main>
      </body>
    </html>
  `;

  const parsed = parsePdiHtml(html);
  const sections = extractSectionsFromContainer(parsed.$, parsed.$container, {
    title: parsed.title,
  });

  assert.equal(sections[0].heading_path[0], 'IRCC Guidance');
  assert.equal(sections[0].top_heading, 'IRCC Guidance');
});
