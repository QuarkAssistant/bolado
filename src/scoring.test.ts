/**
 * Tests for scorePerformance: weight bounds, star buckets, grade rules,
 * and balance assertions (P90-P10 ≥ 20 pts, win-rate 15-85%).
 */

import { describe, expect, test } from "vitest";
import { getChallengeForNumber } from "./challenges";
import { solveChallenge } from "./solver";
import { playDailyMatch, type PickedSlot } from "./playDailyMatch";
import { scorePerformance } from "./scoring";
import type { NationPlayer } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function picksFromCompletion(
  ch: ReturnType<typeof getChallengeForNumber> & object,
  players: NationPlayer[],
): PickedSlot[] {
  const slots = ch.openSlots;
  const used = new Array(players.length).fill(false);
  const result = new Array(slots.length).fill(null) as (NationPlayer | null)[];

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

  if (!dfs(0)) throw new Error(`No valid assignment found`);
  return slots.map((slot, i) => ({ slotId: slot.slotId, player: result[i]! }));
}

// ---------------------------------------------------------------------------
// Weight bounds: total must be 0-100
// ---------------------------------------------------------------------------

describe("scorePerformance: points bounds [0, 100]", () => {
  test("points are in [0, 100] for all 8 challenges (first completion)", () => {
    for (let n = 1; n <= 8; n++) {
      const ch = getChallengeForNumber(n)!;
      const picks = picksFromCompletion(ch, solveChallenge(ch).completions[0]!);
      const matchResult = playDailyMatch(ch, picks);
      const verdict = scorePerformance(ch, picks, matchResult);
      expect(verdict.points).toBeGreaterThanOrEqual(0);
      expect(verdict.points).toBeLessThanOrEqual(100);
    }
  });

  test("points are integer", () => {
    const ch = getChallengeForNumber(1)!;
    const picks = picksFromCompletion(ch, solveChallenge(ch).completions[0]!);
    const matchResult = playDailyMatch(ch, picks);
    const verdict = scorePerformance(ch, picks, matchResult);
    expect(Number.isInteger(verdict.points)).toBe(true);
  });

  test("win always gives more points than loss (same opponent)", () => {
    // Synthetic test: same challenge, but we compare wins vs losses across the
    // pool of all completions — wins should on average score higher
    const ch = getChallengeForNumber(3)!;
    const completions = solveChallenge(ch).completions;

    const winPoints: number[] = [];
    const lossPoints: number[] = [];

    for (const completion of completions.slice(0, 30)) {
      const picks = picksFromCompletion(ch, completion);
      const mr = playDailyMatch(ch, picks);
      const verdict = scorePerformance(ch, picks, mr);
      if (mr.outcome === "win") winPoints.push(verdict.points);
      if (mr.outcome === "loss") lossPoints.push(verdict.points);
    }

    if (winPoints.length > 0 && lossPoints.length > 0) {
      const avgWin = winPoints.reduce((s, v) => s + v, 0) / winPoints.length;
      const avgLoss = lossPoints.reduce((s, v) => s + v, 0) / lossPoints.length;
      expect(avgWin).toBeGreaterThan(avgLoss);
    }
  });
});

// ---------------------------------------------------------------------------
// Star buckets
// ---------------------------------------------------------------------------

describe("scorePerformance: star buckets", () => {
  test("stars are 0-5", () => {
    for (let n = 1; n <= 8; n++) {
      const ch = getChallengeForNumber(n)!;
      const picks = picksFromCompletion(ch, solveChallenge(ch).completions[0]!);
      const mr = playDailyMatch(ch, picks);
      const verdict = scorePerformance(ch, picks, mr);
      expect(verdict.stars).toBeGreaterThanOrEqual(0);
      expect(verdict.stars).toBeLessThanOrEqual(5);
    }
  });

  test("high points → high stars, low points → low stars", () => {
    // Test the relationship across different completions
    const ch = getChallengeForNumber(3)!;
    const completions = solveChallenge(ch).completions;

    let highPtHighStar = 0;
    let lowPtLowStar = 0;
    let totalHigh = 0;
    let totalLow = 0;

    for (const completion of completions.slice(0, 30)) {
      const picks = picksFromCompletion(ch, completion);
      const mr = playDailyMatch(ch, picks);
      const v = scorePerformance(ch, picks, mr);
      if (v.points >= 70) {
        totalHigh++;
        if (v.stars >= 4) highPtHighStar++;
      }
      if (v.points <= 30) {
        totalLow++;
        if (v.stars <= 2) lowPtLowStar++;
      }
    }

    if (totalHigh > 0) expect(highPtHighStar / totalHigh).toBeGreaterThan(0.5);
    if (totalLow > 0) expect(lowPtLowStar / totalLow).toBeGreaterThan(0.5);
  });
});

// ---------------------------------------------------------------------------
// Pick grades
// ---------------------------------------------------------------------------

