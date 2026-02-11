function toPositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function findBoundary(text, start, targetEnd) {
  if (targetEnd >= text.length) return text.length;

  const minBoundary = start + Math.floor((targetEnd - start) * 0.6);
  const newlineIdx = text.lastIndexOf('\n', targetEnd);
  if (newlineIdx >= minBoundary) return newlineIdx;

  const spaceIdx = text.lastIndexOf(' ', targetEnd);
  if (spaceIdx >= minBoundary) return spaceIdx;

  return targetEnd;
}

export function chunkTextWithOverlap(text, options = {}) {
  const value = String(text || '').trim();
  if (!value) return [];

  const maxChars = toPositiveInt(options.maxChars || process.env.PDI_CHUNK_MAX_CHARS, 3200);
  const overlapChars = Math.min(
    toPositiveInt(options.overlapChars || process.env.PDI_CHUNK_OVERLAP_CHARS, 500),
    Math.floor(maxChars / 2)
  );

  const chunks = [];
  let start = 0;

  while (start < value.length) {
    const targetEnd = Math.min(value.length, start + maxChars);
    const end = findBoundary(value, start, targetEnd);

    const chunkText = value.slice(start, end).trim();
    if (chunkText) {
      chunks.push({
        text: chunkText,
        start,
        end,
      });
    }

    if (end >= value.length) break;

    let nextStart = Math.max(0, end - overlapChars);
    if (nextStart <= start) {
      nextStart = start + Math.max(1, maxChars - overlapChars);
    }
    start = nextStart;
  }

  return chunks;
}

export function chunkSections(sections, options = {}) {
  if (!Array.isArray(sections) || sections.length === 0) return [];

  const chunks = [];
  sections.forEach((section, sectionIndex) => {
    const sectionChunks = chunkTextWithOverlap(section.text, options);
    sectionChunks.forEach((chunk, chunkIndex) => {
      chunks.push({
        section_index: sectionIndex,
        chunk_index: chunkIndex,
        heading_path: Array.isArray(section.heading_path) ? section.heading_path : [],
        top_heading: section.top_heading || section.heading_path?.[0] || null,
        anchor: section.anchor || null,
        text: chunk.text,
        start_char: chunk.start,
        end_char: chunk.end,
      });
    });
  });

  return chunks;
}
