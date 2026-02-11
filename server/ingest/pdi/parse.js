import { load } from 'cheerio';

const JUNK_SELECTORS = [
  'script',
  'style',
  'noscript',
  'template',
  'iframe',
  'svg',
  'nav',
  'header',
  'footer',
  '[role="navigation"]',
  '[class*="cookie"]',
  '[id*="cookie"]',
  '[class*="banner"]',
  '[id*="banner"]',
  '[class*="consent"]',
  '[id*="consent"]',
];

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function textLength($node) {
  return normalizeWhitespace($node.text()).length;
}

function pickContentContainer($) {
  const preferredSelectors = [
    'main',
    '#main-content',
    '.main-content',
    '.content',
    '.field--name-body',
    '[role="main"]',
  ];

  for (const selector of preferredSelectors) {
    const node = $(selector).first();
    if (node.length > 0 && textLength(node) > 120) {
      return node;
    }
  }

  const fallbackCandidates = [
    'article',
    '#content',
    '.container',
    '.region-content',
    'body',
  ];

  let bestNode = $('body').first();
  let bestLength = textLength(bestNode);

  for (const selector of fallbackCandidates) {
    $(selector).each((_idx, el) => {
      const node = $(el);
      const len = textLength(node);
      if (len > bestLength) {
        bestNode = node;
        bestLength = len;
      }
    });
  }

  return bestNode;
}

function parseDateToIso(raw) {
  const value = normalizeWhitespace(raw);
  if (!value) return null;

  const isoMatch = value.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    return isoMatch[1];
  }

  const monthDayYearMatch = value.match(/\b([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})\b/);
  if (monthDayYearMatch) {
    const parsed = new Date(`${monthDayYearMatch[1]} ${monthDayYearMatch[2]}, ${monthDayYearMatch[3]}`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  const dayMonthYearMatch = value.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b/);
  if (dayMonthYearMatch) {
    const parsed = new Date(`${dayMonthYearMatch[2]} ${dayMonthYearMatch[1]}, ${dayMonthYearMatch[3]}`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  return null;
}

function extractLastUpdated($, $container) {
  const pattern = /(date\s+modified|last\s+updated|date\s+updated)/i;

  const candidates = [];
  $container.find('time, p, div, span, li, strong').each((_idx, el) => {
    const text = normalizeWhitespace($(el).text());
    if (pattern.test(text)) {
      candidates.push(text);
    }
  });

  if (candidates.length === 0) {
    $('time, p, div, span, li, strong').each((_idx, el) => {
      const text = normalizeWhitespace($(el).text());
      if (pattern.test(text)) {
        candidates.push(text);
      }
    });
  }

  for (const text of candidates) {
    const parsed = parseDateToIso(text);
    if (parsed) return parsed;
  }

  return null;
}

export function parsePdiHtml(html) {
  const $ = load(html);

  $(JUNK_SELECTORS.join(',')).remove();

  const $container = pickContentContainer($);
  $container.find(JUNK_SELECTORS.join(',')).remove();

  const h1 = normalizeWhitespace($container.find('h1').first().text());
  const titleTag = normalizeWhitespace($('title').first().text());
  const title = h1 || titleTag || 'Untitled PDI';
  const lastUpdated = extractLastUpdated($, $container);

  return {
    $,
    $container,
    title,
    lastUpdated,
  };
}

export function normalizeText(value) {
  return normalizeWhitespace(value);
}

export function parseLooseDate(value) {
  return parseDateToIso(value);
}
