# Changes in this pass

The existing codebase (Next.js + Prisma + NextAuth, with a real background job queue,
retrieval, adaptive quiz logic, and a CLI eval harness) was already solid — well beyond
a superficial prototype. This pass focused on the specific gap called out explicitly:
**the Admin Dashboard read as just another tab in the learner app**, using the same
light theme, cards, and typography as everything else.

## What changed

**Admin is now a visually and structurally distinct console**, not a re-skinned page:

- New `src/app/admin/layout.tsx` — a dark (`#0A0D12`) shell with a sidebar nav and a
  monospace type treatment (JetBrains Mono), separate from the learner app's light,
  serif-free/eyebrow-label style. It reuses the same auth (`requireAdmin`) and data —
  only the presentation differs.
- Admin went from a single flat page to **five sections**, each its own route so the
  console reads like an operator tool with real navigation, not a scroll-down dashboard:
  - `/admin` — platform snapshot (unchanged data, new look)
  - `/admin/users` — unchanged data, new look
  - `/admin/activity` — **new**: a filterable, platform-wide activity feed backed by a
    new `GET /api/admin/activity` route (supports `?type=` and pagination via `take`)
  - `/admin/ai` — **new**: surfaces the `EvalRun`/`EvalResult` rows already written by
    `npm run eval` (they existed in the schema and CLI script, but had no UI), via a new
    `GET /api/admin/evals` route. Each suite's latest run is compared to its previous run
    so a regression is visible without re-running anything (PRD §47).
  - `/admin/health` — **new**: a lightweight system-health view (DB reachability, AI
    error rate/latency in the last hour, background job status, recent job failures,
    material-processing backlog) via a new `GET /api/admin/health` route.
- New shared components in `src/components/admin/` (`AdminNav`, `AdminPanel`,
  `AdminStat`, `AdminTable`, `AdminButton`) so the five pages stay consistent without
  duplicating markup.

## What was deliberately left alone

- The learner-facing app (Spaces/Projects/Tutor/Quiz/Growth/Analytics) — already
  functional and consistent; a full re-skin wasn't requested and risked introducing
  regressions in AI-integration code without the ability to run the app end-to-end here.
- Core domain logic (retrieval, adaptive quiz selection, mastery/trend computation,
  grounded-answer prompting) — already well-reasoned; left untouched.
- `node_modules/`, `.next/`, `.env`, and `*.tsbuildinfo` were removed before packaging
  (matches `.gitignore`) since they're build artifacts / local secrets, not source.

## Environment note

This pass was done by reading and editing source files only — there was no way to run
`npm install`, start the dev server, or hit a real Postgres/Groq backend in this
environment, so the new admin pages/routes are reviewed for correctness against the
existing patterns in the codebase (same `withApiHandler`, `requireAdmin`, Prisma model
names) but have not been executed. Run `npm install && npm run dev` (with a configured
`.env`, see `.env.example`) to verify before deploying.

## Learner-app UI redesign (this pass)

Restyled the learner-facing app to match a provided visual design: a persistent dark
sidebar (Home / Spaces / Analytics / Settings, logo, account footer) with a light
content area, replacing the old single-column card layout.

- New `src/components/AppShell.tsx` — shared sidebar shell used by every authenticated
  learner page (mobile gets a condensed top bar with the same nav).
- New `src/components/icons.tsx` — small dependency-free inline SVG icon set.
- `tailwind.config.ts` — `brand` palette moved from violet to blue, plus an `ink` shade
  for the sidebar, to match the new design system.
- `/dashboard` is now a personalized **Home**: a "Continue learning" banner for the most
  recently touched project, a real cross-space "Recent Projects" list, an "Overall
  Progress" summary from `/api/analytics`, and "Areas to Improve" / "Recommended Next
  Step" panels sourced from live concept and recommendation data (no fabricated metrics
  like streaks or study-time hours, since those aren't tracked in the schema).
