/**
 * Run scoring — points per match with the legibility receipt (Phase A4).
 *
 * PINNED multiplier stacking order (tests enforce this exactly):
 *   1. base:   win 100 (penalty wins included) · draw 40 · loss 10
 *   2. goals:  each user goal is worth 15 × (product of onGoal pointsMults
 *              for that goal — Artilheiro Nato, Joga Bonito, Zagueiro
 *              Artilheiro stack multiplicatively per goal)
 *   3. bonus:  flat onResult pointsBonus values
 *   4. subtotal = base + goals + bonuses
 *   5. goleada: margin ≥ 4 → subtotal × 2
 *   6. card scoreMults: × product (Camisa Pesada, Dia de São Jorge…)
 *   7. round to nearest integer LAST (single rounding point)
 *
 * ScoreBreakdown is the receipt: additive lines carry `value`, multiplier
 * lines carry `mult`; recomputing lines in order reproduces the total.
 */

import { evalOnGoal, evalOnResult, evalScoreMults, type CardDef } from "./cards";
import { isGoleada } from "./playRunMatch";
import { FORMATIONS, type RunMatchResult, type Squad, type StageDef } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const WIN_POINTS = 100;
export const DRAW_POINTS = 40;
export const LOSS_POINTS = 10;
export const GOAL_POINTS = 15;
export const GOLEADA_MULT = 2;

// ---------------------------------------------------------------------------
// Breakdown
// ---------------------------------------------------------------------------

export interface ScoreLine {
  label: string;
  /** Additive points (steps 1-3). */
  value?: number;
  /** Multiplier (steps 5-6), applied to the running total in line order. */
  mult?: number;
  cardId?: string;
}

export interface ScoreBreakdown {
  lines: ScoreLine[];
  total: number;
}

export interface MatchScoreCtx {
  stage: StageDef;
  homeAway: "home" | "away";
  squad: Squad;
}

/** Recompute a breakdown's total from its lines (additive, then mults in order). */
export function totalFromLines(lines: ScoreLine[]): number {
  let total = 0;
  for (const line of lines) {
    if (line.value !== undefined) total += line.value;
    if (line.mult !== undefined) total *= line.mult;
  }
  return Math.round(total);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function scoreMatch(
  result: RunMatchResult,
  cards: CardDef[],
  ctx: MatchScoreCtx,
): ScoreBreakdown {
  const lines: ScoreLine[] = [];

  // 1. base
  const base =
    result.outcome === "win" ? WIN_POINTS : result.outcome === "draw" ? DRAW_POINTS : LOSS_POINTS;
  const baseLabel =
    result.outcome === "win"
      ? result.viaPenalties
        ? "Vitória nos pênaltis"
        : "Vitória"
      : result.outcome === "draw"
        ? "Empate"
        : "Derrota";
  lines.push({ label: baseLabel, value: base });

  // 2. goals — 15 × per-goal onGoal pointsMult product
  const slotPositions = new Map(FORMATIONS[ctx.squad.formation].map((s) => [s.slotId, s.position]));
  const userGoals = result.goalEvents.filter((e) => e.side === "user");
  userGoals.forEach((event, index) => {
    const contribs = evalOnGoal(cards, {
      side: "user",
      goalIndexForSide: index,
      minute: event.minute,
      scorerSlotId: event.scorerSlotId,
      scorerPosition: event.scorerSlotId ? slotPositions.get(event.scorerSlotId) : undefined,
      squad: ctx.squad,
    });
    let mult = 1;
    const boosters: string[] = [];
    for (const { card, effect } of contribs) {
      if (effect.pointsMult) {
        mult *= effect.pointsMult;
        boosters.push(card.name);
      }
    }
    const points = GOAL_POINTS * mult;
    const suffix = boosters.length > 0 ? ` — ${boosters.join(" + ")} ×${mult}` : "";
    lines.push({ label: `Gol de ${event.scorer} (${event.minute}')${suffix}`, value: points });
  });

  // 3. flat onResult point bonuses
  const resultContribs = evalOnResult(cards, {
    outcome: result.outcome,
    userGoals: result.userGoals,
    opponentGoals: result.opponentGoals,
    viaPenalties: result.viaPenalties,
    stage: ctx.stage,
    homeAway: ctx.homeAway,
  });
  for (const { card, effect } of resultContribs) {
    if (effect.pointsBonus) {
      lines.push({ label: `${card.emoji} ${card.name}`, value: effect.pointsBonus, cardId: card.id });
    }
  }

  // 5. goleada ×2
  if (isGoleada(result)) {
    lines.push({
      label: `GOLEADA! ${result.userGoals}×${result.opponentGoals}`,
      mult: GOLEADA_MULT,
    });
  }

  // 6. card score multipliers
  const mults = evalScoreMults(cards, {
    outcome: result.outcome,
    userGoals: result.userGoals,
    opponentGoals: result.opponentGoals,
    stage: ctx.stage,
    homeAway: ctx.homeAway,
  });
  for (const { card, mult } of mults) {
    lines.push({ label: `${card.emoji} ${card.name}`, mult, cardId: card.id });
  }

  return { lines, total: totalFromLines(lines) };
}
