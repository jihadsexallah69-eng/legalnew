# Phase 1 Runbook

**Version: 1.0.0**  
**Last Updated: 2026-02-13**

## Overview

This runbook covers operational procedures for Phase 1 of the RCIC Legal Research Assistant, including debugging, testing, and troubleshooting.

## Quick Commands

### Run All Phase 1 Tests
```bash
npm run test:server
node --test server/rag/__tests__/auditTrace.test.js
node --test server/rag/__tests__/failureStates.test.js
node --test server/rag/__tests__/responsePolicy.test.js
node --test server/__tests__/debugPayload.test.js
```

### Run Evaluation Harness
```bash
node eval/run_eval.js
```

### Validate Contracts
```bash
node contracts/v1/validate.js
```

### Run Source Policy Tests
```bash
node --test config/__tests__/sourcePolicy.test.js
```

## Debug Payload

When `DEBUG_MODE=true`, the `/api/chat` endpoint returns detailed debug information.

### Expected Fields

```json
{
  "debug": {
    "analysisDate": {
      "basis": "today|explicit_as_of|application_date",
      "asOf": "YYYY-MM-DD"
    },
    "retrieval": {
      "mode": "single|tiered",
      "tiers": {
        "binding": { "topK": 6, "count": 5, "bindingAuthorityCount": 3 },
        "guidance": { "topK": 4, "count": 3 }
      },
      "authorityMixCounts": {
        "PRIMARY_LEGISLATION": 2,
        "REGULATION": 3
      },
      "docFamilyCounts": {
        "IRPA": 1,
        "IRPR": 2
      },
      "topSourceIds": [
        { "id": "p1", "doc_family": "IRPA", "authority_level": "PRIMARY_LEGISLATION", "score": 0.95, "tier": "binding" }
      ]
    },
    "failureState": "NONE|NO_BINDING_AUTHORITY|...",
    "budget": { "maxToolCalls": 8, "usedToolCalls": 3 }
  }
}
```

### Enable Debug Mode
```bash
DEBUG_MODE=true npm run dev:server
```

## Common Issues

### 1. NO_BINDING_AUTHORITY

**Symptom:** Response contains claims but no binding legal authority (IRPA/IRPR/Case Law)

**Debug:**
1. Check `debug.retrieval.tiers.binding.bindingAuthorityCount` - should be > 0
2. Verify sources are from allowed domains in `config/source_policy.v1.json`
3. Check `debug.failureState` = "NO_BINDING_AUTHORITY"

**Resolution:**
- Ensure query is about Canadian immigration law
- Verify Pinecone namespace has IRPA/IRPR documents
- Check document metadata has correct `authority_level`

### 2. STALE_VOLATILE_SOURCE

**Symptom:** Sources retrieved may be outdated

**Debug:**
1. Check `debug.retrieval` for temporal metadata
2. Verify `effective_from` and `effective_to` fields in source metadata

**Resolution:**
- Re-retrieve with fresh API calls
- Verify document is still in force

### 3. INSUFFICIENT_FACTS

**Symptom:** Query too vague for meaningful response

**Debug:**
1. Check query specificity
2. Verify `debug.failureState` = "INSUFFICIENT_FACTS"

**Resolution:**
- Add specific program name (e.g., "Express Entry", "PNP")
- Include dates if applicable
- Specify target outcome

## Testing

### Unit Tests
```bash
# All server tests
npm run test:server

# Specific test file
node --test server/rag/__tests__/failureStates.test.js
```

### Integration Tests
```bash
# Run evaluation harness
node eval/run_eval.js
```

### Debug Endpoint Test
```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What are the FSW eligibility requirements?"}'
```

## Monitoring

### Check Failure States
```bash
# View recent eval reports
ls -la eval/reports/
cat eval/reports/eval-report-*.json | jq '.summary'
```

### Check Audit Traces
Debug payload includes `auditTrace` with phase-by-phase timing and status.

## File Locations

| Component | Location |
|-----------|----------|
| Debug tests | `server/__tests__/debugPayload.test.js` |
| Failure states | `server/rag/failureStates.js` |
| Audit trace | `server/rag/auditTrace.js` |
| Source policy | `config/source_policy.v1.json` |
| Gold set | `eval/gold/gold_set_template.jsonl` |
| Eval runner | `eval/run_eval.js` |