- New `/spaces` — the Spaces index (moved out of `/dashboard`, which is now Home).
- `/spaces/[spaceId]` — redesigned with a stat row, project cards (with a mastery-derived
  Beginner/Intermediate/Advanced badge), a Recent Activity panel, and a "Requires
  Attention" panel. `GET /api/spaces/[spaceId]/projects` now also returns each project's
  `attentionConcepts` (id/name/masteryPct) so the UI can name the concepts that need
  review instead of just a count.
- `/projects/[projectId]` — added a Spaces / Space / Project breadcrumb (`GET
  /api/projects/[projectId]` now includes the parent `space` via
  `assertProjectOwnership`), restyled tabs, overview, and the Quiz tab (tagged question
  cards, select-then-submit multiple choice, a real progress bar against the fixed
  6-question quiz length).
- New `/settings` — minimal account page (name, email, sign out); referenced by the new
  sidebar nav.
- `/analytics` and the project Growth & Analytics tab got a lightweight stat-card
  restyle for visual consistency; no data changes.
- The Admin console (`/admin/*`) is intentionally left as its own dark operator-console
  design (see above) and wasn't touched by this pass.

## Remote material storage (this pass)

Replaced the local-disk-only material upload path with a swappable storage adapter:

- New `src/lib/storage/materials.ts` — `putMaterial` / `getMaterial`. Uses local disk
  (`MATERIAL_STORAGE_DIR`) by default; automatically switches to any S3-compatible
  provider once `S3_ENDPOINT` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` /
  `S3_BUCKET_NAME` are set. No provider-specific code — works with Backblaze B2
  (recommended: 10GB free, no card required), Cloudflare R2, Wasabi, MinIO, or S3 itself.
- `src/app/api/projects/[projectId]/materials/route.ts` and
  `src/workers/handlers/processMaterial.ts` now go through this adapter instead of
  `fs.readFile`/`fs.writeFile` directly.
- Backward compatible: `Material.storagePath` holds either an absolute local path or a
  remote object key, detected at read time — existing rows don't need a migration.
- Added `@aws-sdk/client-s3` as a dependency (lazily imported, so local-only dev setups
  never need to load it).
- See `docs/DEPLOYMENT.md` for setup steps.

## UI polish + real charts (this pass)

- Spaces index: the small "Open →" text link on each space card is now a proper pill
  button that fills in on hover, instead of a low-contrast text link.
- Project page: tab navigation (Overview / Materials / Tutor / Quiz / Growth &
  Analytics) is now a segmented control with icons and a white "active" pill on a
  light-gray track, replacing the plain underline tabs.
- Materials tab: replaced the raw `<input type="file">` with a proper dropzone-style
  upload button, and restyled the material list to match the rest of the app (status
  pills with icons, consistent card styling).
- Added real chart visualizations (via `recharts`, already a dependency) instead of
  plain numbers/lists:
  - Project **Growth & Analytics** tab: a horizontal bar chart comparing each
    concept's previous vs. current mastery, a donut chart of concept status
    (mastered / in progress / needs attention), and a bar chart of activity by type.
  - Global **Analytics** page: a horizontal bar chart of mastery by project and a
    donut chart of concept trend (improving / stable / needs attention) across every
    Space. `GET /api/analytics` now also returns `performance.byProject` and
    `performance.conceptsStable` to support these.

## Auth pages, error handling, storage error messages (this pass)

- Redesigned `/login` and `/register` to match the rest of the app's design system
  (logo mark, `surface` card, `form-control` inputs, `primary-button`, styled error
  banners) instead of plain unstyled forms.
- Added `src/app/not-found.tsx` and `src/app/error.tsx` so a bad URL or an unhandled
  client error shows a styled in-app page instead of Next.js's raw default.
- Materials tab: upload errors now render as a proper banner (icon + message) instead
  of plain red text.
- Storage adapter (`src/lib/storage/materials.ts`) now trims `S3_*` env vars (a stray
  trailing space/newline from pasting into `.env` is a common cause of providers
  rejecting valid credentials as malformed) and wraps upload/download failures with an
  actionable message — e.g. "Malformed Access Key Id" now also tells you which env vars
  to check and that it's often a value copied from the wrong page (account ID vs.
  Application Key ID). The original provider error is preserved in server logs.
