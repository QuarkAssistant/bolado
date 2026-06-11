/**
 * Test suite for the Bolado daily challenge calendar (week 1, #1-#8).
 *
 * Tests cover:
 * - Structural invariants per challenge (IDs, flags, labels, slot counts)
 * - Challenge number ↔ date alignment via challengeNumberForDate
 * - Solver solvability: ≥50 valid completions, ≥1 tier-5 completion
 * - GOL uniqueness across the full XI (prePlaced + picks)
 * - All candidate IDs exist in the actual nation pools
 */

import { describe, expect, test } from "vitest";
import { CHALLENGES, getChallengeForNumber, getTodayChallenge } from "./challenges";
import { solveChallenge, isValidCompletion } from "./solver";
import { challengeNumberForDate } from "./dailyId";
import { allNationPlayers } from "./data/nations";
import type { DailyChallenge } from "./types";

// ---------------------------------------------------------------------------
// Per-challenge structural tests
// ---------------------------------------------------------------------------

describe("challenge calendar: structural invariants", () => {
  test("exactly 8 authored challenges for week 1", () => {
    expect(CHALLENGES.size).toBe(8);
  });

  test("challenge numbers are 1-8 (consecutive)", () => {
    const nums = [...CHALLENGES.keys()].sort((a, b) => a - b);
    expect(nums).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  for (const [num, ch] of CHALLENGES.entries()) {
    describe(`challenge #${num} (${ch.themeLabel})`, () => {
      test("id matches map key", () => {
        expect(ch.id).toBe(num);
      });

      test("flags and themeLabel are non-empty", () => {
        expect(ch.flags.length).toBeGreaterThan(0);
        expect(ch.themeLabel.length).toBeGreaterThan(0);
      });

      test("flags contains the × separator (spec §6)", () => {
        expect(ch.flags).toContain("×");
      });

      test("date is a valid YYYY-MM-DD string", () => {
        expect(ch.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      test("exactly 6 prePlaced slots", () => {
        expect(ch.prePlaced).toHaveLength(6);
      });

      test("exactly 5 openSlots", () => {
        expect(ch.openSlots).toHaveLength(5);
      });

      test("exactly 15 candidates", () => {
        expect(ch.candidates).toHaveLength(15);
      });

      test("prePlaced + openSlots = 11 total (a full XI)", () => {
        expect(ch.prePlaced.length + ch.openSlots.length).toBe(11);
      });

      test("exactly 1 GOL slot across the full XI", () => {
        const golInPreplaced = ch.prePlaced.filter(s => s.position === "GOL").length;
        const golInOpen = ch.openSlots.filter(s => s.position === "GOL").length;
        expect(golInPreplaced + golInOpen).toBe(1);
      });

      test("budget is 12", () => {
        expect(ch.budget).toBe(12);
      });

      test("benchmark rating is between 80 and 95", () => {
        expect(ch.benchmark.rating).toBeGreaterThanOrEqual(80);
        expect(ch.benchmark.rating).toBeLessThanOrEqual(95);
      });

      test("all candidate ids exist in the nation pools", () => {
        const allIds = new Set(allNationPlayers.map(p => p.id));
        for (const candidate of ch.candidates) {
          expect(allIds.has(candidate.id), `Candidate id "${candidate.id}" not found in any pool`).toBe(true);
        }
      });

      test("all prePlaced player ids exist in the nation pools", () => {
        const allIds = new Set(allNationPlayers.map(p => p.id));
        for (const slot of ch.prePlaced) {
          expect(allIds.has(slot.player.id), `Pre-placed player id "${slot.player.id}" not found`).toBe(true);
        }
      });

      test("no candidate is also pre-placed (no duplicates)", () => {
        const prePlacedIds = new Set(ch.prePlaced.map(s => s.player.id));
        for (const c of ch.candidates) {
          expect(prePlacedIds.has(c.id), `Candidate "${c.id}" is also pre-placed — should not appear twice`).toBe(false);
        }
      });

      test("candidate ids are unique within the challenge", () => {
        const seen = new Set<string>();
        for (const c of ch.candidates) {
          expect(seen.has(c.id), `Duplicate candidate "${c.id}" in challenge #${num}`).toBe(false);
          seen.add(c.id);
        }
      });

      test("every openSlot position is covered by at least one candidate", () => {
        for (const slot of ch.openSlots) {
          const covers = ch.candidates.some(c => c.positions.includes(slot.position));
          expect(covers, `Open slot position "${slot.position}" has no covering candidate in #${num}`).toBe(true);
        }
      });

      test("condition has non-empty label in pt, en, es", () => {
        expect(ch.condition.label.pt.length).toBeGreaterThan(0);
        expect(ch.condition.label.en.length).toBeGreaterThan(0);
        expect(ch.condition.label.es.length).toBeGreaterThan(0);
      });

      test("condition bonus is positive", () => {
        expect(ch.condition.bonus).toBeGreaterThan(0);
      });

      test("prePlaced positions are valid Position values", () => {
        const validPositions = ["GOL","LD","LE","ZAG","VOL","MEI","MD","ME","PD","PE","CA"];
        for (const slot of ch.prePlaced) {
          expect(validPositions.includes(slot.position), `Invalid prePlaced position: ${slot.position}`).toBe(true);
        }
      });

      test("openSlot positions are valid Position values", () => {
        const validPositions = ["GOL","LD","LE","ZAG","VOL","MEI","MD","ME","PD","PE","CA"];
        for (const slot of ch.openSlots) {
          expect(validPositions.includes(slot.position), `Invalid openSlot position: ${slot.position}`).toBe(true);
        }
      });

      test("every prePlaced player's positions include their assigned slot position", () => {
        for (const slot of ch.prePlaced) {
          expect(
            slot.player.positions.includes(slot.position),
            `Pre-placed player "${slot.player.id}" (positions: [${slot.player.positions.join(", ")}]) cannot fill assigned slot position "${slot.position}" in challenge #${num}`
          ).toBe(true);
        }
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Date alignment tests
// ---------------------------------------------------------------------------

describe("challenge calendar: date-to-number alignment", () => {
  const dateMap: Record<number, string> = {
    1: "2026-06-11",
    2: "2026-06-12",
    3: "2026-06-13",
    4: "2026-06-14",
    5: "2026-06-15",
    6: "2026-06-16",
    7: "2026-06-17",
    8: "2026-06-18",
  };

  for (const [num, dateStr] of Object.entries(dateMap)) {
    test(`challenge #${num} date is ${dateStr}`, () => {
      const ch = getChallengeForNumber(Number(num))!;
      expect(ch.date).toBe(dateStr);
    });

    test(`challengeNumberForDate(${dateStr}) returns ${num}`, () => {
      // Use noon UTC on that date to be safely in SP timezone
      const d = new Date(`${dateStr}T15:00:00.000Z`);
      expect(challengeNumberForDate(d)).toBe(Number(num));
    });
  }

  test("getChallengeForNumber(0) returns null", () => {
    expect(getChallengeForNumber(0)).toBeNull();
  });

  test("getChallengeForNumber(9) returns null (beyond authored horizon)", () => {
    expect(getChallengeForNumber(9)).toBeNull();
  });

  test("getChallengeForNumber(-1) returns null", () => {
    expect(getChallengeForNumber(-1)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Solver solvability tests (the spec requires ≥50 valid completions, ≥1 tier-5)
// ---------------------------------------------------------------------------

describe("solver: solvability invariants", () => {
  for (const [num, ch] of CHALLENGES.entries()) {
    describe(`challenge #${num}`, () => {
      // Solve once and cache for reuse within this suite group
      const result = solveChallenge(ch);

      test("≥ 50 distinct valid completions under budget", () => {
        expect(result.count).toBeGreaterThanOrEqual(50);
      });

      test("≥ 1 completion that includes a tier-5 player", () => {
        const hasTier5 = result.completions.some(picks =>
          picks.some(p => p.costTier === 5)
        );
        expect(hasTier5).toBe(true);
      });

      test("all returned completions are under or at the budget", () => {
        for (const picks of result.completions) {
          const cost = picks.reduce((s, p) => s + p.costTier, 0);
          expect(cost).toBeLessThanOrEqual(ch.budget);
        }
      });

      test("all returned completions have exactly openSlots.length picks", () => {
        for (const picks of result.completions) {
          expect(picks).toHaveLength(ch.openSlots.length);
        }
      });

      test("all returned completions are assignable to open slots", () => {
        for (const picks of result.completions) {
          expect(isValidCompletion(picks, ch.openSlots, ch.budget)).toBe(true);
        }
      });

      test("the cheapest valid completion costs ≤ budget", () => {
        const minCost = Math.min(...result.completions.map(picks =>
          picks.reduce((s, p) => s + p.costTier, 0)
        ));
        expect(minCost).toBeLessThanOrEqual(ch.budget);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// isValidCompletion unit tests
// ---------------------------------------------------------------------------

describe("solver: isValidCompletion", () => {
  test("returns false for wrong number of picks", () => {
    const ch = getChallengeForNumber(1)!;
    expect(isValidCompletion([], ch.openSlots, ch.budget)).toBe(false);
    expect(isValidCompletion(ch.candidates.slice(0, 3), ch.openSlots, ch.budget)).toBe(false);
  });

  test("returns false when over budget", () => {
    const ch = getChallengeForNumber(1)!;
    // Force 5 tier-5 players (cost = 25, way over budget 12)
    const expensivePicks = ch.candidates.filter(p => p.costTier === 5).slice(0, 2);
    // Just test the budget check with a synthetic array that's valid otherwise
    const result = solveChallenge(ch);
    const validCombo = result.completions[0];
    if (validCombo) {
      // Confirm valid
      expect(isValidCompletion(validCombo, ch.openSlots, ch.budget)).toBe(true);
      // Same picks but budget=0 → over budget
      expect(isValidCompletion(validCombo, ch.openSlots, 0)).toBe(false);
    }
  });

  test("a known valid pick from #1 is recognized as valid", () => {
    const ch = getChallengeForNumber(1)!;
    const result = solveChallenge(ch);
    expect(result.count).toBeGreaterThan(0);
    const firstCompletion = result.completions[0];
    expect(isValidCompletion(firstCompletion, ch.openSlots, ch.budget)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getTodayChallenge / getChallengeForNumber integration
// ---------------------------------------------------------------------------

describe("getTodayChallenge", () => {
  test("returns a DailyChallenge or null (no crash)", () => {
    // Can be null if the system date is before epoch; during tournament it returns a challenge
    const result = getTodayChallenge();
    if (result !== null) {
      expect(result.id).toBeGreaterThanOrEqual(1);
      expect(result.candidates).toHaveLength(15);
    } else {
      // Pre-epoch or beyond horizon is OK
      expect(result).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Condition appliesTo sanity checks (spot-check a few challenges)
// ---------------------------------------------------------------------------

describe("challenge conditions: appliesTo sanity", () => {
  test("#1 altitude condition: Hugo Sánchez (70s-80s) gets the bonus", () => {
    const ch = getChallengeForNumber(1)!;
    const prePlacedSanchez = ch.prePlaced.find(s => s.player.id === "mx-hugo-sanchez")!;
    expect(ch.condition.appliesTo(prePlacedSanchez.player)).toBe(true);
  });

  test("#1 altitude condition: Ochoa (10s-20s) does NOT get the bonus", () => {
    const ch = getChallengeForNumber(1)!;
    const ochoa = ch.candidates.find(c => c.id === "mx-ochoa")!;
    expect(ch.condition.appliesTo(ochoa)).toBe(false);
  });

  test("#3 jogo de rua: Ronaldo (attack=98) gets the bonus", () => {
    const ch = getChallengeForNumber(3)!;
    const ronaldo = ch.prePlaced.find(s => s.player.id === "br-ronaldo")!;
    expect(ch.condition.appliesTo(ronaldo.player)).toBe(true);
  });

  test("#3 jogo de rua: Taffarel (attack=22) does NOT get the bonus", () => {
    const ch = getChallengeForNumber(3)!;
    const taffarel = ch.candidates.find(c => c.id === "br-taffarel")!;
    expect(ch.condition.appliesTo(taffarel)).toBe(false);
  });

  test("#4 total football: Cruyff (attack+midfield=190) gets the bonus", () => {
    const ch = getChallengeForNumber(4)!;
    const cruyff = ch.prePlaced.find(s => s.player.id === "nl-cruyff")!;
    expect(ch.condition.appliesTo(cruyff.player)).toBe(true);
  });

  test("#5 tiki-taka: Xavi (00s-10s) gets the bonus", () => {
    const ch = getChallengeForNumber(5)!;
    const xavi = ch.prePlaced.find(s => s.player.id === "es-xavi")!;
    expect(ch.condition.appliesTo(xavi.player)).toBe(true);
  });

  test("#6 aerial: Vieira (defense=84) gets the bonus", () => {
    const ch = getChallengeForNumber(6)!;
    const vieira = ch.prePlaced.find(s => s.player.id === "fr-vieira")!;
    expect(ch.condition.appliesTo(vieira.player)).toBe(true);
  });

  test("#7 south american roots: Maradona (70s-80s) gets the bonus", () => {
    const ch = getChallengeForNumber(7)!;
    const maradona = ch.candidates.find(c => c.id === "ar-maradona")!;
    expect(ch.condition.appliesTo(maradona)).toBe(true);
  });

  test("#8 criollo magic: Valderrama (midfield=95) gets the bonus", () => {
    const ch = getChallengeForNumber(8)!;
    const valderrama = ch.prePlaced.find(s => s.player.id === "co-valderrama")!;
    expect(ch.condition.appliesTo(valderrama.player)).toBe(true);
  });

  test("#8 criollo magic: Falcão (midfield=58) does NOT get the bonus", () => {
    const ch = getChallengeForNumber(8)!;
    const falcao = ch.prePlaced.find(s => s.player.id === "co-falcao")!;
    expect(ch.condition.appliesTo(falcao.player)).toBe(false);
  });
});
