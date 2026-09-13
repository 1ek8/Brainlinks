# AppForge — GCP Deployment Plan

Deploys the AppForge web app (frontend SPA + LLM-backed API) to Google Cloud Platform
using the GCP free trial. Target cost: ~$0 for the trial period.

## Region policy

**Default region for ALL GCP resources: `asia-south1` (Mumbai).** Do not provision resources
elsewhere. The only exception is if the application itself requires spawning VMs across the
globe — which today it does NOT:

- Generated websites run **in the user's browser** via WebContainer (client-side), not on GCP.
- The only outbound traffic is to OpenRouter's LLM API (external service, outside our region control).
- Therefore every Cloud Run service, container image, and Cloud Build job below stays in `asia-south1`.

If a future feature ever needs global VMs (e.g., per-region compute near users), that is a
deliberate, documented exception — never a default.

## Architecture recap

```
Browser (user)  --https-->  Cloudflare DNS + Cloudflare Worker reverse-proxy (byaniket.site)
                              |   appforge.byaniket.site     -> appforge-fe-...run.app
                              |   appforge-api.byaniket.site -> appforge-api-...run.app
                              v  VITE_BACKEND_URL baked at build time
                         Cloud Run: appforge-api       (Express/Bun, scale-to-zero)
                              |   apps/api/Dockerfile, OPENROUTER_API_KEY via Secret Manager
                              v
                         OpenRouter LLM API (external, outbound only)
```

Both appforge-* services stay on **Cloud Run in `asia-south1`**, scale to zero when idle
(that is what makes this near-free), and are served under branded subdomains via a
free Cloudflare Worker. The `*.run.app` URLs remain live as primary origins / rollback path.
No database. All GCP resources in `asia-south1`.

### Live URLs

| Component | URL |
| --- | --- |
| Frontend (canonical) | https://appforge.byaniket.site |
| Backend (canonical) | https://appforge-api.byaniket.site |
| Cloud Run FE origin | https://appforge-fe-500273261728.asia-south1.run.app |
| Cloud Run API origin | https://appforge-api-500273261728.asia-south1.run.app |
| Cloudflare zone | byaniket.site (account 324fbaa1…, zone 410c37cd…) |
| Worker | `appforge-proxy` (Account ID 324fbaa1869bcadb771e16c3bda173b1) |

Cloud Run services: `appforge-api` / `appforge-fe` · Build triggers: `api-deploy` /
`fe-deploy` · Secret: `openrouter_api_key` (secretAccessor on the compute SA).

## How to use this file (read this first)

This is the **deployment runbook for the whole `byaniket.site` family**, not just AppForge.
Every GCP/Cloudflare one-time setup below is DONE, so a brand-new project needs only:

1. GCP: build + deploy its FE/API to Cloud Run in `asia-south1` (Phase 3.7 step 1),
2. Cloudflare dashboard: add 2 proxied CNAMEs (Phase 3.7 step 2) — the only manual move,
3. add 2 lines to the worker `ORIGINS` map and PUT it (Phase 3.7 step 3).

Workflow for a new project:

- Copy this file into the new project's **local** repo (it is gitignored here and will NOT
  come with a clone). Keep `deployment.md` out of every repo you push.
- Tell the opencode terminal working on that project:
  > "Read `deployment.md` in this repo, follow Phase 3.7 to deploy this project, and give
  > me concise numbered steps to follow (flag anything that needs me to click in the
  > Cloudflare dashboard or approve a gcloud/git push)."
- The terminal should operate `gcloud` and the Cloudflare API on your behalf and ask before
  anything that costs money (LLM calls), needs your credentials, or needs a dash click.

No Search Console re-verification, no SSL setup, no NS change, no worker-route changes are
ever needed again for a new subdomain — those are all one-time and already done.

---

## Phase 0 — One-time GCP setup (once, ~10 min)

