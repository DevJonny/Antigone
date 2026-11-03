# Antigone

Static Vite + React PWA, hosted on GitHub Pages, that tracks Google Calendar appointments through notes → invoiced → rebooked. Used on iPhone, iPad and a laptop. [DESIGN.md](DESIGN.md) records the product decisions; keep it current when behaviour changes.

## Commands

- `npm test` — Vitest. The script disables Node's built-in Web Storage, which otherwise shadows jsdom's `localStorage`.
- `npm run build` — type-checks with `tsc`, then builds to `dist/`.
- `npm run dev` — serves at http://localhost:5173/Antigone/ (needs `VITE_GOOGLE_CLIENT_ID` in `.env.local`).

Pushing to `main` deploys to production via `.github/workflows/deploy.yml`.

## Layout

- `src/model.ts` — stages, client keys, the offline edit queue. Pure.
- `src/list.ts` — what the list shows: hiding, status filters, grouping by day. Pure.
- `src/rebook.ts` — builds the follow-up event. Pure.
- `src/calendar.ts` — Calendar REST client.
- `src/auth.ts` — OAuth redirect sign-in.
- `src/useApp.ts` — all app state: cache, connection, sync, queue flushing.
- `src/components/` — UI only; no data access.

## Invariants

- **No backend.** All state lives in each event's `extendedProperties.private` (`ag_*` keys, see DESIGN.md); IndexedDB is only a cache and edit queue. Keys must stay ≤44 chars and values ≤1024, or Google silently drops or truncates them.
- **Stages count only in order** (`stageOf`). Rebooked but not invoiced is still orange.
- **Sign-in is a full-page redirect**, not a popup, because popups don't return from iOS Home Screen apps. Tokens last an hour with no refresh; the banner must always show whether the app is connected, offline or signed out.
- **`base: '/Antigone/'`** is part of the OAuth redirect URI registered with Google. Changing it breaks sign-in.
- **SumUp has no payment-link API.** Each client's reusable link is pasted once and carried forward; don't add SumUp API calls without revisiting that.
- Rebooking needs a live connection; every other edit queues offline.

## Conventions

- Pin exact dependency versions, at least two weeks old.
- Wrap every `localStorage`/IndexedDB access in try/catch and fall back gracefully.
- Touch targets are at least 44px; check layouts at phone width.
- Keep logic in the pure modules and test it there; `useApp.test.tsx` covers sync against a fake Calendar API.
