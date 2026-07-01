# Poker Room Story v0.9.5

Static web MVP.

## v0.9.5 — UI File Split

- Split monolithic `src/ui/screens.js` into focused screen modules under `src/ui/screens/`.
- Split monolithic `src/styles.css` into ordered CSS chunks under `src/styles/`.
- Kept compatibility entrypoints: `src/ui/screens.js` and `src/styles.css`.
- Updated service-worker app shell for the new JS/CSS files.
- No poker-flow, save-schema, UI-behavior or balance changes.

