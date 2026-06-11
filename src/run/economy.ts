/**
 * Run economy — coin sources and sinks (Phase A4, spec §3.1).
 *
 * Sources (per match):  win +4 · draw +1 (Catimba upgrades draws to wins
 * before this point, so a penalty win pays like a win) · +1 per goal scored ·
 * clean sheet +2 · card coin bonuses (onGoal/onResult hooks) · stage
 * completion bonus (paid when you survive the stage).
 *
 * Sinks: signing a player (by costTier), card prices, dice reroll (2).
 *
 * Every coin movement is exposed as a CoinBreakdown of named lines — the
 * legibility receipt the UI shows after each match.
 */

import { evalOnGoal, evalOnResult, type CardDef } from "./cards";
import { FORMATIONS, type RunMatchResult, type Squad, type StageDef } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const STARTING_COINS = 3;
export const REROLL_COST = 2;

export const WIN_COINS = 4;
export const DRAW_COINS = 1;
export const GOAL_COINS = 1;
export const CLEAN_SHEET_COINS = 2;

/** Signing cost by player costTier (1-5). */
export const SIGNING_COST_BY_TIER: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 2,
  2: 3,
  3: 5,
  4: 7,
  5: 10,
};

export function signingCost(costTier: 1 | 2 | 3 | 4 | 5): number {
  return SIGNING_COST_BY_TIER[costTier];
}

/** Cards sell back at half price, rounded down. */
export function sellValue(price: number): number {
  return Math.floor(price / 2);
}

// ---------------------------------------------------------------------------
// Match coin breakdown
// ---------------------------------------------------------------------------

export interface CoinLine {
  label: string;
  value: number;
  cardId?: string;
}

export interface CoinBreakdown {
  lines: CoinLine[];
  total: number;
}

export interface MatchCoinCtx {
  stage: StageDef;
  homeAway: "home" | "away";
  squad: Squad;
}

/**
 * Coins earned by a finished match. Pure: same result/cards/ctx → same
 * breakdown. The stage completion bonus is included unless the match ended
 * the run (elimination loss — dead runs collect nothing for the stage).
 */
export function matchCoins(
  result: RunMatchResult,
  cards: CardDef[],
  ctx: MatchCoinCtx,
): CoinBreakdown {
  const lines: CoinLine[] = [];

  if (result.outcome === "win") {
    lines.push({
      label: result.viaPenalties ? "Vitória nos pênaltis" : "Vitória",
      value: WIN_COINS,
    });
  } else if (result.outcome === "draw") {
    lines.push({ label: "Empate", value: DRAW_COINS });
  }

  if (result.userGoals > 0) {
    lines.push({ label: `Gols (${result.userGoals} × ${GOAL_COINS})`, value: result.userGoals * GOAL_COINS });
  }

  if (result.opponentGoals === 0) {
    lines.push({ label: "Jogo sem sofrer gol", value: CLEAN_SHEET_COINS });
  }

  // Card coin bonuses — onGoal per user goal (chronological), then onResult.
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
    for (const { card, effect } of contribs) {
      if (effect.coinBonus) {
        lines.push({
          label: `${card.emoji} ${card.name} (${event.minute}')`,
          value: effect.coinBonus,
          cardId: card.id,
        });
      }
    }
  });

  const resultContribs = evalOnResult(cards, {
    outcome: result.outcome,
    userGoals: result.userGoals,
    opponentGoals: result.opponentGoals,
    viaPenalties: result.viaPenalties,
    stage: ctx.stage,
    homeAway: ctx.homeAway,
  });
  for (const { card, effect } of resultContribs) {
    if (effect.coinBonus) {
      lines.push({ label: `${card.emoji} ${card.name}`, value: effect.coinBonus, cardId: card.id });
    }
  }

  // Stage completion bonus — unless this loss killed the run.
  const runEnded = ctx.stage.elimination && result.outcome === "loss";
  if (!runEnded && ctx.stage.completionBonus > 0) {
    lines.push({ label: `Bônus de etapa — ${ctx.stage.label}`, value: ctx.stage.completionBonus });
  }

  return { lines, total: lines.reduce((sum, line) => sum + line.value, 0) };
}
