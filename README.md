# Brainlinks — a "second brain" note app

Save notes (text, YouTube, Twitter), search them by *meaning* (not keywords), and ask an LLM questions grounded in exactly what you saved. Share a read-only view of your brain with anyone via a link.

This monorepo has two apps:

| Path | Stack | Purpose |
|---|---|---|
| `brainlinks-be` | Express + TypeScript, MongoDB Atlas, Pinecone, OpenRouter, Puppeteer | REST API + background embedding pipeline |
| `brainlinks-fe` | React + Vite + TypeScript + Tailwind | SPA (auth, dashboard, chat, share view) |

---

## Architecture

```
Browser (SPA)
   │  /api/v1/*  (JWT auth header)
   ▼
Express API (Cloud Run) ──┬── MongoDB Atlas   (notes, users, share hashes)
                          ├── Pinecone        (384-dim vectors per note)
                          └── OpenRouter      (LLM for the "Ask your Brain" chat)
```

Notes are never just stored: when you add content, the backend asynchronously
embeds it (`Xenova/all-MiniLM-L6-v2`) and upserts the vector into Pinecone,
namespaced by `userId` so every user searches *their* brain only.

---

## Features — how and why

### 1. Add content
**How:** the "Add Content" modal (`ContentModal.tsx`) POSTs `{title, type, link | textContent}` to `POST /api/v1/content`. The card grid then refreshes instantly.
**Why:** keeping embed/scrape work async (background processor in `contentProcessor.ts`) means the save feels instant; the heavy embedding happens right after without blocking the response.

### 2. Search your brain (cards refresh + results)
**How:** `SearchBar.tsx` debounces the query and calls `GET /api/v1/content/search?q=…`. The query string is embedded and `querySimilarVectors()` fetches the top-5 nearest vectors from Pinecone; matching notes come back from Mongo.
**Why (why `res.data.content`):** the search endpoint returns `{ content: [...] }` (an object, not a bare array). The UI reads `res.data?.content`, else results would never render. The dashboard `useContent()` hook does the same for the full list and exposes `refresh()` so add/delete immediately re-render — no manual reload.

### 3. "Ask your Brain" (RAG chat)
**How:** `ChatModal` POSTs a question to `POST /api/v1/chat`. The backend embeds the question → pulls the 5 most relevant notes from Pinecone → asks OpenRouter to answer **using only that context**, with a fallback chain of free models.
**Why:** grounding the LLM in the retrieved notes (retrieval-augmented generation) lets the assistant answer from *your* saved knowledge instead of general training data — and say "I cannot answer this based on your current brain state" when it isn't there.
**Why the model list:** the original `meta-llama/llama-3-8b-instruct:free` was discontinued (HTTP 404 "no endpoints"), which silently broke every chat call. The fix tries models in order (`minimax/minimax-m3:free` → `google/gemma-4-26b-a4b-it:free`) and returns a usable answer if any succeeds.

### 4. Share your brain
**How:** "Share brain" opens `ShareModal.tsx` → `POST /api/v1/brain/share {share:true}` returns (or reuses) a 10-char hash → UI shows `${origin}/brain/<hash>`. Anyone visiting that URL opens the public `SharedBrain` page which calls `GET /api/v1/brain/:shareLink` (no auth) and renders the notes read-only. "Disable sharing" sends `{share:false}`, deleting the hash so the link dies.
**Why:** the hash is stored in a separate `LinkModel` (one per user), so sharing is a lightweight toggle — revoking one hash never touches the notes themselves.

### 5. Delete content
**How:** each card has a delete (✕) action → `DELETE /api/v1/content` with `contentId`. The backend removes the Mongo document **and** the Pinecone vector (`deleteFromPinecone`), then the dashboard refreshes.
**Why (why deletion needed the Pinecone step):** if only Mongo were cleaned, deleted notes would still surface in semantic search and chat context (matched by their leftover vector). Removing the vector keeps search and chat honest.

---

## API reference

Auth: pass the JWT returned by signin in the `Authorization` header (bare token, no `Bearer` prefix).

| Method | Path | Auth | Body/Query | Returns |
|---|---|---|---|---|
| POST | `/api/v1/signup` | – | `{username, password}` | `"User Signed up"` (409 if taken) |
| POST | `/api/v1/signin` | – | `{username, password}` | `{token}` |
| POST | `/api/v1/content` | ✓ | `{title, type, link?, textContent?}` | `{message}` |
| GET | `/api/v1/content` | ✓ | – | `{content: [...]}` |
| GET | `/api/v1/content/search?q=` | ✓ | query string | `{content: [...]}` (top-5) |
| GET | `/api/v1/content/title?searchValue=` | ✓ | query string | `{content: [...]}` (regex on link) |
| DELETE | `/api/v1/content` | ✓ | `{contentId}` | `{message}` |
| POST | `/api/v1/chat` | ✓ | `{query}` | `{answer}` |
| POST | `/api/v1/brain/share` | ✓ | `{share:true\|false}` | `{hash}` / `{message}` |
| GET | `/api/v1/brain/:shareLink` | – | – | `{username, content: [...]}` |

---

## Run locally

```bash
# Backend (needs MONGO_URL, JWT_PASSWORD, PINECONE_*, OPENROUTER_API_KEY in brainlinks-be/.env)
cd brainlinks-be && npm run build && npm start   # :3005

# Frontend (falls back to http://localhost:3005, or set VITE_BACKEND_URL)
cd brainlinks-fe && npm run dev                  # :5173
```

Deployment/CI notes (GCP Cloud Run + Cloud Build) live in `deployment.md` (git-ignored, personal runbook).