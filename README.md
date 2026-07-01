# Poker Room Story v0.9.9

Static web MVP.

## v0.9.9 — Poker Engine Safety Split

- Split safe poker-engine helpers into focused modules under `src/engine/poker/`.
- Kept the public engine facade at `src/engine/poker.js`, so existing UI/app imports stay stable.
- Moved phase labels/constants into `poker/constants.js`.
- Moved initial table/animation state and reveal-count helper into `poker/state.js`.
- Moved seat helpers, stack contribution, actor selection, and sync helpers into `poker/seats.js`.
- Moved call/raise legality and custom raise target normalization into `poker/betting.js`.
- Did not change poker behavior, fold logic, winner logic, UI, save schema, or buy-in economy.
