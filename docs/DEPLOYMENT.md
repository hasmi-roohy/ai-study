# Deployment Guide

This app has no persistent background process when deployed to a serverless host like
Vercel — there's no equivalent of `npm run worker` staying alive 24/7. Instead,
`/api/cron/process-jobs` does the same job when hit by an external scheduler every
1-2 minutes. Everything else deploys to Vercel as-is.

## Required services

1. **PostgreSQL** — [Neon](https://neon.tech) (free, recommended below) or Supabase/Railway.
2. **Groq API key** — [console.groq.com/keys](https://console.groq.com/keys) (free).
3. **Gemini API key** — [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (free, powers embeddings/retrieval).
4. **Object storage for uploaded PDFs** — required for any real deployment. Local disk
   does not survive a redeploy and will not work at all on Vercel (serverless functions
   don't share a filesystem across invocations — a file saved during upload is gone by
   the time the cron job tries to read it).
5. **A free external cron service** — [cron-job.org](https://cron-job.org), to replace the worker.

## 1. Database — Neon

1. Create a free account at [neon.tech](https://neon.tech) → New Project.
2. Pick a region close to where you'll deploy (e.g. same region as your Vercel deployment, though this only affects latency, not correctness).
3. Once created, copy the connection string shown (starts with `postgresql://...`, includes `?sslmode=require`). This is your `DATABASE_URL`.
4. Neon databases auto-suspend after a period of inactivity but wake up automatically on the next query — no action needed, just expect the first request after idle time to be a bit slower.

## 2. Storage — Backblaze B2 (already wired up, no code changes needed)

`src/lib/storage/materials.ts` automatically uses Backblaze (or any S3-compatible
provider) once these four env vars are set; it falls back to local disk if they're unset.

1. Create a free account at [backblaze.com/b2](https://www.backblaze.com/cloud-storage) (no card required for the free 10GB tier).
2. Create a bucket (any name, e.g. `ai-study-companion-materials`). Private is fine — the app reads files through the API, not public URLs.
3. Go to **App Keys** → **Add a New Application Key**. Scope it to the bucket you just created, with read+write access.
4. Note the **Application Key ID**, the **Application Key** (shown once — copy it immediately), and the **endpoint** shown on your bucket's details page (looks like `s3.us-west-004.backblazeb2.com`).
5. Set these in your environment:
   ```
   S3_ENDPOINT="https://s3.us-west-004.backblazeb2.com"   # your actual region
   S3_REGION="us-west-004"                                 # same region code
   S3_ACCESS_KEY_ID="<application key ID>"
   S3_SECRET_ACCESS_KEY="<application key>"
   S3_BUCKET_NAME="<your bucket name>"
   ```

## 3. Generate secrets

Run this twice — once for `NEXTAUTH_SECRET`, once for `CRON_SECRET`:
```bash
openssl rand -base64 32
```

## 4. Deploy to Vercel

1. Push your code to GitHub (already done).
2. [vercel.com](https://vercel.com) → Add New Project → import your GitHub repo.
3. Before the first deploy, add these under Project Settings → Environment Variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | your Neon connection string |
| `NEXTAUTH_SECRET` | generated value |
| `NEXTAUTH_URL` | `https://your-project-name.vercel.app` (update if your actual domain differs) |
| `GROQ_API_KEY` | your Groq key |
| `GEMINI_API_KEY` | your Gemini key |
| `S3_ENDPOINT` | from Backblaze |
| `S3_REGION` | from Backblaze |
| `S3_ACCESS_KEY_ID` | from Backblaze |
| `S3_SECRET_ACCESS_KEY` | from Backblaze |
| `S3_BUCKET_NAME` | from Backblaze |
| `CRON_SECRET` | generated value |
| `DAILY_AI_SPEND_CAP_USD` | `10` (or your preference; `0` disables the cap) |

   Do **not** set `MATERIAL_STORAGE_DIR` or leave the `S3_*` vars unset on Vercel — without them the app silently falls back to local disk, which will break uploads in production (files vanish between the upload request and the cron job that processes them).

4. Deploy. Vercel runs `npm run build` automatically.
5. After the first successful deploy, run the schema push and (optionally) seed once from your local machine, pointed at the *Neon* database:
   ```bash
   DATABASE_URL="<your neon connection string>" npx prisma db push
   DATABASE_URL="<your neon connection string>" npm run db:seed   # optional demo accounts
   ```

## 5. Set up the free external cron

Vercel's own free Cron Jobs are capped at once per day — too infrequent here. Use a free external scheduler instead:

1. Create a free account at [cron-job.org](https://cron-job.org).
2. Create a new cron job:
   - **URL**: `https://your-project-name.vercel.app/api/cron/process-jobs?secret=YOUR_CRON_SECRET`
   - **Schedule**: every 1-2 minutes
   - **Method**: GET
3. Save and enable it.

Uploaded materials will now process within 1-2 minutes instead of near-instantly — the real tradeoff of not running a persistent worker.

## 6. Verify

- Visit your Vercel URL, register, create a Space/Project, upload a PDF.
- Check `https://your-project-name.vercel.app/api/health` — should return `{"status":"ok"}`.
- Check the cron-job.org dashboard for successful pings returning `{"ok":true,"processedCount":N}`.
- Within a couple minutes, the material should move Queued → Processing → Ready.
- Log in as an admin (`npm run db:seed` creates one) and check `/admin/health` for the fuller internal view.

## Alternative: Render (simpler, not free)

If you'd rather not deal with the cron/serverless setup, Render lets `npm run worker`
run as a genuine persistent Background Worker service (~$7/month) alongside a free Web
Service — closer to "always instant" processing, no external cron needed. The same
`S3_*` env vars apply; just set them on both the web and worker services identically.
The app code supports both deployment styles without any changes.

## Known limitations of this deployment path

- Rate limiting (`src/lib/rateLimit.ts`) and the AI spend cap are in-memory. On Vercel, each serverless invocation can start with fresh memory, so these are best-effort there rather than a hard guarantee — fine for a prototype/demo, worth swapping for Redis/Upstash before real production traffic.
- Material processing latency is bounded by your cron interval (1-2 min), not instant.
- No OCR — scanned/image-only PDFs won't extract text.
