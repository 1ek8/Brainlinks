# Brainlinks — a "second brain" note app

Save notes (text, YouTube, Twitter), organize them with tags, search them by *meaning* (not keywords), and ask an LLM questions grounded in exactly what you saved. Share a read-only view of your brain with anyone via a link.

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
**How:** the "Add Content" modal (`ContentModal.tsx`) POSTs `{title, type, link | textContent, tags?}` to `POST /api/v1/content`. The card grid then refreshes instantly. `ContentModal` also carries tags (comma-separated) which the backend upserts into a `Tag` collection and links to the note.
**Why:** keeping embed/scrape work async (background processor in `contentProcessor.ts`) means the save feels instant; the heavy embedding happens right after without blocking the response.
**Why link/type validation:** YouTube- and Twitter-type notes must have a matching URL (backend regex checks against `youtu.be|youtube.com/*` / `twitter.com|x.com/<user>/status/<id>`). The backend rejects mismatches with a 400 whose message is surfaced inside the modal, so a "YouTube" note can't quietly hold a random link.

### 2. Search your brain (cards refresh + results)
**How:** `SearchBar.tsx` debounces the query and calls `GET /api/v1/content/search?q=…`. The query string is embedded and `querySimilarVectors()` fetches the top-5 nearest vectors from Pinecone; matching notes come back from Mongo. If semantic search returns **zero** results, the bar falls back to `GET /api/v1/content/title?searchValue=…` (case-insensitive substring on the title), so literal title matches still surface even when embeddings miss.
**Why (why `res.data.content`):** the search endpoint returns `{ content: [...] }` (an object, not a bare array). The UI reads `res.data?.content`, else results would never render. The dashboard `useContent()` hook does the same for the full list and exposes `refresh()` so add/delete immediately re-render — no manual reload.

### 3. "Ask your Brain" (RAG chat)
**How:** `ChatModal` POSTs a question to `POST /api/v1/chat`. The backend embeds the question → pulls the 5 most relevant notes from Pinecone → asks OpenRouter to answer **using only that context**, with a fallback chain of free models.
**Why:** grounding the LLM in the retrieved notes (retrieval-augmented generation) lets the assistant answer from *your* saved knowledge instead of general training data — and say "I cannot answer this based on your current brain state" when it isn't there.
**Why the model list:** the original `meta-llama/llama-3-8b-instruct:free` was discontinued (HTTP 404 "no endpoints"), which silently broke every chat call. The fix tries models in order (`nvidia/nemotron-3-super-120b-a12b:free` → `google/gemma-4-26b-a4b-it:free` → `google/gemma-4-31b-it:free`) and takes the first usable answer.

### 4. Share your brain
**How:** "Share brain" opens `ShareModal.tsx`, which first calls `GET /api/v1/brain/share` to prefill the current link if sharing is already on (no re-typing). Enabling calls `POST /api/v1/brain/share {share:true}` → returns (or reuses) a 10-char hash → UI shows `${origin}/brain/<hash>`. Anyone visiting that URL opens the public `SharedBrain` page which calls `GET /api/v1/brain/:shareLink` (no auth) and renders the notes read-only. "Disable sharing" sends `{share:false}`, deleting the hash so the link dies.
**Why:** the hash is stored in a separate `LinkModel` (one per user), so sharing is a lightweight toggle — revoking one hash never touches the notes themselves.

### 5. Delete content
**How:** each card has a delete (✕) action → `DELETE /api/v1/content` with `contentId`. The backend removes the Mongo document **and** the Pinecone vector (`deleteFromPinecone`), then the dashboard refreshes.
**Why (why deletion needed the Pinecone step):** if only Mongo were cleaned, deleted notes would still surface in semantic search and chat context (matched by their leftover vector). Removing the vector keeps search and chat honest.

### 6. Edit & update notes
**How:** each card has a pencil icon → `ContentModal` opens **pre-filled** (title, type, link/text, tags) and submits `PATCH /api/v1/content/:id` instead of POST. The backend validates the link/type consistency again, upserts tags, re-embeds the vector into Pinecone (idempotent upsert by `_id`, so no duplicate vectors), and returns the updated doc.
**Why (why PATCH has its own validation):** reuse of the same `contentSchema` means edits get exactly the same guarantees as creates — you can't silently retype a note into a mismatched link.

### 7. Tags
**How:** a comma-separated tags input in `ContentModal`; each `Card` renders the note's tags as purple chips. Tags are a separate `Tag` model (`_id`, `name`, owned by `userId`) with a unique `(name, userId)` index — `resolveTagIds()` upserts them on save so the same tag name reuses the same doc. All GET routes `populate("tags", "name")` so chips carry `{_id, name}`.
**Why (why a separate collection, not strings):** a unique index on `(name, userId)` keeps one canonical tag per user — no case/space drift accumulating duplicate strings, and a future "tag → its notes" query is a trivial Mongo lookup on the `content.tags` array.

### 8. Auth session (single-part static)
**How:** signin stores the JWT in `localStorage.token`; every request sends it as a bare `Authorization` header. Tokens carry `expiresIn: "7d"`, and a global axios interceptor clears the token + redirects to `/signin` on any 403 (expired or invalid).
**Why:** bare-header tokens keep the FE simple (no `Bearer` prefix parsing on the BE), and the interceptor means a stale token never leaves the user stuck on a dead dashboard.

---

## API reference

Auth: pass the JWT returned by signin in the `Authorization` header (bare token, no `Bearer` prefix). Tokens expire after 7 days; a 403 (expired/invalid) auto-logs you out.

| Method | Path | Auth | Body/Query | Returns |
|---|---|---|---|---|
| POST | `/api/v1/signup` | – | `{username, password}` | `"User Signed up"` (409 if taken) |
| POST | `/api/v1/signin` | – | `{username, password}` | `{token}` |
| POST | `/api/v1/content` | ✓ | `{title, type, link?, textContent?, tags?}` | `{message}` |
| GET | `/api/v1/content` | ✓ | – | `{content: [...]}` (with tags populated) |
| GET | `/api/v1/content/search?q=` | ✓ | query string | `{content: [...]}` (top-5) |
| GET | `/api/v1/content/title?searchValue=` | ✓ | query string | `{content: [...]}` (case-insensitive substring on title) |
| PATCH | `/api/v1/content/:id` | ✓ | `{title, type, link?, textContent?, tags?}` | `{message, content}` |
| DELETE | `/api/v1/content` | ✓ | `{contentId}` | `{message}` |
| POST | `/api/v1/chat` | ✓ | `{query}` | `{answer}` |
| GET | `/api/v1/brain/share` | ✓ | – | `{hash}` or `{hash: null}` |
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

## Deployment / CI

Prod runs on **GCP Cloud Run (`asia-south1`)**, branded as `brainlinks.byaniket.site` (FE) and `api-brainlinks.byaniket.site` (API) via a Cloudflare worker proxy. Deploys are **automatic via Cloud Build triggers** — no manual `gcloud builds submit`:

- push touching `brainlinks-be/**` → trigger **`be-deploy`** → build + deploy `brainlinks-be`
- push touching `brainlinks-fe/**` → trigger **`fe-deploy`** → build + deploy `brainlinks-fe`

Both `cloudbuild.yaml` files live next to their service and set `options.logging: CLOUD_LOGGING_ONLY` (required because the triggers run as the project's compute SA), and each docker step sets `dir:` to the service subdir so builds resolve the Dockerfile from a full-repo checkout. Infra/deploy runbook details are in `deployment.md` (git-ignored, personal) and the brand/domain runbook in `deployment-domain.md`.