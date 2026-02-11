import pLimit from 'p-limit';

const DEFAULT_BATCH_SIZE = 32;
const DEFAULT_CONCURRENCY = 2;

function toInt(value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function chunkArray(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function requestEmbeddings(texts) {
  const apiKey = process.env.PINECONE_API_KEY;
  const baseUrl = (process.env.EMBEDDING_BASE_URL || 'https://api.pinecone.io').replace(/\/$/, '');
  const apiVersion = process.env.PINECONE_API_VERSION || '2025-10';
  const model = process.env.EMBEDDING_MODEL || 'llama-text-embed-v2';
  const dimension = toInt(process.env.EMBEDDING_DIM || 1024, 1024, 1, 4096);

  if (!apiKey) {
    throw new Error('PINECONE_API_KEY is required for embeddings');
  }

  const response = await fetch(`${baseUrl}/embed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': apiKey,
      'X-Pinecone-API-Version': apiVersion,
    },
    body: JSON.stringify({
      model,
      inputs: texts.map((text) => ({ text })),
      parameters: {
        input_type: 'passage',
        truncate: 'END',
        dimension,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Embedding API error: ${errText}`);
  }

  const payload = await response.json();
  const vectors = Array.isArray(payload?.data)
    ? payload.data.map((row) => row?.values)
    : [];

  if (vectors.length !== texts.length) {
    throw new Error(`Embedding count mismatch. Expected ${texts.length}, got ${vectors.length}`);
  }

  vectors.forEach((v, idx) => {
    if (!Array.isArray(v)) {
      throw new Error(`Embedding vector missing at index ${idx}`);
    }
  });

  return vectors;
}

async function withRetry(fn, retries = 1) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastErr = error;
    }
  }
  throw lastErr;
}

export async function embedChunks(chunks, options = {}) {
  const batchSize = toInt(options.batchSize || process.env.PDI_EMBED_BATCH_SIZE, DEFAULT_BATCH_SIZE, 1, 128);
  const concurrency = toInt(options.concurrency || process.env.PDI_EMBED_CONCURRENCY, DEFAULT_CONCURRENCY, 1, 8);
  const retries = toInt(options.retries, 1, 0, 3);

  const vectors = Array(chunks.length).fill(null);
  const errors = [];
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return { vectors, errors, embeddedCount: 0 };
  }

  const indexed = chunks.map((chunk, index) => ({ index, text: chunk.text }));
  const batches = chunkArray(indexed, batchSize);
  const limit = pLimit(concurrency);

  await Promise.all(
    batches.map((batch) =>
      limit(async () => {
        try {
          const texts = batch.map((item) => item.text);
          const embedded = await withRetry(() => requestEmbeddings(texts), retries);
          embedded.forEach((values, i) => {
            vectors[batch[i].index] = values;
          });
        } catch (error) {
          errors.push({
            stage: 'embed',
            startIndex: batch[0].index,
            endIndex: batch[batch.length - 1].index,
            message: error?.message || 'Embedding batch failed',
          });
        }
      })
    )
  );

  return {
    vectors,
    errors,
    embeddedCount: vectors.filter(Boolean).length,
  };
}
