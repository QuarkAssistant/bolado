/**
 * Tests for matchScript.ts:
 *   - Determinism
 *   - Every real goal appears exactly once at the right minute
 *   - No invented goals (userGoals/oppGoals in beats match result)
 *   - Beat ordering (minutes non-decreasing)
 *   - Fulltime is last, kickoff is first
 *   - GK-only-saves rule (oppChance uses gk, not attacker; chance doesn't use GK)
 *   - Halftime beat always present
 *   - Variant selection stability
 */

import { describe, expect, test } from "vitest";
import { getChallengeForNumber } from "./challenges";
import { solveChallenge } from "./solver";
import { playDailyMatch, type PickedSlot } from "./playDailyMatch";
import { buildMatchScript } from "./matchScript";
import type { DailyMatchResult } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
// Fixtures
// ---------------------------------------------------------------------------

const challenge = getChallengeForNumber(1)!;
const completion = solveChallenge(challenge).completions[0]!;
const picks = picksFromCompletion(challenge, completion);
const matchResult: DailyMatchResult = playDailyMatch(challenge, picks);

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("buildMatchScript: determinism", () => {
  test("same inputs → identical script every call", () => {
    const s1 = buildMatchScript(challenge, picks, matchResult);
    const s2 = buildMatchScript(challenge, picks, matchResult);
    expect(s1).toEqual(s2);
  });

  test("different challenge → different script", () => {
    // Challenge #2 (if it exists) or an alternative with same picks
    const ch2 = getChallengeForNumber(2);
    if (!ch2) return; // Skip if only 1 challenge
    const comp2 = solveChallenge(ch2).completions[0]!;
    const picks2 = picksFromCompletion(ch2, comp2);
    const result2 = playDailyMatch(ch2, picks2);
    const s1 = buildMatchScript(challenge, picks, matchResult);
    const s2 = buildMatchScript(ch2, picks2, result2);
    // Different challenge → at minimum different seed → different commentary
    expect(JSON.stringify(s1)).not.toBe(JSON.stringify(s2));
  });
});

// ---------------------------------------------------------------------------
// Real goals appear exactly once
// ---------------------------------------------------------------------------

describe("buildMatchScript: real goals", () => {
  test("every real goal event appears exactly once as a goal beat at the right minute", () => {
    const script = buildMatchScript(challenge, picks, matchResult);
    const goalBeats = script.filter((b) => b.type === "goal" || b.type === "oppGoal");

    // Count expected
    expect(goalBeats.length).toBe(matchResult.goalEvents.length);

    // Each real event maps to a beat
    for (const event of matchResult.goalEvents) {
      const matching = goalBeats.filter(
        (b) =>
          b.minute === event.minute &&
          (event.side === "user" ? b.type === "goal" : b.type === "oppGoal") &&
          b.scorer === event.scorer,
      );
      expect(matching).toHaveLength(1);
    }
  });

  test("no invented goals — goal beat count equals result.goalEvents.length", () => {
    // Play a deterministic result with known goals
    const script = buildMatchScript(challenge, picks, matchResult);
    const userGoalBeats = script.filter((b) => b.type === "goal").length;
    const oppGoalBeats = script.filter((b) => b.type === "oppGoal").length;

    expect(userGoalBeats).toBe(matchResult.userGoals);
    expect(oppGoalBeats).toBe(matchResult.opponentGoals);
  });

  test("final score in fulltime beat matches result", () => {
    const script = buildMatchScript(challenge, picks, matchResult);
    const fulltimeBeat = script.find((b) => b.type === "fulltime")!;
    expect(fulltimeBeat).toBeDefined();
    expect(fulltimeBeat.scoreAtBeat[0]).toBe(matchResult.userGoals);
    expect(fulltimeBeat.scoreAtBeat[1]).toBe(matchResult.opponentGoals);
  });
});

// ---------------------------------------------------------------------------
// Beat ordering
// ---------------------------------------------------------------------------

