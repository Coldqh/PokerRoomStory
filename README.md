# Poker Room Story v0.1.4

Static mobile-first poker career prototype for GitHub Pages.

## Patch v0.1.4 — Poker World Animation UI

- red/black premium poker-club interface;
- table screen rebuilt around the poker table, not admin panels;
- sequential action animation: player action → NPC actions → flop/turn/river → showdown;
- animated action toast for call/check/raise/fold/street reveal;
- winner banner and highlighted winning seat;
- right inspector with best hand, winner, pot and recent action feed;
- old empty hand-log section under the table removed;
- architecture remains data-driven: content packs, NPC tiers, world/club/table entities.

## Run locally

```bash
cd C:\PokerRoomStory
python -m http.server 8080
```

Open:

```text
http://localhost:8080
```

## GitHub Pages

Upload the project root to GitHub. The root must contain:

```text
index.html
src/
README.md
.nojekyll
```

Then enable:

```text
Settings → Pages → Deploy from a branch → main → /root
```
