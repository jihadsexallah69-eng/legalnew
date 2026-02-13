# Phase 1 Incident Playbook

**Version: 1.0.0**  
**Last Updated: 2026-02-13**

## Incident Response Workflows

### 1. NO_BINDING_AUTHORITY

**Severity:** ERROR  
**Code:** `NO_BINDING_AUTHORITY`

#### Detection
```json
{
  "debug": {
    "failureState": "NO_BINDING_AUTHORITY",
    "retrieval": {
      "tiers": {
        "binding": { "bindingAuthorityCount": 0 }
      }
    }
  }
}
```

#### Symptoms
- Response generated but contains no binding legal citations
- User receives guidance without authoritative sources
- Risk of providing inaccurate legal information

#### Root Causes
1. Query not about Canadian immigration law
2. No IRPA/IRPR documents in Pinecone namespace
3. Source policy blocking legitimate sources
4. Retrieval returning only guidance-tier sources

#### Resolution Steps

1. **Check query domain**
   - Verify query is about Canadian immigration
   - Check if query was blocked by prompt security

2. **Verify Pinecone content**
   ```bash
   # Check namespace has binding documents
   # Verify document metadata
   ```

3. **Check source policy**
   - Review `config/source_policy.v1.json`
   - Ensure domain is in `allowed_hosts`

4. **Verify retrieval tier config**
   - Check `RAG_TOP_K_BINDING` environment variable
   - Verify tier filters are applied

#### Commands
```bash
# Test retrieval with debug
DEBUG_MODE=true curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "your query"}'

# Check failure state
cat response.json | jq '.debug.failureState'
```

#### Prevention
- Maintain up-to-date IRPA/IRPR document namespace
- Regular evaluation with gold set
- Monitor failure state distribution

---

### 2. STALE_VOLATILE_SOURCE

**Severity:** ERROR  
**Code:** `STALE_VOLATILE_SOURCE`

#### Detection
```json
{
  "debug": {
    "failureState": "STALE_VOLATILE_SOURCE",
    "retrieval": {
      "topSourceIds": [
        {
          "effective_from": "2023-01-01",
          "effective_to": "2024-06-30"
        }
      ]
    }
  }
}
```

#### Symptoms
- Response based on expired policy
- Effective dates in metadata differ from current date
- User receives outdated information

#### Root Causes
1. Source document has expired effective dates
2. No fresh source available for query
3. Temporal filter not properly applied

#### Resolution Steps

1. **Check source temporal metadata**
   - Review `effective_from` and `effective_to`
   - Compare with query `as_of` date

2. **Refresh source content**
   - Re-crawl affected sources
   - Update Pinecone with fresh documents

3. **Verify temporal policy**
   - Check `effective_date_policy` in config
   - Ensure `as_of` switching works correctly

#### Commands
```bash
# Check temporal metadata in debug
DEBUG_MODE=true curl -X POST http://localhost:3001/api/chat \
  -d '{"message": "CRS requirements", "as_of": "2026-02-13"}'

# Verify temporal policy
cat config/source_policy.v1.json | jq '.effective_date_policy'
```

#### Prevention
- Regular document refresh schedule
- Monitor effective dates in source metadata
- Set up alerts for expiring sources

---

### 3. CITATION_MISMATCH

**Severity:** ERROR  
**Code:** `CITATION_MISMATCH`

#### Detection
```json
{
  "debug": {
    "failureState": "CITATION_MISMATCH",
    "guardIssues": [
      "citation_token_not_in_sources"
    ]
  }
}
```

#### Symptoms
- Response contains citations not in retrieved sources
- Citation tokens don't match available sources
- Risk of citing non-existent or incorrect content

#### Root Causes
1. Model hallucinated citations
2. Source map mismatch in grounding
3. Citation validation not applied

#### Resolution Steps

1. **Check source-citation mapping**
   - Review `debug.retrieval.topSourceIds`
   - Verify citation map in grounding

2. **Verify citation validation**
   - Check `validateCitationTokens` function
   - Ensure invalid tokens removed

3. **Review grounding logic**
   - Check citation map creation in prompt
   - Verify source labels (P1, P2, C1, etc.)

#### Commands
```bash
# Check guard issues
cat response.json | jq '.debug.guardIssues'

# Verify citation map
cat response.json | jq '.citations'
```

#### Prevention
- Enable citation validation in response guard
- Monitor hallucination rates
- Regular eval with citation checks

---

### 4. OUT_OF_SCOPE_SOURCE

**Severity:** ERROR  
**Code:** `OUT_OF_SCOPE_SOURCE`

#### Detection
```json
{
  "debug": {
    "failureState": "OUT_OF_SCOPE_SOURCE",
    "promptSecurity": {
      "rcicRelated": false
    }
  }
}
```

#### Symptoms
- Response includes non-Canadian immigration content
- User receives information outside RCIC scope
- Potential policy violation

#### Root Causes
1. Query about non-Canadian immigration
2. Source from blocked domain
3. Prompt injection attempt

#### Resolution Steps

1. **Verify query scope**
   - Check `rcicRelated` flag
   - Review prompt security logs

2. **Check source policy**
   - Review `blocked_hosts` in config
   - Verify path restrictions

3. **Check for injection**
   - Review prompt security logs
   - Check for malicious input patterns

#### Commands
```bash
# Check RCIC scope
cat response.json | jq '.debug.rcicRelated'

# Verify source policy
cat config/source_policy.v1.json | jq '.blocked_hosts'
```

#### Prevention
- Maintain strict source policy
- Regular prompt security reviews
- Monitor out-of-scope queries

---

## Escalation

### When to Escalate
- Repeated failures across multiple queries
- New failure state not in matrix
- Data integrity issues
- Security concerns

### Escalation Path
1. Document failure details
2. Collect debug payloads
3. Check eval reports
4. Contact senior engineer

## Post-Incident

### Review Checklist
- [ ] Root cause identified
- [ ] Fix applied
- [ ] Tests updated
- [ ] Documentation updated
- [ ] Team notified

### Metrics to Track
- Failure state frequency
- Resolution time
- Impact on user queries
- Recurrence rate
