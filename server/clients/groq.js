import OpenAI from 'openai';

export function makeGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');

  return new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });
}

async function createGroqResponse({ systemPrompt, userPrompt, model }) {
  const client = makeGroqClient();
  const resp = await client.responses.create({
    model,
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  return {
    text: resp.output_text ?? '',
    raw: resp,
  };
}

export async function groqRoute({
  systemPrompt,
  userPrompt,
  model = process.env.ROUTER_MODEL || 'llama-3.1-8b-instant',
}) {
  return createGroqResponse({ systemPrompt, userPrompt, model });
}

export async function groqAnswer({
  systemPrompt,
  userPrompt,
  model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
}) {
  return createGroqResponse({ systemPrompt, userPrompt, model });
}
