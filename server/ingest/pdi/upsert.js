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

async function upsertBatch(vectors, namespace) {
  const apiKey = process.env.PINECONE_API_KEY;
  const host = (process.env.PINECONE_INDEX_HOST || '').replace(/\/$/, '');

  if (!apiKey) {
    throw new Error('PINECONE_API_KEY is required for upsert');
  }
  if (!host) {
    throw new Error('PINECONE_INDEX_HOST is required for upsert');
  }

  const response = await fetch(`${host}/vectors/upsert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': apiKey,
    },
    body: JSON.stringify({
      vectors,
      namespace,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Pinecone upsert error: ${errText}`);
  }

  const payload = await response.json().catch(() => ({}));
  return Number(payload?.upsertedCount || vectors.length);
}

export async function upsertPineconeVectors(records, namespace, options = {}) {
  const batchSize = toInt(options.batchSize || process.env.PDI_UPSERT_BATCH_SIZE, 100, 1, 500);
  const errors = [];

  if (!Array.isArray(records) || records.length === 0) {
    return { upsertedCount: 0, errors };
  }

  let upsertedCount = 0;
  const batches = chunkArray(records, batchSize);

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    try {
      const count = await upsertBatch(batch, namespace);
      upsertedCount += count;
    } catch (error) {
      errors.push({
        stage: 'upsert',
        batch: i,
        size: batch.length,
        message: error?.message || 'Upsert batch failed',
      });
    }
  }

  return { upsertedCount, errors };
}
