import { describe, expect, it } from "vitest";
import {
  CLEAN_SHEET_COINS,
  DRAW_COINS,
  GOAL_COINS,
  REROLL_COST,
  SIGNING_COST_BY_TIER,
  STARTING_COINS,
  WIN_COINS,
  matchCoins,
  sellValue,
  signingCost,
} from "./economy";
import { getCard } from "./cards";
import { generateJourneymen } from "./journeymen";
import type { RunGoalEvent, RunMatchResult, Squad, StageDef } from "./types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSquad(): Squad {
  return { formation: "4-3-3", slots: generateJourneymen("eco-test-seed", "4-3-3") };
}

function makeStage(patch: Partial<StageDef> = {}): StageDef {
  return {
    id: "g1",
    label: "Grupo — Jogo 1",
    opponent: { name: "Nacional 1971", rating: 75, flavor: "bolso charrúa" },
    homeAway: "home",
    elimination: false,
    completionBonus: 2,
    ...patch,
  };
}

function userGoal(minute: number, slotId = "CA"): RunGoalEvent {
  return { minute, side: "user", scorer: "Faro de Gol", scorerSlotId: slotId };
}

function makeResult(patch: Partial<RunMatchResult> = {}): RunMatchResult {
  const userGoals = patch.userGoals ?? 2;
  const opponentGoals = patch.opponentGoals ?? 0;
  const goalEvents =
    patch.goalEvents ?? Array.from({ length: userGoals }, (_, i) => userGoal(10 + i * 10));
  return {
    userGoals,
    opponentGoals,
    outcome: "win",
    viaPenalties: false,
    goalEvents,
    userStrength: { attack: 70, midfield: 65, defense: 60, overall: 65 },
    opponentRating: 75,
    ...patch,
  };
}

const ctx = () => ({ stage: makeStage(), homeAway: "home" as const, squad: makeSquad() });

// ---------------------------------------------------------------------------
// Constants + sinks
// ---------------------------------------------------------------------------

describe("economy constants", () => {
  it("pins the coin sources and sinks", () => {
    expect(STARTING_COINS).toBe(3);
    expect(REROLL_COST).toBe(2);
    expect(WIN_COINS).toBe(4);
    expect(DRAW_COINS).toBe(1);
    expect(GOAL_COINS).toBe(1);
    expect(CLEAN_SHEET_COINS).toBe(2);
  });

  it("signing costs scale with costTier", () => {
    expect(SIGNING_COST_BY_TIER).toEqual({ 1: 2, 2: 3, 3: 5, 4: 7, 5: 10 });
    expect(signingCost(1)).toBe(2);
    expect(signingCost(5)).toBe(10);
  });

  it("cards sell back at half price, rounded down", () => {
    expect(sellValue(8)).toBe(4);
    expect(sellValue(7)).toBe(3);
    expect(sellValue(3)).toBe(1);
    expect(sellValue(11)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// matchCoins
// ---------------------------------------------------------------------------

describe("matchCoins", () => {
  it("win + 2 goals + clean sheet + stage bonus = 4+2+2+2 = 10", () => {
    const breakdown = matchCoins(makeResult(), [], ctx());
    expect(breakdown.total).toBe(10);
    expect(breakdown.lines.map((l) => l.value)).toEqual([4, 2, 2, 2]);
  });

  it("draw pays 1; loss pays 0 base", () => {
    const draw = matchCoins(
      makeResult({ outcome: "draw", userGoals: 1, opponentGoals: 1, goalEvents: [userGoal(30)] }),
      [],
      ctx(),
    );
    // draw 1 + goal 1 + stage bonus 2
    expect(draw.total).toBe(4);

    const loss = matchCoins(
      makeResult({ outcome: "loss", userGoals: 0, opponentGoals: 2, goalEvents: [] }),
      [],
      ctx(),
    );
    // stage bonus only (non-elimination loss still completes the stage)
    expect(loss.total).toBe(2);
    expect(loss.lines).toHaveLength(1);
  });

  it("penalty wins pay like wins (Catimba converts)", () => {
    const breakdown = matchCoins(
      makeResult({ outcome: "win", viaPenalties: true, userGoals: 1, opponentGoals: 1, goalEvents: [userGoal(50)] }),
      [],
      ctx(),
    );
    expect(breakdown.lines[0]).toEqual({ label: "Vitória nos pênaltis", value: WIN_COINS });
    // 4 + 1 goal + 2 stage = 7 (no clean sheet)
    expect(breakdown.total).toBe(7);
  });

  it("elimination loss collects nothing for the stage (run is dead)", () => {
    const breakdown = matchCoins(
      makeResult({ outcome: "loss", userGoals: 0, opponentGoals: 1, goalEvents: [] }),
      [],
      { ...ctx(), stage: makeStage({ elimination: true }) },
    );
    expect(breakdown.total).toBe(0);
    expect(breakdown.lines).toHaveLength(0);
  });

  it("card coin bonuses land as named lines: Bicho Pago, Muralha, Gol de Placa", () => {
    const cards = [getCard("bicho-pago"), getCard("muralha"), getCard("gol-de-placa")];
    const breakdown = matchCoins(makeResult(), cards, ctx());
    // base: 4 + 2 + 2 + 2(stage) = 10 ; cards: gol-de-placa +2 (first goal), muralha +5, bicho-pago +2
    expect(breakdown.total).toBe(19);
    const cardLines = breakdown.lines.filter((l) => l.cardId);
    expect(cardLines.map((l) => [l.cardId, l.value])).toEqual([
      ["gol-de-placa", 2],
      ["bicho-pago", 2],
      ["muralha", 5],
    ]);
  });

  it("Gol de Placa pays once even with multiple goals, tagged with the minute", () => {
    const breakdown = matchCoins(
      makeResult({ userGoals: 3, goalEvents: [userGoal(12), userGoal(40), userGoal(80)] }),
      [getCard("gol-de-placa")],
      ctx(),
    );
    const lines = breakdown.lines.filter((l) => l.cardId === "gol-de-placa");
    expect(lines).toHaveLength(1);
    expect(lines[0]!.label).toContain("12'");
  });

  it("lines always sum to total", () => {
    const cards = [getCard("bicho-pago"), getCard("muralha")];
    for (const result of [
      makeResult(),
      makeResult({ outcome: "draw", userGoals: 0, opponentGoals: 0, goalEvents: [] }),
      makeResult({ outcome: "loss", userGoals: 1, opponentGoals: 3, goalEvents: [userGoal(5)] }),
    ]) {
      const breakdown = matchCoins(result, cards, ctx());
      expect(breakdown.lines.reduce((s, l) => s + l.value, 0)).toBe(breakdown.total);
    }
  });
});
