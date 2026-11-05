# Alignment telemetry worker

Receives Composer's opt-out alignment telemetry and stores it in a private R2 bucket. The data is used only to
train future lyric-alignment models and to benchmark how the current ones perform.

Composer collects, for each auto-aligned line, what the aligner gave it, and keeps that in the browser
(IndexedDB). It sends one payload per export (Download TTML or Copy in Export) while "Share alignment data to
help improve auto-align" is checked in the Sync tab's auto-align popover. Unchecking it deletes what the browser
collected and calls `DELETE /v1/telemetry/:installId`.

It is a separate Wrangler project from Composer's static assets (the root `wrangler.jsonc`), on its own account.

## Endpoints

- `POST /v1/telemetry`: one JSON payload (see `src/payload.ts`), at most 1 MiB. Unknown fields anywhere are
  rejected. Stored as `<installId>/<YYYY-MM-DD>/<uuid>.json` with the time it arrived.
- `DELETE /v1/telemetry/:installId`: deletes every object under `<installId>/`.

Both answer only Composer's origins: `https://composer.betterlyrics.org`, `https://*.dev.composer.betterlyrics.org`
and `http://localhost` / `http://127.0.0.1` on any port. POST is rate limited per IP and per install id (20 a
minute), DELETE per IP (5 a minute), with Workers rate limiting bindings. Workers observability is off so request
URLs (which carry install ids) are not kept in logs.

## Deployed

- Worker: `composer-alignment-telemetry` on the "Adalie account" (`f5dbfc5cf299cd799bf49f258675f82b`)
- URL: `https://composer-alignment-telemetry.dacubeking.workers.dev`
- Bucket: `composer-alignment-telemetry` (private, no r2.dev URL), bound as `TELEMETRY`

## Setup and redeploy

From this directory, logged in to that account with `npx wrangler login`:

```bash
npx wrangler r2 bucket create composer-alignment-telemetry   # once
npx wrangler deploy
```

Composer reads the endpoint from `VITE_ALIGNMENT_TELEMETRY_URL` and falls back to the URL above. The handler tests
run with Composer's unit tests (`pnpm test:unit`).
