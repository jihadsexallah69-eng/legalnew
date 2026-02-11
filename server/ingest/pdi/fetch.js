import { load } from 'cheerio';

const DEFAULT_TIMEOUT_MS = 30000;

function normalizeUrl(raw, base) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const u = new URL(raw, base);
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

function findCanonicalUrl(html, baseUrl) {
  try {
    const $ = load(html);
    const href = $('link[rel="canonical"]').attr('href');
    return normalizeUrl(href, baseUrl);
  } catch {
    return null;
  }
}

export async function fetchPdiHtml(url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const normalizedInput = normalizeUrl(url);
  if (!normalizedInput) {
    throw new Error(`Invalid URL: ${url}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(normalizedInput, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Fetch failed (${response.status})`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error(`Unsupported content-type: ${contentType}`);
    }

    const html = await response.text();
    const fetchedUrl = normalizeUrl(response.url) || normalizedInput;
    const canonicalUrl = findCanonicalUrl(html, fetchedUrl);
    const sourceUrl = canonicalUrl || fetchedUrl;

    return {
      requestUrl: normalizedInput,
      fetchedUrl,
      sourceUrl,
      html,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function canonicalizeForHash(url) {
  const normalized = normalizeUrl(url);
  return normalized || String(url || '').trim();
}
