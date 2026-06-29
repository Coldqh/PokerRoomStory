# Poker Room Story v0.2.1

Static mobile-first poker room career prototype.

## Patch v0.2.1

Stability / save / offline patch.

### Added

- visible app version in the top HUD;
- system panel in the club screen;
- versioned save envelope: schema, app version, content version, timestamps;
- automatic migration from old flat saves;
- backup save before every overwrite;
- save export / import as JSON;
- force update button;
- update notification when a new service worker is ready;
- PWA manifest;
- service worker cache for offline use;
- active hand can survive page reload better because deck and table state are now saved.

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

After pushing a new version, GitHub Pages may keep old cached files for a short time. Use the in-game button:

```text
Система → Принудительно обновить
```

If the browser has an installed PWA, close and reopen it after update.
