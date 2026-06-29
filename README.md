# Poker Room Story v0.1.3

Static mobile-first web prototype for GitHub Pages.

## Patch v0.1.3 — Poker World UI

- Rebuilt table screen into a real poker-room layout.
- Added central felt table, seat ring, board zone, hero pocket, pot stack.
- Added right-side hand inspector for desktop.
- Added sticky decision dock for mobile.
- Reworked lobby into a premium poker dashboard.
- Kept the data-driven architecture from v0.1.

## Run locally

```bash
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
src/
README.md
.nojekyll
```

Then enable:

```text
Settings -> Pages -> Deploy from a branch -> main -> /root
```
