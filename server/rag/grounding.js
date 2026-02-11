import { pineconeQuery } from '../clients/pinecone.js';

export async function retrieveGrounding({ query, topK = 6 }) {
  const pineconeResults = await pineconeQuery({ query, topK, namespace: process.env.PINECONE_NAMESPACE }).catch((err) => {
    console.error('Pinecone retrieval failed:', err);
    return [];
  });

  return {
    pinecone: Array.isArray(pineconeResults) ? pineconeResults : [],
    caseLaw: [],
  };
}

export function buildPrompt({ query, grounding, history = [] }) {
  const citationMap = {};

  const pineconeSnippets = grounding.pinecone
    .map((s, i) => {
      const id = `P${i + 1}`;
      citationMap[id] = s;
      return `${id}. ${s.text || ''}\nSource: ${s.source || s.title || s.id || 'pinecone'}`;
    })
    .join('\n\n');

  const caseLawSnippets = (Array.isArray(grounding.caseLaw) ? grounding.caseLaw : [])
    .map((s, i) => {
      const id = `C${i + 1}`;
      citationMap[id] = s;
      const header = [s.title, s.court, s.neutralCitation, s.url].filter(Boolean).join(' — ');
      return `${id}. ${header || s.title || 'Case law source'}\n${s.snippet || ''}`;
    })
    .join('\n\n');

  const historyBlock = Array.isArray(history) && history.length > 0
    ? `RECENT CHAT HISTORY:\n${history
        .map((m) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content || ''}`)
        .join('\n')}`
    : '';

  const contextBlock = [
    historyBlock,
    pineconeSnippets ? `PINECONE SOURCES:\n${pineconeSnippets}` : '',
    caseLawSnippets ? `CASE LAW SOURCES (A2AJ):\n${caseLawSnippets}` : '',
  ].filter(Boolean).join('\n\n');

  const system = [
    'You are a legal research assistant. Use ONLY the provided sources.',
    'Cite every factual claim with source IDs in square brackets, e.g., [P1] or [C1].',
    'Never invent citation IDs. Only use IDs present in provided sources.',
    'If sources are insufficient, say so clearly.'
  ].join(' ');

  const user = contextBlock
    ? `Question: ${query}\n\nSources:\n${contextBlock}`
    : `Question: ${query}\n\nNo sources available.`;

  return { system, user, citationMap };
}

export function extractCitations(text) {
  const ids = new Set();
  const regex = /\[(P\d+|C\d+)\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    ids.add(match[1]);
  }
  return Array.from(ids);
}

export function validateCitationTokens(text, citationMap) {
  if (!text || typeof text !== 'string') return text || '';
  const validIds = new Set(Object.keys(citationMap || {}));
  let cleaned = text.replace(/\[(P\d+|C\d+)\]/g, (_full, id) => {
    return validIds.has(id) ? `[${id}]` : '';
  });

  cleaned = cleaned
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned;
}
