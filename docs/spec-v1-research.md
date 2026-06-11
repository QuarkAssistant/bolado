# Bolado — Product Specification

**Date:** 2026-06-11 (tournament opening day)
**Status:** APPROVED — Thiago chose the brand name **Bolado** on 2026-06-11 ("call it: Bolado. build it")
**Brand:** **Bolado** (all languages — one word, Brazilian slang, echoes "bolão"). The in-game verb phrase stays *"completa o time"* (pt) / *"complete the XI"* (en) / *"completa el once"* (es) as the daily call-to-action. Spec text below predates the naming decision; read "Completa o Time" as the CTA, "Bolado" as the product.

---

## 1. Executive summary

A free, mobile-first, 3-minute **daily puzzle game**: every day, the whole world gets the **same partially-built historical XI** themed to that day's real tournament fixtures, and must **complete it with 5 picks under a budget**. The finished XI immediately plays a **simulated match** (our proven engine) against the day's benchmark side. The result — score, star rating, and **world percentile** — is shareable as a spoiler-free emoji card, feeds a **streak calendar**, and accumulates into **private friend leagues ("bolões")** across the 39 days of the tournament.

One sentence: **Wordle's cadence and share loop + Immaculate Grid's sports-nerd flex + Brazil's bolão culture + the simulation engine we already proved people love.**

---

## 2. Why this game — the evidence chain

Every design decision below traces to a verified data point. Sources: our production analytics (D1, 30-day window), live X API engagement sampling (June 11), and a 28-source adversarially-verified research pass.

### 2.1 What our own data proves (Brasileirão Draft, 30d: 907 visitors, 686 game starts)

| Evidence | Number | Design consequence |
|---|---|---|
| Post-draft completion is extraordinary | 94% → 71% → 98% → 90% per funnel stage; **60% of all starts finish a full 38-round season** | The **simulate-and-watch payoff is the core asset**. Keep it. |
| The 11-pick draft is the biggest leak | draft_started → draft_completed = **71%** (worst stage) | Cut decisions from 11 to **5**. Pre-fill the rest. |
| Zero retention | One X post → 682 visits June 8 → 132 by June 10 → ~5 June 11 | The game must have a **tomorrow**: daily scarcity + streaks + a tournament-long meta-game. |
| Sharing doesn't fire without comparability | **2** tagged share visits / 409 finished seasons | Same-puzzle-for-everyone + percentile = something to compare. Share must carry a **score**, not a screenshot of a solo run. |
| Daily mode is ignored when optional | 83 daily vs 603 free starts | Daily is not a mode. **Daily is the game.** |
| Audience | BR 599 + US 270; mobile 507 vs desktop 398; top referrer t.co | pt-BR-first, mobile-first, X-first distribution. |

### 2.2 What live X data shows (sampled June 11, opening day)

- **Bolão/palpite content is the active PT wave**: top palpite posts pulled 5,300–15,300 impressions in 7 days; "deixa seu palpite 👇" engagement formats dominate. → A **friends-league ("bolão") layer is mandatory** for the Brazilian audience; quote-tweetable daily prompts are the reach channel.
- **Emoji-grid shares are a retention ritual, not a reach engine**: 50/50 recent Immaculate Grid shares carry the grid, but median 15 impressions. → The grid share **badges identity and feeds streak culture**; reach comes from the daily theme being debate-worthy.
- **Football grid-trivia clones have cooled on X** (near-zero recent posts for Futbol Grid/Missing 11 etc.). → Do **not** build another guess-the-player trivia clone.

### 2.3 What verified research established (high-confidence claims only)

