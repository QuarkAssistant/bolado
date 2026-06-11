# Bolado v2 — Football Roguelike (Design Spec)

**Date:** 2026-06-11/12
**Status:** APPROVED direction — Thiago's feedback on v1 ("doesn't make sense, no emotion, can't play again") + his explicit design brief: *"a mix of 7a0, our own Brasileirão Draft and Balatro"*, with **two modes: Campanha (Brasileirão 38 rounds, home/away) and Libertadores (group stage → final vs historic South American clubs)**.
**Supersedes:** the v1 daily-puzzle loop in `spec-v1-research.md` (v1's research, share/percentile/bolão/legal sections still apply; v1's "complete the XI" core loop is retired).

---

## 1. What v1 got wrong (the lesson)

v1 shipped a one-shot daily puzzle: pick 5 under budget → one instant sim → number. Verdicts from real play (Thiago): scoring opaque, results felt arbitrary, no stakes, **and when it ended there was nothing else to do**. One-per-day scarcity only works when the single play is deep (Wordle's 6 guesses ARE the game); ours was shallow. The fix is not presentation — it's a loop with **agency, escalation, and instant replay**.

## 2. The three parents

| Parent | What we take | Evidence |
|---|---|---|
| **7a0 (Sete a Zero)** — viral browser game of this World Cup, ~10M visits in week 1 | The dice-draft dopamine: roll → random club+era → pick one player. Wildcards/rerolls. Memory-flex (hidden ratings) as an option. Share code culture. | gkpb.com.br/192295, seteazero.wiki, exame.com |
| **Brasileirão Draft (ours)** | Simulation quality + broadcast reveal (built, tested), curated historical rosters, standings engine, determinism/share/analytics/deploy infra | 60% full-season completion in production |
| **Balatro** | Run structure with escalating targets; passive modifier cards that combo into engines; shop between rounds; economy; instant-restart; daily seeded run | The genre-defining "one more run" loop |

## 3. The core: a RUN

A run = take a squad through a competition. Lose → run over → score posted → **"BORA DE NOVO"** restarts instantly. Win it all → glory screen + score. Runs are replayable without limit; the **Daily Run** (one per mode per day) is seeded — same dice, same card offers for everyone — and feeds percentile + emoji share + (later) bolões.

### 3.1 Run anatomy (shared by both modes)
1. **Start**: pick a formation + receive a starter XI of journeymen (low-rated baseline squad) + 3 starting coins ("cruzeiros"? — currency name TBD, pt-flavored).
2. **Before each match block — O MERCADO (the shop)**:
   - **Dice draft (7a0 DNA)**: roll → a random historic club+season appears (our curated rosters) → sign ONE player from it to replace a starter (position rules apply). Rerolls cost coins.
   - **Cartas de Boleiro (Balatro DNA)**: 2-3 cards offered, buy with coins, max 5 active. Passive modifiers that combo (see §4).
   - Coins earned per win/goal/style; spent on signings, cards, rerolls.
3. **The match**: our broadcast reveal (already built — goal beats, drama, skip/accelerate) with the run's stakes on screen: opponent name + strength vs yours, what a win pays, what a loss means. Card effects fire VISIBLY during the match ("😤 Catimba ativou!").
4. **Escalation**: opponent strength rises every stage; the squad + card engine must grow faster than the curve.
5. **Score**: points per match = goals, wins, multipliers from cards; goleada bonus (×2 for 4+ goal margins — the 7×0 fantasy). Run score = cumulative. Death shows: score, best build, "o que faltou" (one-line diagnosis), restart button.

### 3.2 Mode 1 — LIBERTADORES (ship first)
- Structure: **Group stage** (3 opponents, home/away = 6 matches with shop stops between) → **Oitavas → Quartas → Semi → FINAL** (single matches, steep strength curve; optional two-leg final later).
- Opponents: **historic South American Libertadores sides** (name + strength + era flavor at launch; full draftable rosters for the famous ones as content deepens): Independiente 1972-75, Estudiantes 1968-70, Peñarol 1960s, Nacional 1971/80/88, River 1986/96, Boca 1977/2000-03, Olimpia 1979/90, Colo-Colo 1991, São Paulo 1992-93, Santos 1962-63, Flamengo 1981, Grêmio 1983/95, Cruzeiro 1976/97, Inter 2006/10, LDU 2008, Once Caldas 2004…
- Home/away in groups: away matches debuff (altitude days! "La Paz: -2 força"), home matches enable crowd cards.
- Run length target: **8-12 matches, 8-15 minutes**.
- Why first: it IS the escalating-gauntlet design (groups = early antes, mata-mata = boss fights); shorter runs prove the roguelike core fastest; opponent-only content is cheap to author.

### 3.3 Mode 2 — CAMPANHA (Brasileirão, right behind)
- Structure: 38 rounds vs the 19 other clubs, home/away (turno/returno), REAL standings table (our engine) — but interactive-paced: matches simulate in **blocks of 3-4 rounds** between shop stops (~10 stops/run), with **key matches** (clássicos, direct rivals, deciders) played in full broadcast and the rest as quick results.
- Survival pressure: relegation zone = run death mid-season is possible (board sacks you if you're in the Z4 at certain checkpoints — visible threat); objectives ladder (escape Z4 → top half → G4 → title) pays escalating coins.
- Opponents: the existing Brasileirão historic club content.
- Run length target: **20-30 minutes** (the "deep run" for invested players).

## 4. Cartas de Boleiro (launch set ~20)

Brazilian football culture as game pieces. Categories: **Tática** (match modifiers), **Vestiário** (squad synergies), **Várzea** (economy/luck), **Lendária** (rare build-definers). Examples for launch:

| Carta | Effect | Build it enables |
|---|---|---|
| 🎩 Maestro | Camisa 10 +2 per same-era teammate | era-stacking |
| 😤 Catimba | Draws become wins on penalties | defense/park-the-bus |
| 📣 Caldeirão | +3 força in home matches | home-fortress (Campanha) |
| ✈️ Doutor Altitude | No away debuff | road-warrior (Libertadores) |
| 🎯 Artilheiro Nato | Striker goals score double points | goleada chasing |
| 🧱 Muralha | Clean sheet → +5 coins | economy/defense |
| 🔭 Olheiro | First dice reroll each shop is free | draft control |
| 🍀 Bicho Pago | Win bonus +2 coins | tempo/economy |
| 🧙 Mago da Várzea | Tier-1 players (cheap signings) get +3 | budget build |
| 👟 Joga Bonito | Every goal after the 2nd in a match: +1 multiplier | attack snowball |
| 🛡️ Zagueiro Artilheiro | Defenders can score (set pieces) and pay double | meme build, real in Brazil |
| ⏱️ Lei do Ex | Signed players score +1 vs their historic club | narrative + Libertadores flavor |
| 🧤 Paredão | GK defense counts toward midfield too | spine build |
| 🎲 Maluquice | Rolls show 2 clubs, pick either | draft control (rare) |
| 🏆 Mística da Taça | Knockout matches: +2 força | Libertadores boss-killer |
| …plus ~5 more tuned in playtesting | | |

Rules: max 5 active, sell-back at half price, card synergy is THE skill expression; every card effect that fires shows an on-screen popup during the match (legibility = the v1 lesson).

## 5. Scoring, daily run, social (carried from v1 spec, re-targeted)

- Run score = Σ match points (goals ×, win bonuses, card multipliers, goleada ×2) + survival depth. Always-visible "o que vale pontos" sheet one tap away.
- **Daily Run** per mode: seeded dice/card sequence, one scored attempt per day (practice runs unlimited, marked unscored), world percentile via the Phase-2 worker service (unchanged design: server-side recompute anti-forgery — the run is deterministic given the seed + player decisions log, which the client submits compactly).
- Emoji share v2: `⚽ Bolado #3 · LIBERTADORES / 🏆 Campeão! · 847 pts · Top 4% / 🃏 Maestro+Catimba+Caldeirão / bolado.pages.dev` — the card build IS the spoiler-free flex (like Balatro screenshots).
- Bolões (Phase 3 unchanged): leagues rank daily-run scores.

## 6. Content plan
- Draft pool: the existing 229 national-legend players + the existing Brasileirão club rosters (already in repo) power the dice from day one; Libertadores opponents launch as name+strength+flavor (~25 sides), famous ones get draftable rosters incrementally.
- v1's authored daily challenges (#1-#8) retire; the daily-run seed replaces hand-authoring (cards/dice make days different by construction — kills the content treadmill!). Weekly content ritual becomes: add cards, add rosters, tune curve.

## 7. What we keep from the live v1 build (reuse map)
KEEP: nation pools, match engine + broadcast reveal + verdict scaffolding, share/clipboard plumbing, day-lock pattern (becomes daily-run lock), analytics events, qa harness pattern, deploy pipeline, brand module. RETIRE: CompleteXiScreen budget puzzle, challenges.ts authored calendar, solver (repurposable for balance tooling). The deterministic-seed discipline carries everywhere.

## 8. Risks
- **Scope**: two modes × cards × economy ≫ v1. Mitigation: shared run engine, Libertadores first, Campanha = config + content on the same engine; ship the roguelike core in days, tune forever.
- **Balance**: card combos exploding. Mitigation: the balance harness pattern (simulate thousands of bot runs per curve change); Balatro proves "slightly broken" is a feature.
- **Legibility** (v1's sin): every number on screen, every card effect popped when it fires, death screen explains why.

## 9. Visual identity mandate (Thiago, 2026-06-12: "improve the visuals as well!!!")

v2 ships with a designed identity, not default-dark-theme CSS. Direction to be locked before Phase B UI work via a dedicated design pass (frontend-design discipline): a distinctive Brazilian-football-night aesthetic — stadium floodlight contrast, botequim-poster typography energy (Kanit/Barlow are licensed and stay), card faces designed like collectible figurinhas (the álbum-de-figurinhas cultural hook), dice/shop moments with tactile weight, match broadcast framed like 90s TV grafismo. Every screen must pass the "would someone screenshot this unprompted?" bar — the share image IS marketing. No generic component-library look; no stock gradients; motion with personality (≤200ms, reduced-motion variants mandatory).
