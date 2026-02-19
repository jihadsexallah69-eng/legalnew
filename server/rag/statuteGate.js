function toText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

const AUTHORITY_NUM_MAP = {
  statute: 4,
  regulation: 4,
  ministerial_instruction: 3,
  public_policy: 3,
  policy: 2,
  manual: 2,
  voi: 2,
  jurisprudence: 1,
  case_law: 1,
  reference: 1,
  provincial_program: 1,
};

function normalizeLabelToken(token) {
  const value = String(token || '').trim();
  if (!value) return '';
  return value.toLowerCase();
}

function buildCanonicalKey(prefix, section, labels = []) {
  const cleanSection = toText(section).replace(/\.$/, '');
  if (!cleanSection) return '';
  const suffix = labels
    .map((label) => normalizeLabelToken(label))
    .filter(Boolean)
    .map((label) => `(${label})`)
    .join('');
  return `${prefix}:${cleanSection}${suffix}`;
}

function parseInstrumentKey(raw, prefix) {
  const text = toText(raw);
  if (!text) return '';
  const pattern = new RegExp(
    `\\b${prefix}\\b\\s*(?:(?:s|sec|section)\\.?\\s*)?(?:[:#-]\\s*)?(\\d+(?:\\.\\d+)*)((?:\\s*\\([a-z0-9]+\\))*)`,
    'i'
  );
  const match = text.match(pattern);
  if (!match) return '';
  const labels = Array.from((match[2] || '').matchAll(/\(([a-z0-9]+)\)/gi)).map((m) => m[1]);
  return buildCanonicalKey(prefix.toUpperCase(), match[1], labels);
}

function parseAOrRShorthand(raw) {
  const text = toText(raw);
  if (!text) return '';
  const match = text.match(/\b([AR])\s*(\d+(?:\.\d+)*)((?:\s*\([a-z0-9]+\))*)\b/i);
  if (!match) return '';
  const prefix = match[1].toUpperCase() === 'A' ? 'IRPA' : 'IRPR';
  const labels = Array.from((match[3] || '').matchAll(/\(([a-z0-9]+)\)/gi)).map((m) => m[1]);
  return buildCanonicalKey(prefix, match[2], labels);
}

export function extractCanonicalClauseKey(query = '') {
  const text = toText(query);
  if (!text) return '';

  const irpa = parseInstrumentKey(text, 'IRPA');
  if (irpa) return irpa;
  const irpr = parseInstrumentKey(text, 'IRPR');
  if (irpr) return irpr;

  const shorthand = parseAOrRShorthand(text);
  if (shorthand) return shorthand;

  if (/\bterrorism\b/i.test(text) && /\bIRPA\b/i.test(text)) {
    return 'IRPA:34(1)(c)';
  }

  return '';
}

export function sourceAuthorityLevelNum(source = {}) {
  const numeric = Number(source?.raw?.authority_level_num ?? source?.authorityLevelNum);
  if (Number.isFinite(numeric)) return numeric;
  const label = toText(source?.authorityLevel || source?.raw?.authority_level).toLowerCase();
  return AUTHORITY_NUM_MAP[label] || 0;
}

function normalizeCanonicalFromSectionId(value = '') {
  const text = toText(value);
  if (!text) return '';

  // Already canonical style.
  if (/^(IRPA|IRPR):/i.test(text)) {
    const [instrument, suffix] = text.split(':', 2);
    return `${instrument.toUpperCase()}:${suffix}`;
  }

  // Common section_id style: IRPR_200_1_b -> IRPR:200(1)(b)
  const parts = text.split('_').filter(Boolean);
  if (parts.length >= 2 && /^(IRPA|IRPR)$/i.test(parts[0])) {
    const instrument = parts[0].toUpperCase();
    const section = parts[1].replace(/_dot_/gi, '.');
    const labels = parts.slice(2).map((part) => part.replace(/_dot_/gi, '.'));
    return buildCanonicalKey(instrument, section, labels);
  }

  return '';
}

