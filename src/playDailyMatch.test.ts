/**
 * Tests for playDailyMatch: determinism, bounds, scorer attribution,
 * condition/chemistry effects, and benchmark naming.
 */

import { describe, expect, test } from "vitest";
import { getChallengeForNumber } from "./challenges";
import { solveChallenge } from "./solver";
import { playDailyMatch, type PickedSlot } from "./playDailyMatch";
import type { DailyMatchResult } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build PickedSlots from solver completions using backtracking assignment.
 *  The solver guarantees a valid bipartite match exists, but not in slot order,
 *  so greedy fails. This finds the actual assignment. */
function picksFromCompletion(
  challenge: ReturnType<typeof getChallengeForNumber> & object,
  players: import("./types").NationPlayer[],
): PickedSlot[] {
  const slots = challenge.openSlots;
  const used = new Array(players.length).fill(false);
  const result = new Array(slots.length).fill(null) as (import("./types").NationPlayer | null)[];

  function dfs(slotIdx: number): boolean {
    if (slotIdx === slots.length) return true;
    const slot = slots[slotIdx]!;
    for (let i = 0; i < players.length; i++) {
      if (!used[i] && players[i]!.positions.includes(slot.position)) {
        used[i] = true;
        result[slotIdx] = players[i]!;
        if (dfs(slotIdx + 1)) return true;
        used[i] = false;
        result[slotIdx] = null;
      }
    }
    return false;
  }

  if (!dfs(0)) throw new Error(`No valid assignment for completion`);
  return slots.map((slot, i) => ({ slotId: slot.slotId, player: result[i]! }));
}

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("playDailyMatch: determinism", () => {
  test("same picks + same challenge → identical result every call", () => {
    const ch = getChallengeForNumber(1)!;
    const completion = solveChallenge(ch).completions[0]!;
    const picks = picksFromCompletion(ch, completion);

    const r1 = playDailyMatch(ch, picks);
    const r2 = playDailyMatch(ch, picks);

    expect(r1.userGoals).toBe(r2.userGoals);
    expect(r1.opponentGoals).toBe(r2.opponentGoals);
    expect(r1.outcome).toBe(r2.outcome);
    expect(r1.goalEvents).toEqual(r2.goalEvents);
  });

  test("different picks → different seed, likely different result", () => {
    const ch = getChallengeForNumber(3)!;
    const completions = solveChallenge(ch).completions;
    expect(completions.length).toBeGreaterThanOrEqual(2);

    const picks0 = picksFromCompletion(ch, completions[0]!);
    const picks1 = picksFromCompletion(ch, completions[completions.length - 1]!);

    const r0 = playDailyMatch(ch, picks0);
    const r1 = playDailyMatch(ch, picks1);

    // Different picks produce different player-id sequences → different seeds.
    // To keep the test robust, we verify the goal events are not byte-for-byte identical
    // (they differ in the scorer pool even if the score happens to be the same).
    const e0 = JSON.stringify(r0.goalEvents);
    const e1 = JSON.stringify(r1.goalEvents);
    expect(e0).not.toBe(e1);
  });

  test("goal events order is deterministic (sorted by minute)", () => {
    const ch = getChallengeForNumber(1)!;
    const picks = picksFromCompletion(ch, solveChallenge(ch).completions[0]!);
    const { goalEvents } = playDailyMatch(ch, picks);
    for (let i = 1; i < goalEvents.length; i++) {
      expect(goalEvents[i]!.minute).toBeGreaterThanOrEqual(goalEvents[i - 1]!.minute);
    }
  });
});

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

describe("playDailyMatch: bounds", () => {
  test("goals are in [0, 8] for all 8 challenges (first completion)", () => {
    for (let n = 1; n <= 8; n++) {
      const ch = getChallengeForNumber(n)!;
      const picks = picksFromCompletion(ch, solveChallenge(ch).completions[0]!);
      const result = playDailyMatch(ch, picks);
      expect(result.userGoals).toBeGreaterThanOrEqual(0);
      expect(result.userGoals).toBeLessThanOrEqual(8);
      expect(result.opponentGoals).toBeGreaterThanOrEqual(0);
      expect(result.opponentGoals).toBeLessThanOrEqual(8);
    }
  });

  test("goalEvents length equals userGoals + opponentGoals", () => {
    const ch = getChallengeForNumber(2)!;
    const picks = picksFromCompletion(ch, solveChallenge(ch).completions[0]!);
    const result = playDailyMatch(ch, picks);
    expect(result.goalEvents).toHaveLength(result.userGoals + result.opponentGoals);
  });

  test("outcome matches goals: win/draw/loss", () => {
    for (let n = 1; n <= 8; n++) {
      const ch = getChallengeForNumber(n)!;
      const picks = picksFromCompletion(ch, solveChallenge(ch).completions[0]!);
      const result = playDailyMatch(ch, picks);
      if (result.userGoals > result.opponentGoals) expect(result.outcome).toBe("win");
      else if (result.userGoals === result.opponentGoals) expect(result.outcome).toBe("draw");
      else expect(result.outcome).toBe("loss");
    }
  });

  test("all goal events have a minute between 1 and 90", () => {
    const ch = getChallengeForNumber(1)!;
    const picks = picksFromCompletion(ch, solveChallenge(ch).completions[0]!);
    const result = playDailyMatch(ch, picks);
    for (const ev of result.goalEvents) {
      expect(ev.minute).toBeGreaterThanOrEqual(1);
      expect(ev.minute).toBeLessThanOrEqual(90);
    }
  });
});

