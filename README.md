# Bolado

A Brazilian football roguelike: take a squad through a run — Campanha (Brasileirão, 38 rounds) or Libertadores (group stage to the final vs historic South American clubs) — mixing 7a0's dice-draft dopamine, Brasileirão Draft's simulation quality, and Balatro's run structure with passive modifier cards. Lose and the run is over with your score posted; win it all for the glory screen — and "BORA DE NOVO" restarts instantly. The seeded Daily Run (one per mode per day) gives everyone the same dice and card offers, feeding percentiles and emoji shares.

The current code is the v1 daily puzzle ("complete o time do dia"); the v2 roguelike replaces it in place.

**Live:** https://bolado.pages.dev

## Docs

- [v2 design spec](docs/spec-v2.md) — the roguelike (current direction)
- [v2 implementation plan](docs/implementation-plan.md)
- [v1 spec + research](docs/spec-v1-research.md) — daily puzzle, share/percentile/bolão/legal research

## Development

```sh
npm install
npm run dev        # vite dev server on 127.0.0.1
npm test           # vitest
npm run build      # tsc -b && vite build
npm run qa:daily   # Playwright e2e vs http://127.0.0.1:5180 (or BOLADO_QA_URL)
npm run deploy     # build + wrangler pages deploy (project: bolado)
```