export function sourceCanonicalKey(source = {}) {
  const direct = toText(source?.raw?.canonical_key || source?.canonicalKey);
  if (direct) return normalizeCanonicalFromSectionId(direct);

  const sectionId = toText(source?.sectionId || source?.raw?.section_id || source?.raw?.citation_key);
  const normalized = normalizeCanonicalFromSectionId(sectionId);
  if (normalized) return normalized;

  const textProbe = [source?.text, source?.title, source?.source]
    .map((value) => toText(value))
    .filter(Boolean)
    .join(' ');
  const parsedIrpa = parseInstrumentKey(textProbe, 'IRPA');
  if (parsedIrpa) return parsedIrpa;
  const parsedIrpr = parseInstrumentKey(textProbe, 'IRPR');
  if (parsedIrpr) return parsedIrpr;
  const parsedShorthand = parseAOrRShorthand(textProbe);
  if (parsedShorthand) return parsedShorthand;

  return '';
}

export function hasAuthorityLevel4Source(sources = []) {
  return (Array.isArray(sources) ? sources : []).some((source) => sourceAuthorityLevelNum(source) === 4);
}

export function hasExactCanonicalInTopK({ sources = [], canonicalKey = '', topK = 3 } = {}) {
  const target = toText(canonicalKey).toUpperCase();
  if (!target) return false;
  const top = (Array.isArray(sources) ? sources : []).slice(0, Math.max(1, topK));
  return top.some((source) => (
    sourceAuthorityLevelNum(source) === 4
    && sourceCanonicalKey(source).toUpperCase() === target
  ));
}

export function evaluateClauseRecall({ query = '', sources = [], topK = 3 } = {}) {
  const canonicalKey = extractCanonicalClauseKey(query);
  const authorityOk = hasAuthorityLevel4Source(sources);
  if (!canonicalKey) {
    return {
      passed: authorityOk,
      canonicalKey: '',
      reason: authorityOk ? 'ok_without_canonical_key' : 'missing_authority_level_4',
    };
  }

  const topKMatch = hasExactCanonicalInTopK({
    sources,
    canonicalKey,
    topK,
  });

  return {
    passed: authorityOk && topKMatch,
    canonicalKey,
    reason: authorityOk
      ? (topKMatch ? 'ok' : 'canonical_not_in_top_k')
      : 'missing_authority_level_4',
  };
}

export function shouldEnforceBindingGate(query = '') {
  const text = toText(query).toLowerCase();
  if (!text) return false;

  if (/\birpa\b|\birpr\b/.test(text)) return true;
  if (/\ba\d{1,3}|\br\d{1,3}/.test(text)) return true;
  if (/\bwhat does\b|\brequired under\b|\brequirements? under\b|\binadmissible\b/.test(text)) return true;

  return false;
}

export async function enforceStatuteGate({
  query = '',
  grounding = null,
  topK = 6,
  retrieveBindingGrounding = async () => ({ pinecone: [], retrieval: {} }),
} = {}) {
  const enabled = shouldEnforceBindingGate(query);
  if (!enabled) {
    return {
      status: 'skipped',
      rerunUsed: false,
      grounding,
      check: evaluateClauseRecall({ query, sources: grounding?.pinecone || [] }),
    };
  }

  const initialCheck = evaluateClauseRecall({
    query,
    sources: grounding?.pinecone || [],
  });
  if (initialCheck.passed) {
    return {
      status: 'pass',
      rerunUsed: false,
      grounding,
      check: initialCheck,
    };
  }

  const retriedGrounding = await retrieveBindingGrounding({
    query,
    topK,
  });
  const retryCheck = evaluateClauseRecall({
    query,
    sources: retriedGrounding?.pinecone || [],
  });

  if (retryCheck.passed) {
    return {
      status: 'pass',
      rerunUsed: true,
      grounding: retriedGrounding,
      check: retryCheck,
    };
  }

  return {
    status: 'fail',
    rerunUsed: true,
    grounding: retriedGrounding,
    check: retryCheck,
  };
}
