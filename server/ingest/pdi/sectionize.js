import { load } from 'cheerio';
import { normalizeText } from './parse.js';

function isHeadingTag(name) {
  return /^h[1-4]$/i.test(name || '');
}

function headingLevel(name) {
  const m = String(name || '').toLowerCase().match(/^h([1-4])$/);
  return m ? Number(m[1]) : null;
}

function upsertHeadingPath(path, topHeading, level, headingText) {
  const currentTop = topHeading || path[0] || 'Untitled PDI';
  if (level === 1) {
    return [headingText || currentTop];
  }

  const existingSub = path.slice(1);
  const targetDepth = Math.max(1, level - 1);
  const nextSub = existingSub.slice(0, Math.max(0, targetDepth - 1));
  nextSub[targetDepth - 1] = headingText;

  return [currentTop, ...nextSub.filter(Boolean)];
}

function lineFromListItem($, el) {
  const clone = $(el).clone();
  clone.find('ul,ol').remove();
  const value = normalizeText(clone.text());
  return value ? `- ${value}` : '';
}

function tableHeadersFromRow($, row) {
  return $(row)
    .find('th')
    .toArray()
    .map((th) => normalizeText($(th).text()))
    .filter(Boolean);
}

function cellsFromRow($, row) {
  return $(row)
    .find('th,td')
    .toArray()
    .map((cell) => normalizeText($(cell).text()));
}

export function linearizeTable($, tableEl) {
  const lines = [];
  const $table = $(tableEl);
  const caption = normalizeText($table.find('caption').first().text());
  lines.push(caption ? `Table: ${caption}` : 'Table:');

  const rows = $table.find('tr').toArray();
  if (rows.length === 0) {
    return lines.join('\n');
  }

  let headers = [];
  const explicitHeaders = $table.find('thead th').toArray();
  if (explicitHeaders.length > 0) {
    headers = explicitHeaders.map((th) => normalizeText($(th).text())).filter(Boolean);
  } else {
    headers = tableHeadersFromRow($, rows[0]);
  }

  const startIdx = headers.length > 0 && tableHeadersFromRow($, rows[0]).length > 0 ? 1 : 0;
  for (let i = startIdx; i < rows.length; i += 1) {
    const cells = cellsFromRow($, rows[i]);
    if (cells.length === 0) continue;

    if (headers.length > 0) {
      const labeled = headers.map((h, idx) => `${h}: ${cells[idx] || ''}`.trim());
      lines.push(labeled.join(' | '));
    } else {
      lines.push(cells.join(' | '));
    }
  }

  return lines.join('\n').trim();
}

function makeSection(path, anchor) {
  const safePath = Array.isArray(path) && path.length > 0 ? path : ['Untitled PDI'];
  return {
    heading_path: safePath,
    top_heading: safePath[0],
    anchor: anchor || null,
    textParts: [],
  };
}

function finalizeSection(state) {
  if (!state.current) return;
  const text = state.current.textParts
    .join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (text) {
    state.sections.push({
      heading_path: state.current.heading_path,
      top_heading: state.current.top_heading,
      anchor: state.current.anchor,
      text,
    });
  }

  state.current = null;
}

function ensureSection(state) {
  if (!state.current) {
    state.current = makeSection(state.path, state.currentAnchor);
  }
  if (!state.current.heading_path[0]) {
    state.current.heading_path[0] = state.topHeading;
    state.current.top_heading = state.topHeading;
  }
}

function pushLine(state, value) {
  const line = normalizeText(value);
  if (!line) return;
  ensureSection(state);
  state.current.textParts.push(line);
}

function handleHeading($, state, el) {
  const tag = String(el.name || '').toLowerCase();
  const level = headingLevel(tag);
  if (!level) return;

  const headingText = normalizeText($(el).text());
  const anchorId = normalizeText($(el).attr('id'));
  const anchor = anchorId ? `#${anchorId}` : null;

  if (level === 1) {
    finalizeSection(state);
    const nextTop = headingText || state.topHeading;
    state.topHeading = nextTop;
    state.path = [nextTop];
    state.currentAnchor = anchor;
    return;
  }

  state.path = upsertHeadingPath(state.path, state.topHeading, level, headingText || `Section H${level}`);
  state.currentAnchor = anchor;

  finalizeSection(state);
  state.current = makeSection(state.path, anchor);
}

function walkNode($, state, node) {
  if (!node) return;
  if (node.type === 'text') {
    const text = normalizeText(node.data || '');
    if (text) pushLine(state, text);
    return;
  }

  if (node.type !== 'tag') return;

  const tag = String(node.name || '').toLowerCase();
  if (['script', 'style', 'noscript', 'template', 'svg'].includes(tag)) {
    return;
  }

  if (isHeadingTag(tag)) {
    handleHeading($, state, node);
    return;
  }

  if (tag === 'table') {
    pushLine(state, linearizeTable($, node));
    return;
  }

  if (tag === 'li') {
    const line = lineFromListItem($, node);
    if (line) pushLine(state, line);
    $(node)
      .children('ul,ol')
      .toArray()
      .forEach((child) => walkNode($, state, child));
    return;
  }

  if (tag === 'p' || tag === 'blockquote') {
    pushLine(state, $(node).text());
    return;
  }

  $(node)
    .contents()
    .toArray()
    .forEach((child) => walkNode($, state, child));
}

export function extractSectionsFromContainer($, $container, { title } = {}) {
  const pageTitle = normalizeText(title) || 'Untitled PDI';

  const firstH1 = normalizeText($container.find('h1').first().text());
  const topHeading = firstH1 || pageTitle;

  const state = {
    topHeading,
    path: [topHeading],
    currentAnchor: null,
    current: null,
    sections: [],
  };

  $container
    .contents()
    .toArray()
    .forEach((node) => walkNode($, state, node));

  finalizeSection(state);

  if (state.sections.length === 0) {
    const fallback = normalizeText($container.text());
    if (fallback) {
      state.sections.push({
        heading_path: [topHeading],
        top_heading: topHeading,
        anchor: null,
        text: fallback,
      });
    }
  }

  return state.sections.map((s) => ({
    heading_path: Array.isArray(s.heading_path) && s.heading_path.length > 0
      ? s.heading_path
      : [topHeading],
    top_heading: s.heading_path?.[0] || topHeading,
    anchor: s.anchor || null,
    text: normalizeText(s.text),
  }));
}

export function extractSectionsFromHtml(html, { title } = {}) {
  const $ = load(html);
  const $container = $('main').first().length > 0 ? $('main').first() : $('body').first();
  return extractSectionsFromContainer($, $container, { title });
}
