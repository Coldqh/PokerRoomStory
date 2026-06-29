# Poker Room Story v0.2

Static mobile-first poker room prototype.

## Patch v0.2 — Real Hand Flow

- real betting streets: preflop, flop, turn, river, showdown;
- dealer/button, small blind, big blind and table positions;
- current actor, to-call amount, current bet and player stack;
- sequential NPC actions with animation feed;
- dynamic action buttons: check, call, bet/raise, fold;
- winner highlight and compact result panel;
- split-pot safety for tied hands;
- cleaner hand state model for future blackjack/career patches.

## Run locally

```bash
python -m http.server 8080
```

Open:

```text
http://localhost:8080
```

## GitHub Pages

Put `index.html`, `src/`, `.nojekyll` and this README in the repo root.
