# Archived code (transaction-model upgrade, 2026-11-07)

Kept for reference only; not part of the build.

- `server/` — Express + MongoDB backend. The PWA never called it (all data is in Firestore).
- `client-src/api.ts` — axios client for that server (unused).
- `client-src/pages.ts` — duplicate of the lazy imports in `App.tsx` (unused).
- `client-src/dashboardStore.ts` — old lifetime-total dashboard store, replaced by `hooks/useFinance.ts`.

Safe to delete once you no longer need them.
