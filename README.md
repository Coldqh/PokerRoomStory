# Poker Room Story v0.3.0

Static mobile-first poker room career prototype.

## Patch v0.3.0

NPC Poker Brain patch.

### Added

- more realistic NPC decisions by archetype;
- preflop behavior now uses hand strength, position, VPIP/PFR and pressure;
- postflop behavior now reacts to made hand strength, pot pressure, simple draws and board danger;
- safer restored active hands: NPC seats are hydrated with archetype stats after page reload;
- no new giant systems, no fantasy archetypes, no heavy content expansion.

### Current direction

Clean premium poker-room UI, compact text, real hand flow, realistic low-limit NPC behavior.

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

Put these files in the repository root:

```text
index.html
manifest.webmanifest
sw.js
assets/
src/
README.md
.nojekyll
```

Then enable:

```text
Settings → Pages → Deploy from branch → main → /root
```

## Update notes

After pushing a new version, open the game and use:

```text
Система → Принудительно обновить
```

If the browser has an installed PWA, close and reopen it after update.
