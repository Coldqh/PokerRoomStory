# Poker Room Story v0.3.1

Static mobile-first web prototype for GitHub Pages.

## Patch v0.3.1 — UI Polish / Cards

Small safe interface patch after v0.3:

- fixed topbar layout where the Poker Room Story title could overlap bankroll stats;
- constrained the action progress strip inside the central action toast;
- replaced hidden-card question marks with an original PNG card-back asset;
- improved front card rendering: corners, center suit, cleaner face, better highlighting;
- added `assets/card-back.png` to the offline cache;
- updated app/service-worker version to `0.3.1`.

No poker logic changes in this patch.
No save schema changes.

## Run locally

```powershell
cd C:\PokerRoomStory
python -m http.server 8080
```

Open:

```text
http://localhost:8080
```

## GitHub Pages

After replacing files:

```powershell
git add .
git commit -m "Patch v0.3.1 UI polish cards"
git push
```

Then in the app press **Принудительно обновить** and reload with **Ctrl + F5**.

## Notes

The game is a static PWA. It uses `localStorage` for save data and a service worker for offline caching after the first load.
