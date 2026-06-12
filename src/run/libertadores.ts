/**
 * LIBERTADORES — the real CompetitionDef (Phase B, spec §3.2).
 *
 * Bracket shape (10 stages, shop before each):
 *   Grupo · Jogo 1-6  → 3 seeded group-tier opponents, each home AND away
 *   Oitavas → Quartas → Semi → mata-tier, ratings strictly rising
 *   FINAL             → boss-tier monster, rated above the semi
 *
 * Determinism: every selection derives from hashSeed(`${seed}:liber:…`) —
 * the same run seed always builds the same bracket (daily-run foundation).
 * Altitude opponents keep their flag, so playRunMatch applies the -4 away
 * debuff; `country` carries the nation-pool tag for Lei do Ex (never the
 * flag emoji — that stays a UI concern resolved via libertadoresOpponentMeta).
 *
 * The dice are powered by LIBERTADORES_DRAFT_SOURCE: 5-player offers rolled
 * from the nation pools via rollDraftOffer ("Lendas do Brasil" figurinhas).
 */

import { createRng, hashSeed } from "../engine/random";
import { nationPools } from "../data/nations";
import {
  libertadoresOpponents,
  opponentsByTier,
  toOpponentDef,
  type LibertadoresOpponent,
} from "../data/libertadores/opponents";
import { rollDraftOffer } from "../data/libertadores/draftClubs";
import type { CompetitionDef, DraftSource } from "./runState";
import type { StageDef } from "./types";

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

export const GROUP_OPPONENT_COUNT = 3;

/** 6 group matches, win 3 / draw 1 — reach this or the run dies at Jogo 6. */
export const GROUP_QUALIFY_POINTS = 8;

export const GROUP_COMPLETION_BONUS = 2;

export const KNOCKOUT_STAGE_IDS = ["oitavas", "quartas", "semi", "final"] as const;

const KNOCKOUT_PLAN: ReadonlyArray<{
  id: (typeof KNOCKOUT_STAGE_IDS)[number];
  label: string;
  homeAway: "home" | "away";
  completionBonus: number;
}> = [
  { id: "oitavas", label: "Oitavas de Final", homeAway: "home", completionBonus: 3 },
  { id: "quartas", label: "Quartas de Final", homeAway: "away", completionBonus: 4 },
  { id: "semi", label: "Semifinal", homeAway: "home", completionBonus: 5 },
  { id: "final", label: "FINAL", homeAway: "away", completionBonus: 8 },
];

/** Group fixture order: every opponent appears once home, once away. */
const GROUP_FIXTURES: ReadonlyArray<{ opponent: number; homeAway: "home" | "away" }> = [
  { opponent: 0, homeAway: "home" },
  { opponent: 1, homeAway: "away" },
  { opponent: 2, homeAway: "home" },
  { opponent: 0, homeAway: "away" },
  { opponent: 1, homeAway: "home" },
  { opponent: 2, homeAway: "away" },
];

// ---------------------------------------------------------------------------
// Seeded selection helpers
// ---------------------------------------------------------------------------

function draw(seed: string, stream: string, counter: number, range: number): number {
  return hashSeed(`${seed}:liber:${stream}:${counter}`) % range;
}

/** Seeded sample of `count` distinct items (declaration order is stable). */
function pickDistinct<T>(pool: readonly T[], count: number, seed: string, stream: string): T[] {
  if (pool.length < count) {
    throw new Error(`libertadores: pool too small for ${count} picks (${stream})`);
  }
  const remaining = [...pool];
  const picked: T[] = [];
  for (let i = 0; i < count; i += 1) {
    picked.push(remaining.splice(draw(seed, stream, i, remaining.length), 1)[0]!);
  }
  return picked;
}

// ---------------------------------------------------------------------------
// Opponent meta lookup (flag emoji, era, tier — UI concerns)
// ---------------------------------------------------------------------------

const META_BY_NAME: ReadonlyMap<string, LibertadoresOpponent> = new Map(
  libertadoresOpponents.map((opponent) => [opponent.name, opponent]),
);

/** Resolve a StageDef's opponent back to its curated entry (flag, era, tier). */
export function libertadoresOpponentMeta(name: string): LibertadoresOpponent | undefined {
  return META_BY_NAME.get(name);
}

// ---------------------------------------------------------------------------
// Dice draft source — 5-player "Lendas do …" offers from the nation pools
// ---------------------------------------------------------------------------

const DRAFT_OFFER_COUNT = 240;

export const LIBERTADORES_DRAFT_SOURCE: DraftSource = {
  offerCount: DRAFT_OFFER_COUNT,
  getOffer(index) {
    if (index < 0 || index >= DRAFT_OFFER_COUNT) {
      throw new Error(`Libertadores draft offer index out of range: ${index}`);
    }
    const offer = rollDraftOffer(nationPools, createRng(`libertadores-draft:${index}`));
    return { id: `liber-draft-${index}`, label: offer.label, players: offer.players };
  },
};

// ---------------------------------------------------------------------------
// Bracket builder
// ---------------------------------------------------------------------------

function buildGroupStages(seed: string): StageDef[] {
  const opponents = pickDistinct(opponentsByTier("group"), GROUP_OPPONENT_COUNT, seed, "group");
  return GROUP_FIXTURES.map((fixture, index) => ({
    id: `grupo-${index + 1}`,
    label: `Grupo · Jogo ${index + 1}`,
    opponent: toOpponentDef(opponents[fixture.opponent]!),
    homeAway: fixture.homeAway,
    elimination: false,
    completionBonus: GROUP_COMPLETION_BONUS,
  }));
}

function buildKnockoutStages(seed: string): StageDef[] {
  // Oitavas/Quartas/Semi: three DISTINCT mata-tier ratings (strict rise),
  // then one seeded opponent per rating.
  const mata = opponentsByTier("mata");
  const ratings = pickDistinct(
    [...new Set(mata.map((o) => o.rating))].sort((a, b) => a - b),
    KNOCKOUT_PLAN.length - 1,
    seed,
    "mata-rating",
  ).sort((a, b) => a - b);
  const mataPicks = ratings.map((rating, i) => {
    const candidates = mata.filter((o) => o.rating === rating);
    return candidates[draw(seed, "mata-pick", i, candidates.length)]!;
  });

  // FINAL: a boss rated strictly above the semi — the curve never dips.
  const semiRating = mataPicks[mataPicks.length - 1]!.rating;
  const bosses = opponentsByTier("boss").filter((o) => o.rating > semiRating);
  const finalBoss = bosses[draw(seed, "boss", 0, bosses.length)]!;

  return KNOCKOUT_PLAN.map((plan, index) => ({
    id: plan.id,
    label: plan.label,
    opponent: toOpponentDef(index < mataPicks.length ? mataPicks[index]! : finalBoss),
    homeAway: plan.homeAway,
    elimination: true,
    completionBonus: plan.completionBonus,
  }));
}

/**
 * Build the Libertadores bracket for a run seed. Pure & deterministic:
 * same seed → same 10 stages, same group rule, same draft source.
 */
export function buildLibertadoresCompetition(seed: string): CompetitionDef {
  const stages = [...buildGroupStages(seed), ...buildKnockoutStages(seed)];
  return {
    id: "libertadores",
    label: "Libertadores",
    stages,
    groupRule: {
      stageIds: stages.filter((s) => !s.elimination).map((s) => s.id),
      qualifyPoints: GROUP_QUALIFY_POINTS,
    },
    draftSource: LIBERTADORES_DRAFT_SOURCE,
  };
}
