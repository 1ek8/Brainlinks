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
- **`hooks/useContent.tsx`** — fetches `/api/v1/content` once on mount and exposes `refresh()`. The dashboard calls `refresh()` after add/delete so the grid always matches the backend without a manual reload.
- **`components/ui/SearchBar.tsx`** — debounced query to `/api/v1/content/search`, reads `res.data?.content`, and offers an "Answer using LLM" option that opens the chat modal.
- **`components/ui/ShareModal.tsx`** — creates/reuses the share hash via `POST /api/v1/brain/share` and shows the copyable `${origin}/brain/<hash>` link; can also disable sharing.
- **`components/ui/Card.tsx`** — renders by `type`: YouTube → embed iframe, Twitter → `EmbeddedTweet`, text → the note body (`textContent`); optional `onDelete` shows the delete action.

## Auth convention

`localStorage.getItem("token")` is sent as the raw `Authorization` header (the backend verifies the bare token, no `Bearer` prefix).

## Scripts

```bash
npm run dev      # vite dev server
npm run build    # tsc -b && vite build (typecheck + production bundle)
npm run lint     # eslint
npm run preview  # serve the production build
```