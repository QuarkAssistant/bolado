/**
 * playRunMatch — the v1 match engine adapted for run context (Phase A3).
 *
 * Differences from playDailyMatch:
 *  - Full 11-slot run squad (formation slots) instead of pre-placed + picks.
 *  - Card preMatch effects modify strength; onGoal/onResult hooks fire and
 *    are RECORDED as CardFirings (the broadcast shows these popups).
 *  - Home/away: away = -2 força (altitude opponents: -4), cards can negate.
 *  - Catimba: a draw goes to a seeded penalty shootout (~55% win). Drawn
 *    elimination matches always go to a shootout (50/50) — mata-mata has no
 *    draws.
 *
 * Determinism: everything derives from ctx.seedStream. Same squad, cards,
 * opponent and seedStream → identical result and firings.
 */

import { createRng, hashSeed } from "../engine/random";
import { goalsFromExpected } from "../engine/goals";
import { bucketForPosition, type StatBucket } from "../teamStrength";
import {
  evalOnGoal,
  evalOnResult,
  evalPreMatch,
  type CardDef,
  type PreMatchCtx,
  type PreMatchEffect,
} from "./cards";
import {
  FORMATIONS,
  type CardFiring,
  type OpponentDef,
  type RunGoalEvent,
  type RunMatchResult,
  type Squad,
  type SquadStrength,
  type StageDef,
} from "./types";

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

export const AWAY_DEBUFF = 2;
export const ALTITUDE_AWAY_DEBUFF = 4;
export const CATIMBA_SHOOTOUT_WIN_PROB = 0.55;
export const ELIMINATION_SHOOTOUT_WIN_PROB = 0.5;

// Same xG curve as v1 (playDailyMatch) — proven tuning.
const BASE_USER_XG = 1.1;
const BASE_OPP_XG = 1.05;
const ATTACK_SCALE = 30;
const OVERALL_SCALE = 50;

export interface RunMatchCtx {
  homeAway: "home" | "away";
  stage: StageDef;
  /** Base seed string for every draw in this match (runState provides it). */
  seedStream: string;
  /** True when any card was bought in the preceding shop (Pé Quente). */
  boughtCardThisShop?: boolean;
  /** Ids of players signed during the run (Lei do Ex). */
  signedPlayerIds?: ReadonlySet<string>;
}

export interface RunMatchOutput {
  result: RunMatchResult;
  cardFirings: CardFiring[];
}

// ---------------------------------------------------------------------------
// Squad strength with card effects + home/away modifiers
// ---------------------------------------------------------------------------

interface CombinedPreMatch {
  teamDelta: number;
  slotDeltas: Map<string, number>;
  negateAwayDebuff: boolean;
  gkToMidfield: boolean;
  defenderScorerWeight: number;
}

function combinePreMatch(effects: PreMatchEffect[]): CombinedPreMatch {
  const combined: CombinedPreMatch = {
    teamDelta: 0,
    slotDeltas: new Map(),
    negateAwayDebuff: false,
    gkToMidfield: false,
    defenderScorerWeight: 1,
  };
  for (const fx of effects) {
    combined.teamDelta += fx.teamDelta ?? 0;
    for (const [slotId, delta] of Object.entries(fx.slotDeltas ?? {})) {
      combined.slotDeltas.set(slotId, (combined.slotDeltas.get(slotId) ?? 0) + delta);
    }
    combined.negateAwayDebuff ||= fx.negateAwayDebuff ?? false;
    combined.gkToMidfield ||= fx.gkToMidfield ?? false;
    combined.defenderScorerWeight = Math.max(
      combined.defenderScorerWeight,
      fx.defenderScorerWeight ?? 1,
    );
  }
  return combined;
}

/** Away debuff for this match: 0 at home; -2 away; -4 away at altitude. */
export function awayDebuff(homeAway: "home" | "away", opponent: OpponentDef): number {
  if (homeAway === "home") return 0;
  return opponent.altitude ? ALTITUDE_AWAY_DEBUFF : AWAY_DEBUFF;
}

/**
 * Aggregate squad strength: bucket each occupant by slot position (same
 * rules as v1 teamStrength), apply per-slot card deltas, then team-wide
 * deltas and the home/away modifier on every aggregate.
 */