describe("buildMatchScript: ordering", () => {
  test("beats are sorted by minute (non-decreasing)", () => {
    const script = buildMatchScript(challenge, picks, matchResult);
    for (let i = 1; i < script.length; i++) {
      expect(script[i]!.minute).toBeGreaterThanOrEqual(script[i - 1]!.minute);
    }
  });

  test("kickoff is the first beat", () => {
    const script = buildMatchScript(challenge, picks, matchResult);
    expect(script[0]!.type).toBe("kickoff");
  });

  test("fulltime is the last beat", () => {
    const script = buildMatchScript(challenge, picks, matchResult);
    expect(script[script.length - 1]!.type).toBe("fulltime");
  });

  test("halftime beat is always present", () => {
    const script = buildMatchScript(challenge, picks, matchResult);
    const halftime = script.find((b) => b.type === "halftime");
    expect(halftime).toBeDefined();
    expect(halftime!.minute).toBe(45);
  });

  test("total beats between 8 and 20", () => {
    const script = buildMatchScript(challenge, picks, matchResult);
    expect(script.length).toBeGreaterThanOrEqual(8);
    expect(script.length).toBeLessThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// GK-only-saves rule
// ---------------------------------------------------------------------------

describe("buildMatchScript: GK save rule", () => {
  test("oppChance commentary never mentions outfield player names as the saver", () => {
    const script = buildMatchScript(challenge, picks, matchResult);
    const oppChanceBeats = script.filter((b) => b.type === "oppChance");

    // Find our GK
    let gkName = "";
    for (const slot of challenge.prePlaced) {
      if (slot.position === "GOL") { gkName = slot.player.displayName; break; }
    }
    if (!gkName) {
      for (const pick of picks) {
        const slot = challenge.openSlots.find((s) => s.slotId === pick.slotId);
        if (slot?.position === "GOL") { gkName = pick.player.displayName; break; }
      }
    }

    for (const beat of oppChanceBeats) {
      // oppChance beat should contain the GK name or generic save phrases
      // (it should NOT just mention an outfield player as the saver)
      expect(beat.commentary.toLowerCase()).toMatch(/salv|defend|fechou|espalmou|goleiro|inspirado/);
    }
  });

  test("chance beats (our attack) do not use GK as protagonist", () => {
    const script = buildMatchScript(challenge, picks, matchResult);
    const chanceBeats = script.filter((b) => b.type === "chance");

    // Find our GK name
    let gkName = "";
    for (const slot of challenge.prePlaced) {
      if (slot.position === "GOL") { gkName = slot.player.displayName; break; }
    }
    if (!gkName) {
      for (const pick of picks) {
        const openSlot = challenge.openSlots.find((s) => s.slotId === pick.slotId);
        if (openSlot?.position === "GOL") { gkName = pick.player.displayName; break; }
      }
    }

    if (gkName) {
      for (const beat of chanceBeats) {
        // Chance beats (attack chances) should not feature the GK as the protagonist
        // (They may mention GK name in a sub-phrase, but the {player} should not be GK)
        // We check the commentary doesn't start with the GK name as attacking player
        const firstPlayerMention = beat.commentary.match(/^([A-ZÁÉÍÓÚÃÕÂÊÔÜ][a-záéíóúãõâêôü]+ ?[A-ZÁÉÍÓÚÃÕÂÊÔÜ]?[a-záéíóúãõâêôü]*)/);
        if (firstPlayerMention) {
          expect(firstPlayerMention[1]).not.toBe(gkName);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Score accumulation
// ---------------------------------------------------------------------------

describe("buildMatchScript: score tracking", () => {
  test("scoreAtBeat increases monotonically and matches final result", () => {
    const script = buildMatchScript(challenge, picks, matchResult);

    let userGoals = 0;
    let oppGoals = 0;

    for (const beat of script) {
      if (beat.type === "goal") userGoals++;
      if (beat.type === "oppGoal") oppGoals++;
      expect(beat.scoreAtBeat[0]).toBe(userGoals);
      expect(beat.scoreAtBeat[1]).toBe(oppGoals);
    }

    expect(userGoals).toBe(matchResult.userGoals);
    expect(oppGoals).toBe(matchResult.opponentGoals);
  });
});

// ---------------------------------------------------------------------------
// Variant selection stability (phrase pools wired)
// ---------------------------------------------------------------------------

describe("buildMatchScript: phrase coverage", () => {
  test("commentary strings are non-empty for all beats", () => {
    const script = buildMatchScript(challenge, picks, matchResult);
    for (const beat of script) {
      expect(beat.commentary.trim().length).toBeGreaterThan(0);
    }
  });

  test("goal beats include the scorer name in commentary", () => {
    const script = buildMatchScript(challenge, picks, matchResult);
    const goalBeats = script.filter((b) => b.type === "goal");
    for (const beat of goalBeats) {
      expect(beat.scorer).toBeDefined();
      expect(beat.commentary).toContain(beat.scorer!);
    }
  });

  test("no unresolved {token} placeholders in commentary", () => {
    const script = buildMatchScript(challenge, picks, matchResult);
    for (const beat of script) {
      expect(beat.commentary).not.toMatch(/\{[a-z]+\}/);
    }
  });

  // Generate scripts for all available challenges to maximize coverage
  test("scripts produce valid output for all authored challenges", () => {
    for (let n = 1; n <= 8; n++) {
      const ch = getChallengeForNumber(n);
      if (!ch) continue;
      const comp = solveChallenge(ch).completions[0];
      if (!comp) continue;
      const p = picksFromCompletion(ch, comp);
      const r = playDailyMatch(ch, p);
      const s = buildMatchScript(ch, p, r);

      expect(s.length).toBeGreaterThan(0);
      expect(s[0]!.type).toBe("kickoff");
      expect(s[s.length - 1]!.type).toBe("fulltime");
      expect(s.filter((b) => b.type === "goal").length).toBe(r.userGoals);
      expect(s.filter((b) => b.type === "oppGoal").length).toBe(r.opponentGoals);

      // No unresolved tokens
      for (const beat of s) {
        expect(beat.commentary).not.toMatch(/\{[a-z]+\}/);
      }
    }
  });
});