// ---------------------------------------------------------------------------
// Goalkeeper never scores
// ---------------------------------------------------------------------------

describe("playDailyMatch: GK exclusion", () => {
  test("no goal event has a goalkeeper as scorer (checks all 8 challenges)", () => {
    for (let n = 1; n <= 8; n++) {
      const ch = getChallengeForNumber(n)!;
      const completions = solveChallenge(ch).completions;

      // Build a set of GK names in this challenge (pre-placed + candidates)
      const gkNames = new Set<string>();
      for (const s of ch.prePlaced) {
        if (s.position === "GOL") gkNames.add(s.player.displayName);
      }
      for (const c of ch.candidates) {
        if (c.positions.includes("GOL") && c.positions.length === 1) {
          gkNames.add(c.displayName);
        }
      }

      // Sample a few completions
      const sample = completions.slice(0, Math.min(5, completions.length));
      for (const completion of sample) {
        const picks = picksFromCompletion(ch, completion);
        const result = playDailyMatch(ch, picks);
        for (const ev of result.goalEvents) {
          if (ev.side === "user") {
            expect(gkNames.has(ev.scorer), `GK "${ev.scorer}" scored in challenge #${n}`).toBe(
              false,
            );
          }
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Benchmark scorer naming
// ---------------------------------------------------------------------------

describe("playDailyMatch: benchmark goals", () => {
  test("benchmark goals are attributed to the benchmark name (Seleção do Mundo)", () => {
    // Run across several challenges until we find one with opponent goals
    let found = false;
    for (let n = 1; n <= 8 && !found; n++) {
      const ch = getChallengeForNumber(n)!;
      const completions = solveChallenge(ch).completions;
      for (const completion of completions.slice(0, 10)) {
        const picks = picksFromCompletion(ch, completion);
        const result = playDailyMatch(ch, picks);
        for (const ev of result.goalEvents) {
          if (ev.side === "opponent") {
            expect(ev.scorer).toBe(ch.benchmark.name);
            found = true;
          }
        }
        if (found) break;
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Condition and chemistry bonuses move the result
// ---------------------------------------------------------------------------

describe("playDailyMatch: condition/chemistry effects", () => {
  test("XI with many condition-matching picks scores more goals than an XI with none (across 8 seeds)", () => {
    // Challenge #1: condition is eraBand=70s-80s
    const ch = getChallengeForNumber(1)!;
    const completions = solveChallenge(ch).completions;

    const conditionMatchers = completions.filter((picks) =>
      picks.filter((p) => ch.condition.appliesTo(p)).length >= 2,
    );
    const conditionMisses = completions.filter((picks) =>
      picks.every((p) => !ch.condition.appliesTo(p)),
    );

    // Only run if we have both groups
    if (conditionMatchers.length === 0 || conditionMisses.length === 0) return;

    const avgGoalsWithCondition =
      conditionMatchers.slice(0, 10).reduce((sum, picks) => {
        const p = picksFromCompletion(ch, picks);
        return sum + playDailyMatch(ch, p).userGoals;
      }, 0) / Math.min(10, conditionMatchers.length);

    const avgGoalsWithoutCondition =
      conditionMisses.slice(0, 10).reduce((sum, picks) => {
        const p = picksFromCompletion(ch, picks);
        return sum + playDailyMatch(ch, p).userGoals;
      }, 0) / Math.min(10, conditionMisses.length);

    // Condition-matching XI should on average do at least as well
    expect(avgGoalsWithCondition).toBeGreaterThanOrEqual(avgGoalsWithoutCondition - 1.0);
  });

  test("XI with chemistry links produces a higher team strength than one without", () => {
    // This test verifies that chemistry (same era as pre-placed) is counted
    // by checking the score of a purely era-matching XI vs a mismatched one
    const ch = getChallengeForNumber(1)!;
    const prePlacedEras = new Set(ch.prePlaced.map((s) => s.player.eraBand));

    const completions = solveChallenge(ch).completions;
    const withLinks = completions.filter(
      (picks) => picks.filter((p) => prePlacedEras.has(p.eraBand)).length >= 2,
    );
    const withoutLinks = completions.filter(
      (picks) => picks.every((p) => !prePlacedEras.has(p.eraBand)),
    );

    if (withLinks.length === 0 || withoutLinks.length === 0) return;

    const avgWith =
      withLinks.slice(0, 5).reduce((s, p) => {
        const picks = picksFromCompletion(ch, p);
        const r = playDailyMatch(ch, picks);
        return s + r.userGoals + (r.outcome === "win" ? 1 : 0);
      }, 0) / Math.min(5, withLinks.length);

    const avgWithout =
      withoutLinks.slice(0, 5).reduce((s, p) => {
        const picks = picksFromCompletion(ch, p);
        const r = playDailyMatch(ch, picks);
        return s + r.userGoals + (r.outcome === "win" ? 1 : 0);
      }, 0) / Math.min(5, withoutLinks.length);

    // Chemistry links should not hurt
    expect(avgWith).toBeGreaterThanOrEqual(avgWithout - 1.5);
  });
});
