import { describe, expect, it } from "vitest";
import { applyDecision, startRun, type RunDecision } from "./runState";
import { buildLibertadoresCompetition } from "./libertadores";
import {
  RUN_STORAGE_KEY,
  competitionForRun,
  deserializeRun,
  restoreRun,
  serializeRun,
  type SavedRun,
} from "./persistence";

const SEED = "persist-seed";

function playSome(): { decisions: RunDecision[]; finalJson: string } {
  const competition = buildLibertadoresCompetition(SEED);
  let state = startRun(SEED, "libertadores", { competition });
  const decisions: RunDecision[] = [
    { type: "roll" },
    { type: "skipSign" },
    { type: "kickoff" },
  ];
  for (const d of decisions) state = applyDecision(state, d);
  return {
    decisions,
    finalJson: JSON.stringify({
      phase: state.phase,
      coins: state.coins,
      score: state.score,
      stageIndex: state.stageIndex,
      groupPoints: state.groupPoints,
    }),
  };
}

describe("run persistence", () => {
  it("round-trips a saved run through serialize/deserialize", () => {
    const saved: SavedRun = {
      v: 1,
      seed: SEED,
      mode: "libertadores",
      decisions: [{ type: "roll" }, { type: "skipSign" }],
      atPreMatch: true,
    };
    expect(deserializeRun(serializeRun(saved))).toEqual(saved);
  });

  it("restoreRun replays the decisions log to the identical state", () => {
    const { decisions, finalJson } = playSome();
    const restored = restoreRun({
      v: 1,
      seed: SEED,
      mode: "libertadores",
      decisions,
      atPreMatch: false,
    });
    expect(restored).not.toBeNull();
    expect(
      JSON.stringify({
        phase: restored!.phase,
        coins: restored!.coins,
        score: restored!.score,
        stageIndex: restored!.stageIndex,
        groupPoints: restored!.groupPoints,
      }),
    ).toBe(finalJson);
  });

  it("competitionForRun is deterministic per seed", () => {
    expect(competitionForRun("libertadores", "x").stages).toEqual(
      competitionForRun("libertadores", "x").stages,
    );
  });

  it("rejects garbage payloads instead of throwing", () => {
    expect(deserializeRun(null)).toBeNull();
    expect(deserializeRun("")).toBeNull();
    expect(deserializeRun("not json {")).toBeNull();
    expect(deserializeRun(JSON.stringify({ v: 99, seed: "s" }))).toBeNull();
    expect(deserializeRun(JSON.stringify({ v: 1, seed: 7, mode: "libertadores", decisions: [], atPreMatch: false }))).toBeNull();
    expect(
      deserializeRun(
        JSON.stringify({ v: 1, seed: "s", mode: "libertadores", decisions: [{ type: "hack" }], atPreMatch: false }),
      ),
    ).toBeNull();
  });

  it("restoreRun returns null on a corrupt decisions log", () => {
    const restored = restoreRun({
      v: 1,
      seed: SEED,
      mode: "libertadores",
      // reroll before roll is illegal — replay must fail safely
      decisions: [{ type: "reroll" }],
      atPreMatch: false,
    });
    expect(restored).toBeNull();
  });

  it("exposes a stable storage key", () => {
    expect(RUN_STORAGE_KEY).toBe("bolado-run-v2");
  });
});
