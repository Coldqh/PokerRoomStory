# Poker Room Story

Static web MVP for a poker-room career game.

## v0.6.4 — Drawer Mobile Table Fix

- Replaced the cramped visible navigation with a proper hamburger side drawer.
- Drawer works on desktop and phone.
- Moved animation pace control into the drawer/settings area.
- Removed pace block from the table side info.
- Fixed mobile card sizes.
- Reduced central suit overlap on small cards.
- Made opponent cards visible on phone again.
- Removed table mood text from unlock rows.
- Renamed the ugly `Regulars` table to `Club Cash`.
- Save schema is unchanged.

## Run locally

```powershell
cd C:\PokerRoomStory
python -m http.server 8080
```

Open `http://localhost:8080`.

## GitHub Pages

Push the files to the repository root. If the old version is cached, use:

```text
Проверить → Принудительно обновить → Ctrl + F5
```
