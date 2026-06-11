import { describe, expect, it } from "vitest";
import {
  DRAW_POINTS,
  GOAL_POINTS,
  GOLEADA_MULT,
  LOSS_POINTS,
  WIN_POINTS,
  scoreMatch,
  totalFromLines,
} from "./runScoring";
import { getCard } from "./cards";
import { generateJourneymen } from "./journeymen";
import type { RunGoalEvent, RunMatchResult, Squad, StageDef } from "./types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSquad(): Squad {
  return { formation: "4-3-3", slots: generateJourneymen("score-test-seed", "4-3-3") };
}

function makeStage(patch: Partial<StageDef> = {}): StageDef {
  return {
    id: "g1",
    label: "Grupo — Jogo 1",
    opponent: { name: "River 1986", rating: 78, flavor: "la banda" },
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
  const goalEvents =
    patch.goalEvents ?? Array.from({ length: userGoals }, (_, i) => userGoal(10 + i * 10));
  return {
    userGoals,
    opponentGoals: 0,
    outcome: "win",
    viaPenalties: false,
    goalEvents,
    userStrength: { attack: 70, midfield: 65, defense: 60, overall: 65 },
    opponentRating: 78,
    ...patch,
  };
}

const ctx = (stage = makeStage()) => ({ stage, homeAway: "home" as const, squad: makeSquad() });

// ---------------------------------------------------------------------------
// Base arithmetic
// ---------------------------------------------------------------------------

describe("scoreMatch base arithmetic", () => {
  it("pins the scoring constants", () => {
    expect(WIN_POINTS).toBe(100);
    expect(DRAW_POINTS).toBe(40);
    expect(LOSS_POINTS).toBe(10);
    expect(GOAL_POINTS).toBe(15);
    expect(GOLEADA_MULT).toBe(2);
  });

  it("win + 2 goals = 100 + 30 = 130", () => {
    const breakdown = scoreMatch(makeResult(), [], ctx());
    expect(breakdown.total).toBe(130);
  });

  it("draw + 1 goal = 40 + 15 = 55; loss + 0 goals = 10", () => {
    const draw = scoreMatch(
      makeResult({ outcome: "draw", userGoals: 1, opponentGoals: 1, goalEvents: [userGoal(20)] }),
      [],
      ctx(),
    );
    expect(draw.total).toBe(55);

    const loss = scoreMatch(
      makeResult({ outcome: "loss", userGoals: 0, opponentGoals: 2, goalEvents: [] }),
      [],
      ctx(),
    );
    expect(loss.total).toBe(10);
  });

  it("penalty wins score as wins (base 100)", () => {
    const breakdown = scoreMatch(
      makeResult({ outcome: "win", viaPenalties: true, userGoals: 1, opponentGoals: 1, goalEvents: [userGoal(9)] }),
      [],
      ctx(),
    );
    expect(breakdown.lines[0]!.label).toBe("Vitória nos pênaltis");
    expect(breakdown.total).toBe(115);
  });

  it("goleada (margin ≥ 4) doubles the subtotal: 5×0 → (100+75)×2 = 350", () => {
    const breakdown = scoreMatch(
      makeResult({ userGoals: 5, goalEvents: [userGoal(5), userGoal(20), userGoal(41), userGoal(60), userGoal(88)] }),
      [],
      ctx(),
    );
    expect(breakdown.total).toBe(350);
    expect(breakdown.lines.some((l) => l.label.startsWith("GOLEADA"))).toBe(true);
  });

  it("4×1 is not a goleada", () => {
    const breakdown = scoreMatch(
      makeResult({ userGoals: 4, opponentGoals: 1, goalEvents: [userGoal(5), userGoal(20), userGoal(41), userGoal(60)] }),
      [],
      ctx(),
    );
    expect(breakdown.total).toBe(160);
    expect(breakdown.lines.every((l) => l.mult === undefined)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Card interactions
// ---------------------------------------------------------------------------

describe("scoreMatch card math", () => {
  it("Artilheiro Nato doubles CA goals only: CA + MEI goals = 100 + 30 + 15 = 145", () => {
    const breakdown = scoreMatch(
      makeResult({ userGoals: 2, goalEvents: [userGoal(10, "CA"), userGoal(70, "MEI1")] }),
      [getCard("artilheiro-nato")],
      ctx(),
    );
    expect(breakdown.total).toBe(145);
  });

  it("Joga Bonito doubles from the 3rd goal: 3 goals = 100 + 15 + 15 + 30 = 160", () => {
    const breakdown = scoreMatch(
      makeResult({ userGoals: 3, goalEvents: [userGoal(10), userGoal(30), userGoal(50)] }),
      [getCard("joga-bonito")],
      ctx(),
    );
    expect(breakdown.total).toBe(160);
  });

  it("per-goal mults stack multiplicatively: 3rd goal by CA with both cards = 15×2×2 = 60", () => {
    const breakdown = scoreMatch(
      makeResult({ userGoals: 3, goalEvents: [userGoal(10, "MEI1"), userGoal(30, "MEI2"), userGoal(50, "CA")] }),
      [getCard("artilheiro-nato"), getCard("joga-bonito")],
      ctx(),
    );
    // 100 + 15 + 15 + 60 = 190
    expect(breakdown.total).toBe(190);
    const third = breakdown.lines[3]!;
    expect(third.value).toBe(60);
    expect(third.label).toContain("×4");
  });

  it("scoreMults apply AFTER goleada (pinned order): 4×0 São Jorge = (100+60)×2×1.25 = 400", () => {
    const breakdown = scoreMatch(
      makeResult({ userGoals: 4, goalEvents: [userGoal(5), userGoal(20), userGoal(41), userGoal(60)] }),
      [getCard("dia-de-sao-jorge")],
      ctx(),
    );
    expect(breakdown.total).toBe(400);
    const multLines = breakdown.lines.filter((l) => l.mult !== undefined);
    expect(multLines.map((l) => l.mult)).toEqual([2, 1.25]); // goleada first, card mult after
  });

  it("Camisa Pesada fires only in mata-mata: win 2×0 KO = 130×1.5 = 195", () => {
    const ko = scoreMatch(makeResult(), [getCard("camisa-pesada")], ctx(makeStage({ elimination: true })));
    expect(ko.total).toBe(195);
    const group = scoreMatch(makeResult(), [getCard("camisa-pesada")], ctx());
    expect(group.total).toBe(130);
  });

  it("rounds once at the end: draw 0×0 with São Jorge = 40×1.25 = 50", () => {
    const breakdown = scoreMatch(
      makeResult({ outcome: "draw", userGoals: 0, opponentGoals: 0, goalEvents: [] }),
      [getCard("dia-de-sao-jorge")],
      ctx(),
    );
    expect(breakdown.total).toBe(50);
    expect(Number.isInteger(breakdown.total)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Breakdown integrity (the legibility receipt)
// ---------------------------------------------------------------------------

describe("ScoreBreakdown receipt", () => {
  it("recomputing lines in order always reproduces the total", () => {
    const cardSets = [
      [],
      [getCard("artilheiro-nato")],
      [getCard("joga-bonito"), getCard("dia-de-sao-jorge")],
      [getCard("artilheiro-nato"), getCard("joga-bonito"), getCard("camisa-pesada"), getCard("dia-de-sao-jorge")],
    ];
    const results = [
      makeResult(),
      makeResult({ userGoals: 5, goalEvents: [userGoal(5), userGoal(20, "MEI1"), userGoal(41), userGoal(60), userGoal(88, "ZAG1")] }),
      makeResult({ outcome: "loss", userGoals: 1, opponentGoals: 3, goalEvents: [userGoal(80)] }),
      makeResult({ outcome: "draw", userGoals: 2, opponentGoals: 2, goalEvents: [userGoal(11), userGoal(77)] }),
    ];
    for (const cards of cardSets) {
      for (const result of results) {
        for (const stage of [makeStage(), makeStage({ elimination: true })]) {
          const breakdown = scoreMatch(result, cards, ctx(stage));
          expect(totalFromLines(breakdown.lines)).toBe(breakdown.total);
        }
      }
    }
  });

  it("every line carries a human label", () => {
    const breakdown = scoreMatch(
      makeResult({ userGoals: 4, goalEvents: [userGoal(5), userGoal(20), userGoal(41), userGoal(60)] }),
      [getCard("dia-de-sao-jorge")],
      ctx(),
    );
    for (const line of breakdown.lines) {
      expect(line.label.length).toBeGreaterThan(2);
    }
  });
});
