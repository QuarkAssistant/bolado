/**
 * Tests for runMatchScript.ts (the run broadcast script builder):
 *   - Determinism (same inputs → identical script; different seed → different)
 *   - Kickoff first, carries opponent name + flavor
 *   - Every real goal appears exactly once at its minute; no invented goals
 *   - Card firings become beats at the right moments:
 *       preMatch → right after kickoff, before any goal
 *       goal     → immediately after the matching goal beat
 *       result/shootout → after the fulltime beat
 *   - Penalty shootouts get a shootout beat after fulltime
 *   - Minutes are non-decreasing; halftime present; final score correct
 *   - Integration with real playRunMatch output
 */

import { describe, expect, test } from "vitest";
import { generateJourneymen } from "./journeymen";
import { playRunMatch } from "./playRunMatch";
import { getCard } from "./cards";
import { buildRunMatchScript, type RunMatchBeat } from "./runMatchScript";
import type { CardFiring, OpponentDef, RunMatchResult, Squad, StageDef } from "./types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const squad: Squad = { formation: "4-3-3", slots: generateJourneymen("script-test", "4-3-3") };

const opponent: OpponentDef = {
  name: "Peñarol 1960-61",
  rating: 70,
  flavor: "o Rei de Copas",
};

const stage: StageDef = {
  id: "oitavas",
  label: "Oitavas de Final",
  opponent,
  homeAway: "home",
  elimination: true,
  completionBonus: 3,
};

const ctx = { seed: "run-seed:match:6", stage, squad };

function makeResult(overrides: Partial<RunMatchResult> = {}): RunMatchResult {
  return {
    userGoals: 2,
    opponentGoals: 1,
    outcome: "win",
    viaPenalties: false,
    goalEvents: [
      { minute: 12, side: "user", scorer: "Zé da Vila", scorerSlotId: "CA" },
      { minute: 51, side: "opponent", scorer: "Peñarol 1960-61" },
      { minute: 83, side: "user", scorer: "Tonho Perna-de-Pau", scorerSlotId: "MEI1" },
    ],
    userStrength: { attack: 72, midfield: 70, defense: 68, overall: 70 },
    opponentRating: 70,
    ...overrides,
  };
}

const preMatchFiring: CardFiring = {
  cardId: "caldeirao",
  moment: "preMatch",
  label: "📣 Caldeirão: a torcida empurra, +3 força em casa!",
  value: 3,
};
const goalFiring: CardFiring = {
  cardId: "artilheiro-nato",
  moment: "goal",
  minute: 12,
  label: "🎯 Artilheiro Nato: gol de centroavante vale dobrado!",
  value: 2,
};
const resultFiring: CardFiring = {
  cardId: "bicho-pago",
  moment: "result",
  label: "🍀 Bicho Pago: vitória paga +2 moedas de bicho!",
  value: 2,
};

function goalBeats(beats: RunMatchBeat[]): RunMatchBeat[] {
  return beats.filter((b) => b.type === "goal" || b.type === "oppGoal");
}

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("buildRunMatchScript: determinism", () => {
  test("same inputs → identical script", () => {
    const firings = [preMatchFiring, goalFiring, resultFiring];
    const s1 = buildRunMatchScript(makeResult(), firings, opponent, ctx);
    const s2 = buildRunMatchScript(makeResult(), firings, opponent, ctx);
    expect(s1).toEqual(s2);
  });

  test("different seed → different script", () => {
    const s1 = buildRunMatchScript(makeResult(), [], opponent, ctx);
    const s2 = buildRunMatchScript(makeResult(), [], opponent, { ...ctx, seed: "run-seed:match:7" });
    expect(JSON.stringify(s1)).not.toEqual(JSON.stringify(s2));
  });
});

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

