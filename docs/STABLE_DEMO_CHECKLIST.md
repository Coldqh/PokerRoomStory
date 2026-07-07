# Poker Room Story v1.1.0 — Stable Demo Checklist

## Automated smoke test

Run from project root:

```powershell
npm test
```

Expected:

```text
[PRS smoke] ok
poker hands finished: 100/100
```

## Manual checks

1. Open the app through a local server or GitHub Pages.
2. Confirm version shows `v1.1.0` in Settings.
3. Club screen opens before seating.
4. Table screen is hidden before seating.
5. Buy-in from the club opens the table.
6. Empty table shows only `Начать новую раздачу`.
7. Empty table does not show `Fold / Check / Call / Raise`.
8. Start a hand.
9. Fold once and confirm the folded player does not act again.
10. Start another hand and use Raise.
11. Custom raise modal accepts a valid number and rejects invalid sizing through clamp/disabled state.
12. Play until result modal opens.
13. Confirm result modal shows Club XP after a completed hand.
14. Return to Club and confirm River Room level/XP block is visible.
15. Start another hand from result modal.
16. Test desktop width around 1366px.
17. Test mobile width around 390px.
18. Check Settings → Force update.

## Stable demo scope

Included:

- one country;
- one club;
- five cash tables;
- Texas Hold’em flow;
- custom raise amount modal;
- result modal;
- tasks, career, glossary, collections;
- Club XP and River Room mastery rewards;
- offline PWA cache;
- automated smoke test.

Not included:

- multiple countries;
- true buy-in cashout economy;
- side pots;
- tournaments;
- advanced NPC reads.
