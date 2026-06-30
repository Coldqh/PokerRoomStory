# Poker Room Story v0.7.0

Patch: Better Table Experience.

## Changes

- Added separate post-hand result window.
- Result window shows winner, pot, player delta, board, transcript and short review.
- Moved detailed hand summary/transcript out of the side panel.
- Added safe close action for the result window.
- New hand closes the result window automatically.
- Fixed animation speed runtime lookup.
- No table status system added.
- Save schema unchanged.

## Run

```powershell
cd C:\PokerRoomStory
python -m http.server 8080
```

Open `http://localhost:8080`.
