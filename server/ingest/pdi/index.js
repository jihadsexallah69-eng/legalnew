import { createHash } from 'node:crypto';
import { canonicalizeForHash, fetchPdiHtml } from './fetch.js';
import { parsePdiHtml } from './parse.js';
import { extractSectionsFromContainer } from './sectionize.js';
import { chunkSections } from './chunk.js';
import { embedChunks } from './embed.js';
import { upsertPineconeVectors } from './upsert.js';

function toBool(value) {
  if (typeof value === 'boolean') return value;
  return String(value || '').toLowerCase() === 'true';
}

function normalizeInputUrl(url) {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

export function resolveIngestUrls(payload) {
  if (!payload || typeof payload !== 'object') return [];

  const list = [];
  if (typeof payload.url === 'string') {
    list.push(payload.url);
  }
  if (Array.isArray(payload.urls)) {
    list.push(...payload.urls);
  }

  const deduped = [];
  const seen = new Set();
  list.forEach((url) => {
    const normalized = normalizeInputUrl(url);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    deduped.push(normalized);
  });

  return deduped;
}

function shortHash(value) {
  return createHash('sha1').update(String(value)).digest('hex').slice(0, 12);
}

function headingDistribution(sections) {
  const out = {};
  for (const section of sections) {
    const key = section.top_heading || 'Unknown';
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function buildMetadata({ sourceUrl, title, lastUpdated, chunk, chunkId }) {
  const headingPath = Array.isArray(chunk.heading_path) && chunk.heading_path.length > 0
    ? [...chunk.heading_path]
    : [title || 'Untitled PDI'];

  const topHeading = headingPath[0] || title || 'Untitled PDI';
  headingPath[0] = topHeading;

  return {
    source_type: 'ircc_pdi_html',
    source_url: sourceUrl,
    title,
    last_updated: lastUpdated || null,
    heading_path: headingPath,
    top_heading: topHeading,
    anchor: chunk.anchor || null,
    section_index: chunk.section_index,
    chunk_index: chunk.chunk_index,
    chunk_id: chunkId,
    text: chunk.text,
  };
}

function namespaceOrDefault(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return value || process.env.PINECONE_NAMESPACE || 'ircc';
}

export async function ingestPdiUrls({ urls, namespace, dryRun = false } = {}) {
  const targetNamespace = namespaceOrDefault(namespace);
  const uniqueUrls = Array.isArray(urls) ? resolveIngestUrls({ urls }) : [];

  const result = {
    status: 'ok',
    ingested: 0,
    skipped: 0,
    errors: [],
    stats: {
      totalSections: 0,
      totalChunks: 0,
    },
  };

  for (const inputUrl of uniqueUrls) {
    try {
      const fetched = await fetchPdiHtml(inputUrl);
      const sourceUrl = canonicalizeForHash(fetched.sourceUrl || inputUrl);
      const docHash = shortHash(sourceUrl);

      console.log(`[PDI ingest] fetched OK: ${sourceUrl}`);

      const { $, $container, title, lastUpdated } = parsePdiHtml(fetched.html);
      const sections = extractSectionsFromContainer($, $container, { title });
      const chunks = chunkSections(sections);

      result.stats.totalSections += sections.length;
      result.stats.totalChunks += chunks.length;

      console.log(
        `[PDI ingest] parsed: title="${title}" sections=${sections.length} chunks=${chunks.length} lastUpdated=${lastUpdated || 'null'}`
      );
      console.log(`[PDI ingest] top headings: ${JSON.stringify(headingDistribution(sections))}`);

      if (sections.length === 0 || chunks.length === 0) {
        result.skipped += 1;
        result.errors.push({
          url: sourceUrl,
          stage: 'extract',
          message: 'No sections/chunks extracted from page',
        });
        continue;
      }

      if (toBool(dryRun)) {
        result.ingested += 1;
        continue;
      }

      const { vectors, errors: embedErrors, embeddedCount } = await embedChunks(chunks);
      if (embedErrors.length > 0) {
        embedErrors.forEach((err) => {
          result.errors.push({
            url: sourceUrl,
            ...err,
          });
        });
      }

      const records = [];
      for (let i = 0; i < chunks.length; i += 1) {
        const vector = vectors[i];
        if (!Array.isArray(vector)) continue;

        const chunk = chunks[i];
        const chunkId = `pdi|${docHash}|${chunk.section_index}|${chunk.chunk_index}`;
        records.push({
          id: chunkId,
          values: vector,
          metadata: buildMetadata({
            sourceUrl,
            title,
            lastUpdated,
            chunk,
            chunkId,
          }),
        });
      }

      if (records.length === 0) {
        result.skipped += 1;
        result.errors.push({
          url: sourceUrl,
          stage: 'embed',
          message: `Embedding produced no records (embedded ${embeddedCount}/${chunks.length})`,
        });
        continue;
      }

      const upsert = await upsertPineconeVectors(records, targetNamespace);
      if (upsert.errors.length > 0) {
        upsert.errors.forEach((err) => {
          result.errors.push({
            url: sourceUrl,
            ...err,
          });
        });
      }

      if (upsert.upsertedCount > 0) {
        result.ingested += 1;
      } else {
        result.skipped += 1;
      }
    } catch (error) {
      result.skipped += 1;
      result.errors.push({
        url: inputUrl,
        stage: 'url',
        message: error?.message || 'Failed to process URL',
      });
      console.error(`[PDI ingest] failed: ${inputUrl}`, error);
    }
  }

  return result;
}