export function computeRunSquadStrength(
  squad: Squad,
  modifiers: {
    slotDeltas?: Map<string, number>;
    teamDelta?: number;
    gkToMidfield?: boolean;
    awayPenalty?: number;
  } = {},
): SquadStrength {
  const entries: Array<{ stat: number; bucket: StatBucket }> = [];
  const midfieldExtras: number[] = [];

  for (const slot of FORMATIONS[squad.formation]) {
    const player = squad.slots.get(slot.slotId);
    if (!player) continue;
    const bucket = bucketForPosition(slot.position);
    const stat = player[bucket] + (modifiers.slotDeltas?.get(slot.slotId) ?? 0);
    entries.push({ stat, bucket });
    if (modifiers.gkToMidfield && slot.position === "GOL") midfieldExtras.push(stat);
  }

  const avg = (values: number[]) =>
    values.length === 0 ? 70 : Math.round(values.reduce((s, v) => s + v, 0) / values.length);

  const flat = (modifiers.teamDelta ?? 0) - (modifiers.awayPenalty ?? 0);
  const attack = avg(entries.filter((e) => e.bucket === "attack").map((e) => e.stat)) + flat;
  const midfield =
    avg([...entries.filter((e) => e.bucket === "midfield").map((e) => e.stat), ...midfieldExtras]) +
    flat;
  const defense = avg(entries.filter((e) => e.bucket === "defense").map((e) => e.stat)) + flat;
  const overall = avg(entries.map((e) => e.stat)) + flat;

  return { attack, midfield, defense, overall };
}

// ---------------------------------------------------------------------------
// Scorer pool (slot-aware so onGoal hooks can see scorer position)
// ---------------------------------------------------------------------------

interface ScorerEntry {
  slotId: string;
  name: string;
}

