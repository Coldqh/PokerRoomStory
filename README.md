# Poker Room Story

Static web MVP for a poker-room career game.

## v0.6.1 — Country Name Pools

- Removed nickname-style NPC names from River Room.
- Added a country-based name pool architecture.
- Russia now has 10 first names and 10 last names.
- NPCs are generated from deterministic first-name / last-name rosters.
- Future countries can get their own name pools without touching poker logic.
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
