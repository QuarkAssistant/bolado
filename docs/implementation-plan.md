# Bolado v2 (Roguelike) — Implementation Plan

**Spec:** `docs/spec-v2.md` (supersedes the v1 loop)
**Process:** subagent-driven (implementer → review per task), TDD, explicit git paths, deploy-verify per phase. Standalone repo, `src/` entry — v2 replaces v1 screens in place; engine modules keep their tests.
**Ship order:** shared run core → LIBERTADORES mode live → Campanha → daily-run scoring/percentile → bolões/polish.

## Phase A — Run core (mode-agnostic)
- **A1 Run state machine** (`src/run/runState.ts`, TDD): RunState { mode, stage pointer, squad (XI + formation), cards[], coins, score, seed, decisionsLog[] }. Reducer actions: START_RUN, ENTER_SHOP, ROLL_DICE, SIGN_PLAYER, BUY_CARD, SELL_CARD, REROLL, PLAY_MATCH(result), ADVANCE, END_RUN. Every random draw goes through seeded rng streams keyed off (seed, decision index) so the run is REPLAYABLE from seed + decisionsLog (anti-forgery + daily determinism).
- **A2 Card system** (`src/run/cards.ts`, TDD): Card type { id, name, emoji, category, rarity, price, hooks }. Hooks engine: cards register effects at well-defined points (preMatch strength mod, onGoal, onResult, onShopEnter, scoring multipliers). Launch set ~20 per spec §4, each with unit tests proving the hook math.
- **A3 Match adapter**: wrap the existing playDailyMatch/strength logic into `playRunMatch(squad, cards, opponent, context{homeAway, stage}) → result + cardFirings[]` (which card fired when — feeds the broadcast popups). Determinism tests.
- **A4 Economy + scoring** (TDD): coin sources/sinks, run-score accumulation with card multipliers, goleada bonus; "score sheet" data for the UI.

## Phase B — LIBERTADORES mode live
- **B1 Competition definition** (`src/run/libertadores.ts`): stage graph (group H/A ×6 → oitavas→final), strength curve, home/away modifiers, ~25 historic SA opponents (name, strength, era, one-line flavor — content task with verification; famous Brazilian sides reuse existing rosters as draftable).
- **B2 Shop screen** (Mercado): dice roll animation → club card → player list → sign/replace flow; card offers row; coins; reroll. Reuses Lista idioms.
- **B3 Run HUD + match flow**: persistent header (stage tracker, força vs next opponent, coins, score, active cards); broadcast reveal integration with card-firing popups; result → coins/score breakdown → next shop. Death/glory screens with diagnosis + BORA DE NOVO.
- **B4 Onboarding** (3 panels, the v1-lesson legibility pass baked in) + score-sheet overlay.
- **B5 qa:daily rewrite** for the run flow; deploy to bolado.pages.dev; analytics events (run_start, shop, match, death, victory, share).

## Phase C — CAMPANHA mode
- **C1 Competition definition**: 38-round schedule vs existing club content, block simulation (3-4 rounds per block, key matches in broadcast), standings via existing engine, Z4 sack-checkpoints, objectives ladder.
- **C2 Mode select home** + per-mode daily/free distinction.

## Phase D — Stakes + social (re-targeted v1 Phases 2-3)
- **D1 Daily Run service**: worker `POST /daily/run-score` (seed + decisionsLog + claimed score → server replays deterministically → accept/reject), percentile, daily lock per mode; cold-start bot field.
- **D2 Streaks** (daily-run cadence), **D3 emoji share v2** (build flex format), **D4 bolões** (unchanged design).

## Phase E — Polish: image card, en/es, balance bot harness (thousands of bot runs per tuning change), Campanha depth, domain swap.

**Estimate:** Phase A+B ≈ 10-12 tasks ≈ 2-3 days at current pace; C +1-2 days; D as v1-planned.