function buildScorerPool(squad: Squad, defenderWeight: number): ScorerEntry[] {
  const pool: ScorerEntry[] = [];
  for (const slot of FORMATIONS[squad.formation]) {
    if (slot.position === "GOL") continue;
    const player = squad.slots.get(slot.slotId);
    if (!player) continue;
    const bucket = bucketForPosition(slot.position);
    const weight = bucket === "attack" ? 3 : bucket === "midfield" ? 2 : defenderWeight;
    for (let i = 0; i < weight; i += 1) pool.push({ slotId: slot.slotId, name: player.displayName });
  }
  return pool;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function playRunMatch(
  squad: Squad,
  cards: CardDef[],
  opponent: OpponentDef,
  ctx: RunMatchCtx,
): RunMatchOutput {
  const seed = ctx.seedStream;
  const firings: CardFiring[] = [];

  // 1. preMatch hooks → strength modifiers (each firing recorded)
  const preCtx: PreMatchCtx = {
    squad,
    opponent,
    homeAway: ctx.homeAway,
    stage: ctx.stage,
    boughtCardThisShop: ctx.boughtCardThisShop ?? false,
    signedPlayerIds: ctx.signedPlayerIds ?? new Set(),
  };
  const preContribs = evalPreMatch(cards, preCtx);
  for (const { card, effect } of preContribs) {
    firings.push({
      cardId: card.id,
      moment: "preMatch",
      label: effect.label,
      value: effect.teamDelta ?? undefined,
    });
  }
  const pre = combinePreMatch(preContribs.map((c) => c.effect));

  const penalty = pre.negateAwayDebuff ? 0 : awayDebuff(ctx.homeAway, opponent);
  const strength = computeRunSquadStrength(squad, {
    slotDeltas: pre.slotDeltas,
    teamDelta: pre.teamDelta,
    gkToMidfield: pre.gkToMidfield,
    awayPenalty: penalty,
  });

  // 2. goals (same xG model + sampler as v1)
  const userXG =
    BASE_USER_XG +
    (strength.attack - opponent.rating) / ATTACK_SCALE +
    (strength.overall - opponent.rating) / OVERALL_SCALE;
  const opponentXG = BASE_OPP_XG + (opponent.rating - strength.defense) / ATTACK_SCALE;

  const rng = createRng(seed);
  const userGoals = goalsFromExpected(userXG, rng());
  const opponentGoals = goalsFromExpected(opponentXG, rng());

  // 3. goal events
  const scorerPool = buildScorerPool(squad, pre.defenderScorerWeight);
  const userEvents: RunGoalEvent[] = [];
  for (let i = 0; i < userGoals; i += 1) {
    const minute = 1 + (hashSeed(`${seed}-user-minute-${i}`) % 90);
    const scorer =
      scorerPool.length > 0
        ? scorerPool[hashSeed(`${seed}-user-scorer-${i}`) % scorerPool.length]!
        : undefined;
    userEvents.push({
      minute,
      side: "user",
      scorer: scorer?.name ?? "Craque da Várzea",
      scorerSlotId: scorer?.slotId,
    });
  }
  userEvents.sort((a, b) => a.minute - b.minute);

  const opponentEvents: RunGoalEvent[] = [];
  for (let i = 0; i < opponentGoals; i += 1) {
    opponentEvents.push({
      minute: 1 + (hashSeed(`${seed}-opponent-minute-${i}`) % 90),
      side: "opponent",
      scorer: opponent.name,
    });
  }

  const goalEvents = [...userEvents, ...opponentEvents].sort(
    (a, b) => a.minute - b.minute || (a.side === b.side ? 0 : a.side === "user" ? -1 : 1),
  );

  // 4. onGoal hooks fire per user goal, in chronological order
  const slotPositions = new Map(FORMATIONS[squad.formation].map((s) => [s.slotId, s.position]));
  userEvents.forEach((event, index) => {
    const contribs = evalOnGoal(cards, {
      side: "user",
      goalIndexForSide: index,
      minute: event.minute,
      scorerSlotId: event.scorerSlotId,
      scorerPosition: event.scorerSlotId ? slotPositions.get(event.scorerSlotId) : undefined,
      squad,
    });
    for (const { card, effect } of contribs) {
      firings.push({
        cardId: card.id,
        moment: "goal",
        minute: event.minute,
        label: effect.label,
        value: effect.pointsMult ?? effect.coinBonus,
      });
    }
  });

  // 5. base outcome + draw resolution (Catimba / mata-mata shootout)
  let outcome: RunMatchResult["outcome"] =
    userGoals > opponentGoals ? "win" : userGoals === opponentGoals ? "draw" : "loss";
  let viaPenalties = false;

  if (outcome === "draw") {
    const drawContribs = evalOnResult(cards, {
      outcome,
      userGoals,
      opponentGoals,
      viaPenalties: false,
      stage: ctx.stage,
      homeAway: ctx.homeAway,
    });
    const catimba = drawContribs.find(({ effect }) => effect.resultOverride === "penaltyShootout");
    const mustResolve = ctx.stage.elimination;

    if (catimba || mustResolve) {
      if (catimba) {
        firings.push({ cardId: catimba.card.id, moment: "result", label: catimba.effect.label });
      }
      const winProb = catimba ? CATIMBA_SHOOTOUT_WIN_PROB : ELIMINATION_SHOOTOUT_WIN_PROB;
      const won = rng() < winProb;
      viaPenalties = true;
      if (won) {
        outcome = "win";
        if (catimba) {
          firings.push({
            cardId: catimba.card.id,
            moment: "shootout",
            label: "😤 Catimba: empate vira vitória nos pênaltis!",
          });
        }
      } else {
        // Lost shootout: in mata-mata that's elimination; in group stage the
        // draw stands (you keep the point — Catimba only upgrades).
        outcome = mustResolve ? "loss" : "draw";
        viaPenalties = mustResolve;
        if (catimba) {
          firings.push({
            cardId: catimba.card.id,
            moment: "shootout",
            label: mustResolve
              ? "😤 Catimba: pênaltis perdidos, fim de jogo..."
              : "😤 Catimba: pênaltis perdidos, fica o empate.",
          });
        }
      }
    }
  }

  // 6. final onResult firings (coin/point bonuses on the FINAL outcome)
  const finalContribs = evalOnResult(cards, {
    outcome,
    userGoals,
    opponentGoals,
    viaPenalties,
    stage: ctx.stage,
    homeAway: ctx.homeAway,
  });
  for (const { card, effect } of finalContribs) {
    if (effect.resultOverride) continue; // Catimba already handled above
    firings.push({
      cardId: card.id,
      moment: "result",
      label: effect.label,
      value: effect.coinBonus ?? effect.pointsBonus,
    });
  }

  return {
    result: {
      userGoals,
      opponentGoals,
      outcome,
      viaPenalties,
      goalEvents,
      userStrength: strength,
      opponentRating: opponent.rating,
    },
    cardFirings: firings,
  };
}

/** Goleada: won by a margin of 4+ (the 7×0 fantasy) → score ×2. */
export function isGoleada(result: Pick<RunMatchResult, "userGoals" | "opponentGoals">): boolean {
  return result.userGoals - result.opponentGoals >= 4;
}