describe("buildRunMatchScript: structure", () => {
  const beats = buildRunMatchScript(makeResult(), [], opponent, ctx);

  test("kickoff is first and carries opponent name + flavor", () => {
    expect(beats[0]!.type).toBe("kickoff");
    expect(beats[0]!.commentary).toContain("Peñarol 1960-61");
    expect(beats[0]!.commentary).toContain("o Rei de Copas");
  });

  test("fulltime present after every in-match beat", () => {
    const fulltimeIdx = beats.findIndex((b) => b.type === "fulltime");
    expect(fulltimeIdx).toBeGreaterThan(0);
    for (const beat of beats.slice(0, fulltimeIdx)) {
      expect(["kickoff", "cardFire", "chance", "oppChance", "goal", "oppGoal", "halftime", "lateDrama"]).toContain(beat.type);
    }
  });

  test("halftime beat always present", () => {
    expect(beats.some((b) => b.type === "halftime")).toBe(true);
  });

  test("minutes are non-decreasing", () => {
    for (let i = 1; i < beats.length; i += 1) {
      expect(beats[i]!.minute).toBeGreaterThanOrEqual(beats[i - 1]!.minute);
    }
  });

  test("every real goal appears exactly once at its minute — no invented goals", () => {
    const goals = goalBeats(beats);
    expect(goals).toHaveLength(3);
    expect(goals.map((b) => [b.minute, b.type, b.scorer])).toEqual([
      [12, "goal", "Zé da Vila"],
      [51, "oppGoal", "Peñarol 1960-61"],
      [83, "goal", "Tonho Perna-de-Pau"],
    ]);
  });

  test("final scoreAtBeat matches the result", () => {
    const last = beats[beats.length - 1]!;
    expect(last.scoreAtBeat).toEqual([2, 1]);
  });

  test("0x0 still produces a watchable script (kickoff, chances, halftime, fulltime)", () => {
    const quiet = buildRunMatchScript(
      makeResult({ userGoals: 0, opponentGoals: 0, outcome: "draw", goalEvents: [] }),
      [],
      opponent,
      { ...ctx, stage: { ...stage, elimination: false } },
    );
    expect(goalBeats(quiet)).toHaveLength(0);
    expect(quiet.some((b) => b.type === "chance" || b.type === "oppChance")).toBe(true);
    expect(quiet[0]!.type).toBe("kickoff");
    expect(quiet.some((b) => b.type === "halftime")).toBe(true);
    expect(quiet.some((b) => b.type === "fulltime")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Card firings as beats
// ---------------------------------------------------------------------------

describe("buildRunMatchScript: card-firing beats", () => {
  const firings = [preMatchFiring, goalFiring, resultFiring];
  const beats = buildRunMatchScript(makeResult(), firings, opponent, ctx);

  test("every firing becomes exactly one cardFire beat with its label", () => {
    const fires = beats.filter((b) => b.type === "cardFire");
    expect(fires).toHaveLength(3);
    expect(fires.map((b) => b.firing?.cardId)).toEqual(["caldeirao", "artilheiro-nato", "bicho-pago"]);
    expect(fires.map((b) => b.commentary)).toEqual(firings.map((f) => f.label));
  });

  test("preMatch firing lands right after kickoff, before any goal", () => {
    const idx = beats.findIndex((b) => b.firing?.cardId === "caldeirao");
    expect(idx).toBe(1);
    expect(beats[idx]!.minute).toBe(1);
  });

  test("goal firing lands immediately after its goal beat", () => {
    const goalIdx = beats.findIndex((b) => b.type === "goal" && b.minute === 12);
    expect(beats[goalIdx + 1]!.type).toBe("cardFire");
    expect(beats[goalIdx + 1]!.firing?.cardId).toBe("artilheiro-nato");
    expect(beats[goalIdx + 1]!.minute).toBe(12);
  });

  test("result firing lands after the fulltime beat", () => {
    const fulltimeIdx = beats.findIndex((b) => b.type === "fulltime");
    const resultIdx = beats.findIndex((b) => b.firing?.cardId === "bicho-pago");
    expect(resultIdx).toBeGreaterThan(fulltimeIdx);
  });
});

// ---------------------------------------------------------------------------
// Penalty shootouts
// ---------------------------------------------------------------------------

describe("buildRunMatchScript: shootout", () => {
  const drawResult = makeResult({
    userGoals: 1,
    opponentGoals: 1,
    outcome: "win",
    viaPenalties: true,
    goalEvents: [
      { minute: 20, side: "user", scorer: "Zé da Vila", scorerSlotId: "CA" },
      { minute: 70, side: "opponent", scorer: "Peñarol 1960-61" },
    ],
  });

  test("penalty win → shootout beat after fulltime, win phrasing", () => {
    const beats = buildRunMatchScript(drawResult, [], opponent, ctx);
    const fulltimeIdx = beats.findIndex((b) => b.type === "fulltime");
    const shootoutIdx = beats.findIndex((b) => b.type === "shootout");
    expect(shootoutIdx).toBeGreaterThan(fulltimeIdx);
    expect(beats[shootoutIdx]!.commentary.toLowerCase()).toMatch(/pênaltis|marca da cal/);
  });

  test("Catimba shootout: activation → shootout beat → outcome firing, in order", () => {
    const catimbaActivation: CardFiring = {
      cardId: "catimba",
      moment: "result",
      label: "😤 Catimba ativou: empate vira disputa de pênaltis!",
    };
    const catimbaOutcome: CardFiring = {
      cardId: "catimba",
      moment: "shootout",
      label: "😤 Catimba: empate vira vitória nos pênaltis!",
    };
    const beats = buildRunMatchScript(drawResult, [catimbaActivation, catimbaOutcome], opponent, ctx);
    const fulltimeIdx = beats.findIndex((b) => b.type === "fulltime");
    const activationIdx = beats.findIndex((b) => b.commentary === catimbaActivation.label);
    const shootoutIdx = beats.findIndex((b) => b.type === "shootout");
    const outcomeIdx = beats.findIndex((b) => b.commentary === catimbaOutcome.label);
    expect(activationIdx).toBeGreaterThan(fulltimeIdx);
    expect(shootoutIdx).toBeGreaterThan(activationIdx);
    expect(outcomeIdx).toBe(shootoutIdx + 1);
  });

  test("no penalties → no shootout beat", () => {
    const beats = buildRunMatchScript(makeResult(), [], opponent, ctx);
    expect(beats.some((b) => b.type === "shootout")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration with playRunMatch
// ---------------------------------------------------------------------------

describe("buildRunMatchScript: integration with the run engine", () => {
  test("real engine output → goals and firings all land as beats", () => {
    const cards = [getCard("caldeirao"), getCard("bicho-pago")];
    const { result, cardFirings } = playRunMatch(squad, cards, opponent, {
      homeAway: "home",
      stage,
      seedStream: "integration:match:0",
    });
    const beats = buildRunMatchScript(result, cardFirings, opponent, {
      seed: "integration:match:0",
      stage,
      squad,
    });

    expect(goalBeats(beats)).toHaveLength(result.goalEvents.length);
    expect(beats.filter((b) => b.type === "cardFire")).toHaveLength(cardFirings.length);
    const last = beats[beats.length - 1]!;
    expect(last.scoreAtBeat).toEqual([result.userGoals, result.opponentGoals]);
  });
});