0.1. Create a GCP account and project. This deployment uses project `appforge-app-1ek8`
(account `dharmadyumna@gmail.com`, account profile `ddyumna-april26`). Attach a billing
account (required for Cloud Run; the free tier + $300/90-day trial credit keep cost ~$0).

0.2. Install the `gcloud` CLI (https://cloud.google.com/sdk/docs/install) and authenticate:
```bash
gcloud auth login
gcloud config set project appforge-app-1ek8
gcloud config set run/region asia-south1
```

0.3. Enable the required APIs:
```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

0.4. Make sure your `OPENROUTER_API_KEY` is available. It is injected at deploy time via
`--set-env-vars`; it is never baked into an image or committed to git.

**Checkpoint:** `gcloud config get-value project` prints `appforge-app-1ek8`.
`gcloud services list --enabled` shows the three APIs above.

---

## Phase 1 — Deploy the backend (`appforge-api`)

From the repo **root** (the Dockerfiles assume repo-root build context):

```bash
gcloud run deploy appforge-api \
  --source . --dockerfile apps/api/Dockerfile \
  --region asia-south1 --allow-unauthenticated \
  --memory 512Mi --cpu 1 --min-instances 0 \
  --set-env-vars OPENROUTER_API_KEY=<your key>
```

What this does:
- Cloud Build uploads the repo, runs `apps/api/Dockerfile` (bun install → `bun run build` → bundled `dist/index.js`).
- Cloud Run starts the container, injects `PORT=8080`, and probes `GET /` (our health route → `{"status":"ok"}`).
- `--min-instances 0` enables **scale-to-zero**: no traffic → no bill.
- `--allow-unauthenticated` makes the URL public.

Record the printed URL, e.g. `https://appforge-api-xxxxx-uc.a.run.app`.

**Checkpoint (no LLM use):** `curl https://appforge-api-xxxxx-uc.a.run.app/` → `{"status":"ok"}`.

---

## Phase 2 — Verify the AI pipeline (2 LLM calls, ASK FIRST)

Before running these, confirm with the person managing the repo — each call uses OpenRouter
credits (cents on DeepSeek V4 Flash, but we conserve them):

2.1. `curl -N <api_url>/template -X POST -H "Content-Type: application/json" -d '{"prompt":"simple todo app"}'`
→ expect a React-classified template response.

2.2. `curl -N <api_url>/chat -X POST -H "Content-Type: application/json" -d '{"prompt":"hello"}'`
→ expect a streamed response.

**Checkpoint:** both endpoints return plausible output against prod.

---

## Phase 3 — Deploy the frontend (`appforge-fe`)

First set the API URL captured in Phase 1 as a build-time variable (Vite inlines it):

```bash
gcloud run deploy appforge-fe \
  --source . --dockerfile apps/fe/Dockerfile \
  --region asia-south1 --allow-unauthenticated \
  --memory 256Mi --cpu 1 --min-instances 0 \
  --build-arg VITE_BACKEND_URL=https://appforge-api-xxxxx-uc.a.run.app
```

What this does:
- Multi-stage build: stage 1 installs deps and `bun run build` with `VITE_BACKEND_URL`;
  stage 2 copies only `dist/` + `serve.ts` into a slim runtime image.
- `serve.ts` serves the SPA with `Cross-Origin-Embedder-Policy: require-corp` and
  `Cross-Origin-Opener-Policy: same-origin` (required for WebContainer), SPA fallback to
  `index.html`, and immutable caching for hashed `/assets/*`.

**Checkpoint (no LLM use):**
- `curl -I https://appforge-fe-xxxxx-uc.a.run.app/` → 200 with COOP/COEP headers.
- `curl -s https://appforge-fe-xxxxx-uc.a.run.app/builder` → returns `index.html` markup.
- In a browser: open the URL, confirm `crossOriginIsolated === true` in the console,
  then generate + run a site in the in-browser preview (WebContainer runs locally, no LLM/API cost).

---

## Phase 3.5 — Continuous deployment (auto-redeploy on git push)

Once the two services are live, wire up Cloud Build triggers so a `git push` to `main`
auto-rebuilds and redeploys both. This requires a 2nd-gen GitHub connection + repository
(created once in the Console), then two triggers via gcloud:

```bash
SA="projects/appforge-app-1ek8/serviceAccounts/500273261728-compute@developer.gserviceaccount.com"
REPO="projects/appforge-app-1ek8/locations/asia-south1/connections/appforge-github/repositories/appforge-repo"

gcloud beta builds triggers create github --name=api-deploy \
  --repository=$REPO --region=asia-south1 --branch-pattern="main" \
  --build-config=cloudbuild/api.yaml --service-account=$SA

gcloud beta builds triggers create github --name=fe-deploy \
  --repository=$REPO --region=asia-south1 --branch-pattern="main" \
  --build-config=cloudbuild/fe.yaml --service-account=$SA
```

Permissions the compute SA (or any user-managed SA) needs (one-time):
- `roles/run.admin` + `roles/iam.serviceAccountUser` (deploy to Cloud Run),
- `roles/artifactregistry.writer` + `roles/storage.objectViewer` (push images / fetch source),
- `roles/logging.logWriter` (build logs),
- `roles/secretmanager.secretAccessor` (for the api `--set-secrets` step).

`cloudbuild/api.yaml` and `cloudbuild/fe.yaml` (committed at repo root) contain the full
`gcloud run deploy` steps, including `--set-secrets OPENROUTER_API_KEY=openrouter_api_key:latest`.
Both images go to Artifact Registry `asia-south1-docker.pkg.dev/appforge-app-1ek8/appforge/`.
Builds use 2nd-gen Cloud Build (~2 min each, within free-tier quota).

**Checkpoint:** push a commit to `main` and watch `gcloud builds list --region=asia-south1` —
each push spawns a build per trigger (api-deploy + fe-deploy) that redeploys the live Cloud Run
services. Verify live URLs (`GET /` → 200 + COOP/COEP headers on the FE) after a deploy.
Validated end-to-end on commit `fb42c03`.

---

## Phase 3.6 — Custom domain via Cloudflare (free, ~$0)

Cloud Run **native domain mappings are NOT available in `asia-south1`** (501 UNIMPLEMENTED at
create time; supported only in asia-east1/asia-northeast1/asia-southeast1, europe-north1/west1/west4,
us-central1/east1/east4/west1). Rather than move the deployed region, we front the asia-south1
services with Cloudflare free plan:

1. **DNS**: move the zone to Cloudflare (NS `brian.ns.cloudflare.com` / `itzel.ns.cloudflare.com`).
   Leave the apex on cheap hosting (not served by us); use **proxied (orange)** CNAMEs:
   - `appforge`      → `appforge-fe-500273261728.asia-south1.run.app`
   - `appforge-api`  → `appforge-api-500273261728.asia-south1.run.app`
2. **Domain verification** (required for domain mappings AND to prove ownership to Google):
   Search Console → verify the domain with TXT
   `google-site-verification=DhssDqDC3zhAB11hP3zNgEK0auH3ofTDyx6LURL-eAQ` (keep the record).
3. **SSL**: Cloudflare SSL/TLS = **Full (strict)**; Always Use HTTPS ON. Free Universal SSL
   covers only the apex + `*.byaniket.site` (ONE label). That is why there is no
   `api.appforge.*` — two-level subdomains fail TLS at the edge (verified).
4. **Worker reverse-proxy** instead of host-header overrides (those are **Enterprise-only** on
   Cloudflare): a classic service-worker script (`appforge-proxy`) reads the request hostname
   from a `ORIGINS` config map and forwards to the matching Cloud Run origin. A **single
   wildcard route** `*byaniket.site/*` → `appforge-proxy` serves every project subdomain, so
   adding a project later never touches routes again.

Worker script (`appforge-proxy`, Service Worker format — this is the deployed source;
edit the `ORIGINS` map to add a project):

```js
// appforge-proxy — Cloudflare Worker reverse-proxy for *.byaniket.site
// Route: *byaniket.site/* (single wildcard; replaced the old per-hostname routes)
//
// Adding a new project N:
//   1. add two entries below:
//        'N.byaniket.site':      'https://<fe-run-url>',
//        'api-N.byaniket.site':  'https://<api-run-url>',
//   2. PUT this file to accounts/<ACCOUNT_ID>/workers/scripts/appforge-proxy
// (DNS CNAMEs for N and api-N must already exist as proxied records.)

addEventListener('fetch', event => {
  event.respondWith(handle(event.request));
});

const ORIGINS = {
  'appforge.byaniket.site': 'https://appforge-fe-500273261728.asia-south1.run.app',
  'appforge-api.byaniket.site': 'https://appforge-api-500273261728.asia-south1.run.app',
};

async function handle(request) {
  const url = new URL(request.url);
  const origin = ORIGINS[url.hostname];
  if (!origin) {
    return new Response('not found', { status: 404 });
  }
  const target = new URL(url.pathname + url.search, origin);

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('cf-ray');
  headers.delete('cf-connecting-ip');
  headers.delete('cf-ipcountry');
  headers.delete('cf-visitor');

  const init = { method: request.method, headers, redirect: 'manual' };
  if (!['GET', 'HEAD'].includes(request.method) && request.body) {
    init.body = request.body;
    init.duplex = 'half';
  }

  const resp = await fetch(target, init);
  const respHeaders = new Headers(resp.headers);
  respHeaders.delete('content-length');
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: respHeaders,
  });
}
```

Deploy/redeploy the worker:
```bash
export CLOUDFLARE_API_TOKEN=<token>   # scope: Workers Scripts Edit + Zone Workers Routes Edit
export CF_ACCOUNT_ID=324fbaa1869bcadb771e16c3bda173b1
export CF_ZONE_ID=410c37cda78999249b84f8b7739b3104   # byaniket.site

# fetch the current source (so you edit the live version, never from memory):
curl -s "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/workers/scripts/appforge-proxy" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -o appforge-proxy.js

# edit appforge-proxy.js → PUT it back:
curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/workers/scripts/appforge-proxy" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/javascript" \
  --data-binary @appforge-proxy.js
```

Worker changes propagate in ~5–15 s — **wait** before testing (a too-early test reports
404 even when the fix is correct). Current route: `9d512d819955421991ae9f1a083ee2a8`
`*byaniket.site/*` (the two per-hostname routes were deleted during the v2 migration).

**Token scope:** the "Edit Cloudflare Workers" template grants Workers Scripts/Routes Edit
+ Zone Read but **NOT Zone DNS Edit** — create DNS records in the dashboard (or extend the
token to `Zone > DNS > Edit`).

**Checkpoints (no LLM use), all verified live:**
- `curl https://appforge-api.byaniket.site/` → `{"status":"ok"}` (TLS OK, proxy → API).
- `curl -I https://appforge.byaniket.site/` → 200, COOP/COEP + `x-content-type-options: nosniff`.
- `curl https://appforge.byaniket.site/builder` → SPA fallback `index.html`.
- `curl -X OPTIONS https://appforge-api.byaniket.site/chat -H "Origin: https://appforge.byaniket.site"` → 204 with `access-control-allow-origin: *`.
- Live bundle references `appforge-api.byaniket.site` (deployed via CD on commit `a180504`).

---

## Phase 3.7 — Adding a new project ({N}) to byaniket.site (self-serve runbook)

Goal: project `{N}` live at `https://{N}.byaniket.site` (FE) and
`https://api-{N}.byaniket.site` (API). One-time infra is done; this is everything a
fresh terminal needs. REMEMBER: verify after each step and **wait ~10 s after any worker
upload** before testing it. Costs beyond free tiers: only the LLM calls (always ASK first).

> Naming rule: every subdomain must be **one label deep** under `byaniket.site` (free SSL
> wildcard covers `*.byaniket.site` only). `{N}` and `api-{N}` both qualify.
> Consistency note: AppForge's API happens to be `appforge-api.byaniket.site` (suffix).
> New projects should use the `api-{N}` prefix pattern shown here — the worker map is
> explicit, so write the exact hostnames you choose.

### 1. Deploy FE + API to Cloud Run (asia-south1)

Each project ships two containers. Mirror AppForge's committed `cloudbuild/*.yaml` pattern
(the Dockerfiles are per-app; the steps are identical shape):

- `cloudbuild/api.yaml` (name yours `cloudbuild/{N}-api.yaml`): docker build+push the API
  image to `asia-south1-docker.pkg.dev/${PROJECT_ID}/appforge/{N}-api:${SHORT_SHA}`, then
  `gcloud run deploy {N}-api --region=asia-south1 --allow-unauthenticated
  --memory=512Mi --cpu=1 --min-instances=0 --set-secrets=OPENROUTER_API_KEY=openrouter_api_key:latest`.
  (If a project has no LLM need, drop the secrets flag.)
- `cloudbuild/fe.yaml` (yours `cloudbuild/{N}-fe.yaml`): same image shape, deploy `{N}-fe`
  with `--memory=256Mi`, and bake the API URL at build time:
  `_VITE_BACKEND_URL: https://api-{N}.byaniket.site` (the FE must compile an absolute API URL).
- Create triggers (2nd-gen, same compute SA — see Phase 3.5 for names/permissions):
  ```bash
  SA="projects/appforge-app-1ek8/serviceAccounts/500273261728-compute@developer.gserviceaccount.com"
  REPO="projects/appforge-app-1ek8/locations/asia-south1/connections/appforge-github/repositories/<that-repo>"
  gcloud beta builds triggers create github --name="{N}-api-deploy" \
    --repository=$REPO --region=asia-south1 --branch-pattern="main" \
    --build-config=cloudbuild/{N}-api.yaml --service-account=$SA
  gcloud beta builds triggers create github --name="{N}-fe-deploy" \
    --repository=$REPO --region=asia-south1 --branch-pattern="main" \
    --build-config=cloudbuild/{N}-fe.yaml --service-account=$SA
  ```
  (If {N} lives in a separate repo, connect it in the Console first under the existing
  `appforge-github` connection; use its repository resource id above. `options.logging:
  CLOUD_LOGGING_ONLY` in both build files — required with a user SA.)
- Record the two `*.run.app` URLs printed by `gcloud run deploy`.

**Checkpoint:** `gcloud run services list` shows `{N}-api` + `{N}-fe` HEALTHY;
`curl <{N}-api run.app>/` → `{"status":"ok"}`; `curl -I <{N}-fe run.app>/` → 200 + COOP/COEP.

### 2. Cloudflare DNS (dashboard — the only manual step)

Zone `byaniket.site` → **DNS → Add record**, proxied (orange), two records:
- CNAME `{N}` → `<{N}-fe run.app URL>`
- CNAME `api-{N}` → `<{N}-api run.app URL>`

(The terminal's Cloudflare token has no DNS Edit permission → this is done by the user.)
Wait ~1 min for DNS + SSL (free wildcard cert already covers both names).

**Checkpoint:** `dig +short {N}.byaniket.site` resolves, and
`curl -s https://{N}.byaniket.site/` returns content (not a CF error page).

### 3. Add {N} to the proxy worker (terminal)

```bash
export CLOUDFLARE_API_TOKEN=<token>
CF_ACCOUNT_ID=324fbaa1869bcadb771e16c3bda173b1
curl -s "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/workers/scripts/appforge-proxy" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -o appforge-proxy.js
```
Edit the `ORIGINS` map in `appforge-proxy.js`:
```js
'{N}.byaniket.site':      '<{N}-fe run.app URL>',
'api-{N}.byaniket.site':  '<{N}-api run.app URL>',
```
then PUT it back (commands in Phase 3.6). **Wait ~10 s before testing.** No route changes.

### 4. Verify (no LLM use)

- `curl https://api-{N}.byaniket.site/` → `{"status":"ok"}` [200].
- `curl -I https://{N}.byaniket.site/` → 200 with COOP/COEP + `x-content-type-options: nosniff`.
- SPA fallback: any unknown path on the FE (e.g. `/builder` if the app uses it) → `index.html`.
- Preflight: `curl -X OPTIONS https://api-{N}.byaniket.site/<post-route> -H "Origin: https://{N}.byaniket.site" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type"` → 204 + `access-control-allow-origin: *`.
- If an LLM feature exists, tell the user it is ready and let them approve a test call.

### Worked example — {N} = brainlinks (LIVE)

- FE: `brainlinks.byaniket.site` ← CNAME → `https://brainlinks-fe-bsdbt336pa-el.a.run.app`
- API: `api-brainlinks.byaniket.site` ← CNAME → `https://brainlinks-be-bsdbt336pa-el.a.run.app`
- `_VITE_BACKEND_URL=https://api-brainlinks.byaniket.site` — set as the **default substitution** in
  `brainlinks-fe/cloudbuild.yaml`, so no per-trigger substitution is needed.
- Build files live in each service dir (`brainlinks-fe/cloudbuild.yaml`, `brainlinks-be/cloudbuild.yaml`),
  not in `cloudbuild/`.
- Triggers: **`fe-deploy`** (`brainlinks-fe/**` → FE) and **`be-deploy`** (`brainlinks-be/**` → BE),
  both 2nd-gen on connection `brainlinks-github` / repo `brainlinks`, branch `^main$`, region `asia-south1`.
- worker ORIGINS entries:
  ```js
  'brainlinks.byaniket.site': 'https://brainlinks-fe-bsdbt336pa-el.a.run.app',
  'api-brainlinks.byaniket.site': 'https://brainlinks-be-bsdbt336pa-el.a.run.app',
  ```
- Both triggers were created in the **Cloud Console** (see the create-trigger gotcha below) and use the
  project's default compute SA. `options.logging: CLOUD_LOGGING_ONLY` + `dir:` per docker step (see Gotchas).
- Validated end-to-end: commit `64232a5` auto-deployed FE (2m05s) + BE (4m08s); branded URLs → 200.

---

## Phase 4 — Cost monitoring

- Cloud Run free tier (per billing account, all regions): 180,000 vCPU-seconds,
  360,000 GiB-seconds, and 2M requests per month — both services fit comfortably inside it.
- OpenRouter: the only variable cost (cents; DeepSeek V4 Flash ≈ $0.03/$0.14 per 1M tokens).
- Quick check: `gcloud run services describe appforge-api --region asia-south1` and the
  Billing page (https://console.cloud.google.com/billing). Expect $0 through the trial.

---

## Phase 5 — Teardown (when the deployment is no longer needed)

```bash
gcloud run services delete appforge-api --region asia-south1
gcloud run services delete appforge-fe  --region asia-south1
gcloud artifacts repositories delete --location=asia-south1 <repo if created> --async
```
Or delete the whole project from the Console (one click, removes everything). An empty
project costs nothing, but stale container images linger, so clean them if you care.

---

## Gotchas hit during prep (why the code is shaped this way)

- Cloud Run injects `PORT` and probes the container on it; the API previously hardcoded
  port 3000 → now `app.listen(Number(process.env.PORT) || 3000)`. See `apps/api/index.ts:129`.
- WebContainer requires cross-origin isolation; dev-server headers are replicated in prod
  via `apps/fe/serve.ts` — do not deploy the frontend without them.
- SPA routing needs every unknown path to return `index.html` — handled in `serve.ts`.
- Secrets never belong in builds: `OPENROUTER_API_KEY` is passed via `--set-env-vars`, not
  baked into images or `.env` files in the container context (`.dockerignore` excludes `.env`).
- A Cloud Build **2nd-gen trigger will not create** if you omit `--service-account` — you get the
  opaque error `INVALID_ARGUMENT: Request contains an invalid argument.` even though the payload
  looks valid. The default project Cloud Build SA is disabled; always pass
  `--service-account="projects/<PROJECT>/serviceAccounts/<SA_EMAIL>"`.
- Use a **user-managed** service account (e.g. the Compute default SA). The system SA
  `[NUM]@cloudbuild.gserviceaccount.com` is accepted at creation but fails at `triggers run`
  ("provide a user-managed service account or leave unset").
- Running a trigger with a user SA requires the build to not use the default logs bucket: set
  `options.logging: CLOUD_LOGGING_ONLY` in `cloudbuild/*.yaml` (see the committed configs), or a
  regional user-owned bucket. Otherwise `triggers run` fails with INVALID_ARGUMENT.
- Cloud Run domain mappings are **unavailable in asia-south1** (only asia-east1, asia-northeast1,
  asia-southeast1, europe-north1, europe-west1, europe-west4, us-central1, us-east1, us-east4,
  us-west1). → use the Cloudflare Worker proxy (Phase 3.6) and keep the region.
- Cloudflare (free plan) cannot rewrite the `Host` header to the run.app origin (Origin Rules
  host-header override is **Enterprise-only**), so a Worker must re-set `Host` before the
  `fetch()`. Losing the original Host breaks Cloud Run routing (404 on known paths, TLS risk).
- Cloudflare free Universal SSL only covers the apex + **one-level** wildcard
  (`*.byaniket.site`). Two-level subdomains (`api.appforge.byaniket.site`) fail TLS at the edge.
  Name app services one-label deep (`appforge-api` not `api.appforge`).
- A domain backing a `run.app` mapping must be verified to the owning Google account — verify in
  Search Console with the TXT record and keep the record in DNS.
- The GCP project was **suspended once mid-flight** (CONSUMER_SUSPENDED, billing/trial level).
  Recovery = user appeal; gcloud surfaced it on the first `run domain-mappings` call. Re-verify
  services after any suspension lift.
- The account-scoped Cloudflare token from "Edit Cloudflare Workers" can manage the worker +
  routes but **cannot create DNS records** (auth error 10000). Do DNS edits in the dashboard.
- **Trigger creation via CLI/API can fail with an opaque `INVALID_ARGUMENT` even for a bare
  `{"name":"x"}` body** while the Cloud Console succeeds. This bit Brainlinks hard — gcloud and the
  REST API rejected *every* trigger shape (2nd-gen GitHub, webhook, name-only, multiple regions)
  with no detail, for weeks; creating the two triggers in the **Cloud Console UI** worked instantly.
  If the API path misbehaves for a project, skip it and create triggers via the console. Also be sure
  you're on the **right project** in the console — the author once landed `be-deploy` in the
  `statusbus-app-1ek8` project's drop-down by mistake (a connection can be wired into multiple projects).
- **With repo-trigger builds the checkout is the repo ROOT.** If a service's `cloudbuild.yaml` lives
  in a subdir and just does `docker build -t ... .`, the build dies with
  `unable to evaluate symlinks in Dockerfile path: lstat /workspace/Dockerfile: no such file`
  (the `*.run.app` source for `gcloud builds submit <subdir>` hides this by making the subdir the
  source root). Add `dir: <service-subdir>` to each docker step so the context resolves the Dockerfile
  from a full-repo checkout: `dir: brainlinks-fe` / `dir: brainlinks-be`.
- **A push that touches only docs/root files triggers neither service** (`included-files` filters
  `brainlinks-fe/**` and `brainlinks-be/**`); only changes under those paths fire builds.