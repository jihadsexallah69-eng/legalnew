import { GoogleGenAI } from "@google/genai";
import { MOCK_CASES } from '../data/mockCases';
import { CitationReference } from './types';

// Initialize Gemini API Client
// Note: API Key must be provided in the environment variable process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Prepare Context from Mock Cases for RAG (Retrieval Augmented Generation) simulation
const CASE_CONTEXT = MOCK_CASES.map(c => 
  `ID: ${c.id}
  Case: ${c.name} (${c.citation})
  Court: ${c.court}, Year: ${c.year}
  Summary: ${c.summary}
  Key Holdings: ${c.paragraphs.map(p => `[Para ${p.number}] ${p.text}`).join(' ')}`
).join('\n\n');

const SYSTEM_INSTRUCTION = `You are the "RCIC Case-Law Assistant", an expert AI designed to help Regulated Canadian Immigration Consultants.
You have access to a specific database of Federal Court and SCC jurisprudence provided below.

CONTEXT (CASE DATABASE):
${CASE_CONTEXT}

INSTRUCTIONS:
1. Answer the user's legal questions based primarily on the provided CONTEXT and general knowledge of Canadian Immigration Law (IRPA/IRPR).
2. CITATIONS: When you use information from a specific case in the CONTEXT, you MUST cite it by placing its ID in square brackets immediately after the relevant statement. 
   - Example: "The standard of review is reasonableness [1]."
   - Do NOT format it as [Case Name] or (Case Name). Use [ID].
3. FORMAT: Use clear, professional formatting. 
   - For case analysis, use headers: ### Issue, ### Rule, ### Analysis, ### Conclusion.
   - Use **bold** for emphasis.
4. TONE: Professional, objective, and precise.
5. If the user asks about a case not in your context, you can answer from general knowledge but state that it is not in the current library.

Verify all facts. Do not hallucinate case details not present in the context or your general training.`;

export const api = {
  async sendMessage(message: string): Promise<{ text: string; citations: CitationReference[] }> {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: message,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.2, // Low temperature for precision
        }
      });

      const text = response.text || "I apologize, but I could not generate a response at this time.";

      // Extract citation IDs from the response (e.g., [1], [5])
      const citationIds = new Set<string>();
      const regex = /\[(\d+)\]/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        // Ensure the ID exists in our database
        if (MOCK_CASES.find(c => c.id === match![1])) {
          citationIds.add(match![1]);
        }
      }

      // Map IDs to CitationReference objects
      const citations: CitationReference[] = Array.from(citationIds).map(id => {
        const c = MOCK_CASES.find(mc => mc.id === id)!;
        return {
          caseId: c.id,
          caseName: c.name,
          citation: c.citation,
          paragraphNumbers: c.paragraphs.map(p => p.number), // In a real app, we'd find specific paras
          relevanceScore: 95
        };
      });

      return { text, citations };

    } catch (error) {
      console.error("Gemini API Error:", error);
      return {
        text: "I encountered an error connecting to the AI service. Please ensure your API key is configured correctly.",
        citations: []
      };
    }
  },

  async searchCases({ query, filters }: any) {
    // Local search simulation (kept from original for the CasesPage)
    // In a real app, this might also be an API call or a vector search.
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    await delay(300);
    
    let results = MOCK_CASES.filter(c => {
      const q = query.toLowerCase();
      return c.name.toLowerCase().includes(q) || 
             c.citation.toLowerCase().includes(q) || 
             c.tags.some(t => t.toLowerCase().includes(q)) ||
             c.summary.toLowerCase().includes(q);
    });

    if (filters?.court) {
      results = results.filter(c => c.court === filters.court);
    }
    if (filters?.tags && filters.tags.length > 0) {
      results = results.filter(c => filters.tags!.some((tag: string) => c.tags.includes(tag)));
    }

    return results;
  }
};