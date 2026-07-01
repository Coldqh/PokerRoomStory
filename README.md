# Poker Room Story v1.0.1

Static web stable demo.

## v1.0.1 — App Controller Split

This version locks the first playable demo before expanding content.

### Included

- River Room starter poker room.
- 5 local cash tables.
- Texas Hold’em hand flow.
- Fold / check / call / custom raise modal.
- Result modal with hand clarity.
- Career, tasks, glossary, collections, settings.
- Offline PWA cache.
- Automated smoke test harness.

### New test harness

Run from the project root:

```powershell
npm test
```

The smoke test checks:

- content registry build;
- content validation;
- default start location;
- UI route visibility before/after seating;
- empty table action dock;
- start hand timeline;
- fold invariant;
- custom raise action;
- 100 completed poker hands.

### Stable demo checklist

See:

```text
docs/STABLE_DEMO_CHECKLIST.md
```

### Not included yet

- blackjack;
- multiple countries;
- true buy-in cashout economy;
- side pots;
- tournaments;
- advanced NPC reads.