1. **The format scales**: Immaculate Grid went 0 → 100k+ daily plays in ~10 weeks on a once-daily puzzle, and the inflection was **one viral tweet**, not gradual growth. (Sports Reference acquisition post; Wikipedia/FOS corroboration.)
2. **The share mechanic is the most-copied virality device in daily games**: spoiler-free emoji rows + a `Name #N score` header that works as a public scoreboard. It was a *community* invention Wordle adopted — so we should instrument how early players share and adapt. (Wardle's tweet, verified timestamp.)
3. **The niche is open**: Superbru (~2.78M registered), Kicktipp (free leagues ≤300), and FIFA's official Fantasy all occupy heavyweight per-match prediction / season-fantasy. **None offers a lightweight daily puzzle with an emoji share.** (Live fetches June 10–11.)
4. **Retention math favors streaks-with-forgiveness**: Duolingo's published numbers — 7-day streak → 3.6× course completion, streak-freeze slack → +0.38% DAU, milestone animations → +1.7% D7. (First-party A/B numbers; treat as directional.)
5. **Tournament facts**: opens June 11 (Mexico × South Africa, Azteca), 12 groups (A–L) of 4, top two + 8 best thirds → new Round of 32. Multiple matches/day in groups; exact daily cadence to re-verify when authoring the content calendar (the 104-match/schedule claim failed source verification).
6. **Legal lines are asymmetric**: player **names + stats are usable unlicensed** in the US (C.B.C. v. MLB Advanced Media, 8th Cir. 2007 — a First Amendment *defense*, strongest in the US; Brazil/EU regimes differ). FIFA marks — **including the words "World Cup"** — are aggressively enforced even against free products framed as ambush marketing. **No FIFA marks, no crests, no kit designs, no player photos.**

---

## 3. The core loop (one day, ~3 minutes)

### Step 1 — The day's challenge (10 seconds to understand)
Player opens the site. One screen:

> **#1 · 11 de junho**
> Dia de **México 🇲🇽 × África do Sul 🇿🇦**
> *O time do dia já tem 6 craques. Complete com 5.*

A pitch shows a partially-built historical XI — **6 players pre-placed by the daily theme** (e.g., the spine of México's 1986 golden generation), with **5 empty slots** (e.g., GK, two MID, two ATT — varies daily).

### Step 2 — Complete the XI (the puzzle, ~90 seconds)
- A **Lista** (our proven mobile UI pattern) of **15 candidate players** for the 5 open slots — drawn from the themed pools (the day's nations + a sprinkle of "global greats" wildcards).
- Each candidate shows: name, position(s), era, 2–3 visible attributes, and a **cost** (1–5 ⭐).
- **Budget: 12 ⭐ for 5 picks** (tuned so you can afford ~one superstar + role players, never five galácticos). The budget is the puzzle: every pick is a trade-off.
- **Chemistry hooks** make it skill, not shopping: same-era links with the pre-placed six, position fit, and the **daily condition** (revealed up front, e.g., "hoje o gramado favorece o jogo aéreo" — aerial-strong picks get a boost). Reading the pre-placed six + the condition is the skill expression.
- Picks lock with a satisfying tactile flow (one tap to place, one to confirm — reuse V3 interaction patterns).

### Step 3 — The match (the payoff, ~45 seconds)
The completed XI plays **one simulated match** against the day's benchmark opponent ("Seleção do Mundo" — a fixed XI everyone faces). Compressed version of our engine's reveal: kickoff → goal events with scorer names and minutes → final whistle. Deterministic: **same picks + same day = same result, for everyone** (cheat-resistant, replay-consistent, and our engine already does deterministic seeding).

### Step 4 — The verdict (the flex)
- **Score** (e.g., 3×1) and **performance points 0–100** (composite of result + goals + chemistry achieved + budget efficiency).
- **World percentile**, computed server-side from all submissions so far today: *"Melhor que 87% do mundo hoje."* (Our existing Worker + D1 stack handles this — see §8.)
- **Stars** (0–5) bucketing the points, for the emoji share.
- The optimal-XI reveal is **withheld until the next day** (spoiler protection + a reason to come back: "ontem, o time perfeito era…").

### Step 5 — Share / streak / league (the loop)
- One-tap share: spoiler-free text first (the emoji card — §6), image card second.
- Streak calendar fills in; milestone celebrations at 3/7/14/39 days.
- Tournament-long **bolão**: cumulative points rank you against friends (§7).

### Why this loop wins
- **Instant resolution.** Superbru/Kicktipp players wait hours for real matches to settle; we resolve in 45 seconds, playable at any hour — including the long gaps between real kickoffs when fans are bored and on their phones.
- **Debate-ready by design.** "They pre-placed Hugo Sánchez but I couldn't afford Chicharito" is exactly the argument football X/Reddit has for fun. Every daily theme is a quote-tweet prompt.
- **It's a puzzle, not trivia.** No "you either know it or you don't" wall (the trivia-clone graveyard). Casuals can pick famous names; sharks optimize chemistry + budget. Both finish; sharks get higher percentiles.

---

## 4. The meta-game: 39 days of tournament

- **Content calendar = the real tournament calendar.** Group stage: each day's puzzle themes on a marquee real fixture (pools from those nations). Knockouts: winners-themed days. Rest days: special themes ("Dia das Finais Históricas", "Dia dos Camisas 10") — these are our **streak-freeze equivalents**, lighter puzzles that keep the chain alive (research: forgiveness mechanics *increase* DAU).
- **Cumulative season**: every daily score adds to your tournament total (max 39 × 100). The bolão leaderboard ranks tournament totals — one bad day never eliminates you (Superbru's accuracy-points model, validated at 2.78M users).
- **Post-tournament life**: the daily machine keeps running on club-football themes (we own deep Brasileirão content already — the existing game's curated rosters seed it). The tournament is the launch wave, not the product's lifespan.

---

## 5. Content: player pools

- **Format per nation**: ~18–24 hand-curated all-time players (name, positions, era band, 4 attributes, cost tier, 1-line bio hook). Same data shape and curation pipeline as `teamSeasons` (proven: RSSSF-sourced, test-enforced invariants — positions, unique shirts, etc.).
- **Brazil pool is nearly free**: extracted from the existing curated club rosters (Pelé, Zico, Romário, Ronaldo… already rated and tested).
- **Launch tiers**:
  - Tier 1 (deep, launch-blocking): 🇧🇷 🇦🇷 🇲🇽 🇺🇸 + the 4 nations in the first week's marquee fixtures.
  - Tier 2 (by end of week 1): 🇫🇷 🇩🇪 🇮🇹 🇪🇸 🏴 🇵🇹 🇳🇱 🇺🇾 🇨🇴 🇭🇷.
  - Tier 3: remaining group-stage marquee nations as their theme-days approach (daily calendar tells us exactly which pools are needed when — we never need all 48).
- **Wildcard pool**: ~30 global legends usable any day (fills thin-nation days).
- **Legal guardrails baked into the data**: names + factual data only; **no photos, no likeness art, no federation crests, no kit replicas**. Visual identity = our existing abstract shirt-tile system + flag emoji + era styling.

---

## 6. The share system (designed from the verified mechanics)

**Text share (primary — this is the scoreboard):**

```
⚽ Completa o Time #1 🇲🇽×🇿🇦
3×1 · ⭐⭐⭐⭐ · Top 13%
🔥 7 dias seguidos
🟩🟩🟨🟩🟦
completaotime.app
```

- Header = `Name #N` (Wordle's verified scoreboard pattern).
- The 5 squares encode pick quality **without revealing players** (🟩 great value pick, 🟨 fine, 🟥 burned budget, 🟦 the daily-condition bonus hit) — spoiler-free, curiosity-creating ("what was the green pick?").
- Percentile + streak = the flex; flags = the day's theme; naked URL = the door.
- **Share prompt placement**: immediately under the verdict, pre-rendered (our share pipeline already pre-renders blobs), with the text share as the BIG button (text shares paste into WhatsApp groups — where Brazilian bolões live — better than images).

**Image card (secondary)**: the completed XI on the pitch, score, stars, percentile — reusing the existing 4:5 export pipeline with embedded fonts (already built and shipped).

**Instrument and adapt** (research lesson: the best share format was invented by a *player*): log share-format usage from day one; if early players hand-compose something better, adopt it within days.

---

## 7. Social layer: the bolão

- **Create a bolão in two taps**: name it → get a link/code (`completaotime.app/b/FLA1981`). No accounts. Joining = storing the code client-side + registering device-id → league via the Worker.
- **League board**: tournament-total points, today's points, streaks. Capped at 100 members free (Kicktipp validates 300-free; we start tighter for abuse control).
- **Identity without auth**: self-chosen display name + flag, stored per device (privacy posture unchanged: no emails, no PII — consistent with our documented analytics stance).
- **The WhatsApp loop**: bolão link + daily emoji share into the same family/office group = the distribution mechanic Brazilian bolão culture already performs daily (verified by the live palpite wave on X).

---

## 8. Architecture (what we reuse vs build)

**Reused from Brasileirão Draft (~70% of the stack, all battle-tested as of 0.2.18):**

| Asset | Reuse |
|---|---|
| Match simulation engine (`src/game/simulator.ts`) | Compressed single-match mode; deterministic seeding (`hashSeed`/`createRng`, code-point tie-breaks — all the determinism work pays off here) |
| Daily-seed system (America/Sao_Paulo) | Becomes the heart of the game |
| Lista UI, pitch view, V3 components, reducer pattern | Direct reuse with new theming |
| Share pipeline (4:5 PNG export, embedded fonts, pre-render, iOS url-field) | Direct reuse |
| Roster curation pipeline + invariant tests | New nation pools, same shape |
| Analytics worker + D1 + dashboard (SQL aggregation, OS tracking, funnels, rate limiting) | Extended with 3 new endpoints |
| i18n system (pt/en/es), service worker, CI, deploy scripts | Direct reuse |

**New (the real work):**
1. **Score service** (extend the existing Worker): `POST /score` (day, device-id, picks-hash, points — server recomputes/validates points from picks to prevent forgery), `GET /percentile?day&points`, plus a `daily_scores` D1 table. Percentile = SQL `COUNT(*)` comparisons (the SQL-aggregation muscle we just built).
2. **League service**: `POST /league` (create), `POST /league/join`, `GET /league/:code` (board). Two small D1 tables. Same origin-allowlist + rate-limit hardening already in place.
3. **Daily content system**: a `dailyChallenges.ts` calendar (date → theme, pre-placed six, candidate pool ids, daily condition, benchmark XI) + authoring checklist. Pre-authorable in batches.
4. **Budget-pick UI**: new screen logic on top of Lista (costs, budget meter, slot constraints).
5. **Compressed match presentation**: one match, ~45s reveal, reusing goal-event choreography.
6. **Streak + calendar**: localStorage (consistent with current persistence posture) + the rest-day freeze rule.

**Deliberately NOT building**: accounts/auth, push notifications, native apps, real-match score prediction, prize money (gambling-law exposure), photos/likenesses.

---

## 9. Success metrics (instrumented from day one, same analytics rig)

| Metric | Target (week 2) | Why |
|---|---|---|
| D1 return rate | > 30% | The entire redesign exists for this number (current game: ~0) |
| Completion (open → verdict) | > 55% | Current game does 60% on a 10-minute loop; 3-minute loop should match |
| Share rate (verdict → share action) | > 8% | Current: 0.5%. Comparable score + streak should multiply it |
| K-factor proxy (tagged share visits / DAU) | > 0.15 | The growth loop indicator |
| Bolão participation | > 20% of WAU in ≥1 league | The retention backbone |
| Streak ≥ 7 days | > 15% of D7 cohort | Duolingo's 3.6× retention threshold |

Kill/iterate triggers: if share rate < 2% by day 5 → redesign the share artifact (community-format watch); if D1 < 15% → the daily theme isn't compelling, test harder themes (rivalries, "complete the 1970 XI").

---

## 10. Naming and legal posture

- **Recommended: "Completa o Time"** (pt: "complete the team") — describes the mechanic, owns a verb (like "Wordle" owned guessing), zero FIFA proximity, works as a hashtag and a spoken phrase ("você já completou o time hoje?"). EN: *Complete the XI*; ES: *Completa el Once*.
- Alternatives considered: "Onze do Dia" (clean but generic), "Escala Aí" (very Brazilian, weaker EN/ES travel), "Quinteto" (mismatched: the fantasy is an XI).
- **Never use**: "World Cup", "Copa do Mundo", "FIFA", "Mundial 2026", official emblems/mascots, qualifier phrases implying affiliation. The day's theme references fixtures generically: flags + "México × África do Sul" (factual fixture statements are nominative use; the research-verified danger zone is *branding around the event*, not reporting facts).
- Player names + stats: proceed per the C.B.C. precedent posture (names/factual data, no likenesses) — same posture the entire fantasy/grid industry operates on. Note honestly: it's a US-centric defense; Brazil has its own image-rights tradition, so the no-photos/no-likeness rule is **strict**, and we add a contact-for-takedown line in the footer.
- Domain: own brand domain (e.g., `completaotime.app`), not a Vercel subdomain — the share footer is the product's front door.

## 11. Risks

| Risk | Mitigation |
|---|---|
| Content treadmill (a puzzle every day) | Pre-author in weekly batches; calendar tool + checklist; rest-day templates; only marquee-fixture nations need pools |
| Puzzle too easy/too hard (percentile collapses) | Budget + condition tuning via the balance-sim harness we already have; daily knobs in the content file |
| Score forgery (percentile poisoning) | Server recomputes points from submitted picks + seed (deterministic engine = perfect validator); rate limiting already live |
| FIFA C&D | Naming rules above; generic fixture references; free product, no event branding |
| Late to the wave (tournament started today) | Phased plan ships a playable core in days (see implementation plan); the tournament runs to July 19 and the knockout rounds are the *bigger* attention spike |
| Cold-start percentiles (day 1, few players) | Seed the distribution with simulated field results until N≥200 real submissions (labeled honestly in code, never fabricated user data) |

---

*Implementation plan: `2026-06-11-completa-o-time-implementation.md` in the original Brasileirao repo (https://github.com/QuarkAssistant/Brasileirao/blob/main/docs/superpowers/plans/2026-06-11-completa-o-time-implementation.md)*
