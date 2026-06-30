# Poker Room Story v0.8.1

Patch: Real Table Entry / Buy-in / Balance.

## Changes

- Added buy-in modal before taking a seat.
- Added table session stack: table hands now use the chosen stack.
- Added leave-table action from the table info panel.
- Balanced table buy-ins and bankroll requirements:
  - Table 1: $1/$2, buy-in $100–300.
  - Table 2: $2/$5, buy-in $300–800.
  - Table 3: $5/$10, buy-in $800–2000.
- Start hand now opens buy-in if the player is not seated.
- Club lobby buttons now distinguish Buy-in / Play.
- Hidden the bright desktop scrollbar in the club journal.
- Save schema unchanged.

## Run

```powershell
cd C:\PokerRoomStory
python -m http.server 8080
```

Open `http://localhost:8080`.
