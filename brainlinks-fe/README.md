# Brainlinks — Frontend

React + Vite + TypeScript + Tailwind SPA for **Brainlinks** (see the [root README](../README.md) for the full project).

## Pages

| Route | Component | Purpose |
|---|---|---|
| `/signup` | `Signup.tsx` | Create account |
| `/signin` | `Signin.tsx` | Login, stores JWT in `localStorage.token` |
| `/dashboard` | `Dashboard.tsx` | Card grid, add content, search + chat, share |
| `/brain/:hash` | `SharedBrain.tsx` | Public read-only view of a shared brain (**no auth**) |

## Highlights

- **`config.ts`** — exports `BACKEND_URL` from `VITE_BACKEND_URL`, defaulting to `http://localhost:3005`. It is **baked in at build time**: any backend URL change requires a rebuild + redeploy.
- **`hooks/useContent.tsx`** — fetches `/api/v1/content` once on mount and exposes `refresh()`. The dashboard calls `refresh()` after add/delete so the grid always matches the backend without a manual reload. The `Content` type carries `tags?: {_id, name}[]`.
- **`components/ui/ContentModal.tsx`** — used for **both create and edit**: pass `initial` to pre-fill title/type/link/text/tags and it submits `PATCH /api/v1/content/:id` (submit button reads "Update note"); without `initial` it POSTs. Tags are entered comma-separated.
- **`components/ui/Card.tsx`** — renders by `type`: YouTube → embed iframe, Twitter → `EmbeddedTweet`, text → the note body (`textContent`); plus tag chips and a pencil (**edit**) and ✕ (**delete**) action. The only external-link icon is the one that actually opens `link` in a new tab (decorative icons were removed).
- **`components/ui/SearchBar.tsx`** — debounced query to `/api/v1/content/search`, reads `res.data?.content`, and offers an "Answer using LLM" option that opens the chat modal. **Fallback:** if semantic search returns nothing it retries `/api/v1/content/title?searchValue=` so literal title matches still show.
- **`components/ui/ShareModal.tsx`** — on open, `GET /api/v1/brain/share` pre-fills the existing share link if sharing is already on; otherwise "Generate share link" → `POST /api/v1/brain/share` shows the copyable `${origin}/brain/<hash>`; "Disable sharing" revokes it.
- **403 interceptor (`main.tsx`)** — a global axios interceptor clears `localStorage.token` and redirects to `/signin` whenever an authenticated call returns 403 (expired/invalid token), so stale sessions never strand the user on a dead dashboard.
- **Auth forms** — `Signup`/`Signin` show inline error messages (no `alert()`), use a loading state on the button, confirm the password on signup, and render password fields as `type="password"`.

## Auth convention

`localStorage.getItem("token")` is sent as the raw `Authorization` header (the backend verifies the bare token, no `Bearer` prefix). Tokens expire after 7 days.

## Scripts

```bash
npm run dev      # vite dev server
npm run build    # tsc -b && vite build (typecheck + production bundle)
npm run lint     # eslint
npm run preview  # serve the production build
```