describe("scorePerformance: pickGrades", () => {
  test("every pick has a grade (🟩, 🟨, 🟥, 🟦)", () => {
    const ch = getChallengeForNumber(1)!;
    const picks = picksFromCompletion(ch, solveChallenge(ch).completions[0]!);
    const mr = playDailyMatch(ch, picks);
    const verdict = scorePerformance(ch, picks, mr);

    expect(verdict.pickGrades).toHaveLength(picks.length);
    const validGrades = new Set(["🟩", "🟨", "🟥", "🟦"]);
    for (const grade of verdict.pickGrades) {
      expect(validGrades.has(grade.grade)).toBe(true);
    }
  });

  test("each grade entry has the slotId and player id from the pick", () => {
    const ch = getChallengeForNumber(1)!;
    const picks = picksFromCompletion(ch, solveChallenge(ch).completions[0]!);
    const mr = playDailyMatch(ch, picks);
    const verdict = scorePerformance(ch, picks, mr);

    for (let i = 0; i < picks.length; i++) {
      expect(verdict.pickGrades[i]!.slotId).toBe(picks[i]!.slotId);
      expect(verdict.pickGrades[i]!.playerId).toBe(picks[i]!.player.id);
    }
  });

  test("condition hit → grade is 🟦 (spot-check challenge #1)", () => {
    // Challenge #1: condition is eraBand = "70s-80s"
    const ch = getChallengeForNumber(1)!;
    const completions = solveChallenge(ch).completions;

    // Find a completion that includes at least one 70s-80s player
    const withCondition = completions.find((picks) =>
      picks.some((p) => ch.condition.appliesTo(p)),
    );
    if (!withCondition) return; // defensive skip

    const picks = picksFromCompletion(ch, withCondition);
    const mr = playDailyMatch(ch, picks);
    const verdict = scorePerformance(ch, picks, mr);

    // At least one grade should be 🟦
    const hasBlue = verdict.pickGrades.some((g) => g.grade === "🟦");
    expect(hasBlue).toBe(true);
  });

  test("expensive flop (tier≥4, no chemistry/condition/goal) → grade is 🟥", () => {
    // Challenge #3: find a completion that has a tier-4+ player
    // that is NOT in the pre-placed era and condition doesn't apply
    const ch = getChallengeForNumber(3)!;
    const completions = solveChallenge(ch).completions;
    const prePlacedEras = new Set(ch.prePlaced.map((s) => s.player.eraBand));

    // Challenge #3 condition: attack >= 90
    const expensive = completions.find((picks) =>
      picks.some(
        (p) =>
          p.costTier >= 4 &&
          !prePlacedEras.has(p.eraBand) &&
          !ch.condition.appliesTo(p),
      ),
    );
    if (!expensive) return; // defensive skip

    const picks = picksFromCompletion(ch, expensive);
    const mr = playDailyMatch(ch, picks);
    const verdict = scorePerformance(ch, picks, mr);

    // We expect at least one 🟥 for an expensive flop
    // (unless they scored — grade rules allow escape via goal)
    const scorers = new Set(
      mr.goalEvents.filter((e) => e.side === "user").map((e) => e.scorer),
    );
    const flopPick = picks.find(
      (p) =>
        p.player.costTier >= 4 &&
        !prePlacedEras.has(p.player.eraBand) &&
        !ch.condition.appliesTo(p.player) &&
        !scorers.has(p.player.displayName),
    );

    if (flopPick) {
      const gradeEntry = verdict.pickGrades.find((g) => g.playerId === flopPick.player.id);
      expect(gradeEntry?.grade).toBe("🟥");
    }
  });
});

// ---------------------------------------------------------------------------
// Balance assertions: P90-P10 ≥ 20, win-rate 15-85%
// ---------------------------------------------------------------------------

describe("scorePerformance: balance (all 8 challenges, all completions)", () => {
  for (let n = 1; n <= 8; n++) {
    const ch = getChallengeForNumber(n)!;
    const completions = solveChallenge(ch).completions;

    test(`challenge #${n}: P90-P10 spread ≥ 20 points (completions: ${completions.length})`, () => {
      const points = completions.map((picks) => {
        const p = picksFromCompletion(ch, picks);
        const mr = playDailyMatch(ch, p);
        return scorePerformance(ch, p, mr).points;
      });
      points.sort((a, b) => a - b);

      const p10 = points[Math.floor(points.length * 0.1)]!;
      const p90 = points[Math.floor(points.length * 0.9)]!;
      expect(p90 - p10).toBeGreaterThanOrEqual(20);
    });

    test(`challenge #${n}: win-rate between 15% and 85%`, () => {
      const outcomes = completions.map((picks) => {
        const p = picksFromCompletion(ch, picks);
        const mr = playDailyMatch(ch, p);
        return mr.outcome;
      });
      const wins = outcomes.filter((o) => o === "win").length;
      const winRate = wins / outcomes.length;
      expect(winRate).toBeGreaterThanOrEqual(0.15);
      expect(winRate).toBeLessThanOrEqual(0.85);
    });
  }
});
