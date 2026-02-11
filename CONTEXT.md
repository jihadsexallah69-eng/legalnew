# Project Context

## Overview
- Name: `rcic-case-law-assistant`
- App type: Vite + React (TypeScript) frontend + Node/Express backend
- Purpose: RCIC case-law assistant using Pinecone retrieval + Groq response generation, with optional MCP tools

## Current Runtime
- Frontend dev server: `http://localhost:3000`
- Backend API server: `http://127.0.0.1:3001`
- Vite proxies `/api` to `http://localhost:3001` (`vite.config.ts`)
- Health endpoint: `GET /api/health`

## Tech Stack
- React 19 (`react`, `react-dom`)
- Vite 6
- TypeScript 5.8
- UI: Headless UI + Lucide icons
- Backend: Express 4 + `dotenv`
- LLM client: OpenAI SDK targeting Groq (`https://api.groq.com/openai/v1`)
- Retrieval: Pinecone query API
- Embeddings:
  - Default path in `.env.example`: Pinecone Inference (`llama-text-embed-v2`)
  - Alternate supported path: OpenAI-compatible embeddings (`EMBEDDING_PROVIDER=openai|openai_compat`)

## Local Development
1. Install dependencies: `npm install`
2. Configure `.env` from `.env.example`
3. Run backend: `npm run dev:server`
4. Run frontend: `npm run dev`

## Scripts
- `npm run dev` - Vite dev server (port `3000`, host `0.0.0.0`)
- `npm run dev:server` - API server (defaults to `127.0.0.1:3001`)
- `npm run build` - Production build
- `npm run preview` - Preview build

## API Endpoints
- `GET /api/health` - liveness check
- `POST /api/chat` - main chat route; returns `{ text, citations }`
- `POST /api/ingest` - placeholder, not implemented

## Key Files
- `App.tsx` - Main app shell/router
- `pages/ChatPage.tsx` - Chat UI and send flow
- `components/chat/SourcesPanel.tsx` - Citation display
- `lib/api.ts` - Frontend API client (`/api/chat`)
- `server/index.js` - Express routes and response shaping
- `server/rag/grounding.js` - Retrieval glue + grounded prompt + citation extraction
- `server/clients/pinecone.js` - Pinecone query client
- `server/clients/embeddings.js` - Embedding provider logic
- `server/clients/groq.js` - Groq Responses API wrapper
- `vite.config.ts` - Dev proxy and host/port config

## Runtime Flow (Chat)
1. UI sends user prompt to `POST /api/chat`.
2. Server retrieves top-K Pinecone matches (query embedding + vector search).
3. Server builds a grounded prompt and tags sources as `[P1]`, `[P2]`, etc.
4. Server calls Groq Responses API and optionally attaches MCP tool servers if configured.
5. Server extracts cited `[P#]` ids from model text and maps them back to source metadata.
6. Frontend renders response text plus citations in `SourcesPanel`.

## Environment Variables
### Used directly by current chat runtime
- `GROQ_API_KEY` (required)
- `GROQ_MODEL` (optional, default `llama-3.3-70b-versatile`)
- `PINECONE_API_KEY` (required for Pinecone retrieval/embedding path)
- `PINECONE_INDEX_HOST` (required for retrieval)
- `PINECONE_NAMESPACE` (optional)
- `PINECONE_API_VERSION` (optional for Pinecone embeddings, default `2025-10`)
- `RETRIEVAL_TOP_K` (optional, default `6`)
- `MCP_BASE_URL` (optional)
- `MCP_BASE_URL_SECONDARY` (optional)
- `MCP_API_KEY` (optional)
- `EMBEDDING_PROVIDER` (optional, default `openai`; `.env.example` sets `pinecone`)
- `EMBEDDING_MODEL` (required for selected embedding provider)
- `EMBEDDING_BASE_URL` (optional; defaults depend on provider)
- `EMBEDDING_DIM` (optional but recommended for dimension checks)
- `EMBEDDING_API_KEY` (required only for `openai|openai_compat` embedding path)
- `PORT` (optional, default `3001`)
- `HOST` (optional, default `127.0.0.1`)

### Present in `.env.example` but not read by current `server/index.js`
- `MCP_SERVER_LABEL`
- `MCP_SERVER_LABEL_SECONDARY`
- `MCP_SERVER_DESCRIPTION`

## Notes
- `README.md` currently references `GEMINI_API_KEY` and a single `npm run dev` flow; this does not match the active Groq + Express setup.
