# IRCC PDI Ingestion Pipeline

Ingest IRCC Program Delivery Instruction HTML pages into Pinecone vectors with hierarchical metadata.

## Endpoint

`POST /api/ingest/pdi`

### Request

```json
{
  "urls": [
    "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/operational-bulletins-manuals/temporary-residents/work/study-permits.html"
  ],
  "namespace": "ircc",
  "dryRun": false
}
```

You can also pass a single URL:

```json
{
  "url": "https://www.canada.ca/.../pdi-page"
}
```

### Example curl

```bash
curl -X POST http://127.0.0.1:3001/api/ingest/pdi \
  -H 'content-type: application/json' \
  -d '{
    "urls": ["https://www.canada.ca/.../pdi-page"],
    "namespace": "ircc",
    "dryRun": true
  }'
```

## Notes

- `dryRun=true` performs fetch/parse/section/chunk and returns stats without embedding or upsert.
- Embeddings use Pinecone Inference model `llama-text-embed-v2`.
- Vector metadata includes `title`, `source_url`, `last_updated`, `heading_path`, `anchor`, and `chunk_id`.
