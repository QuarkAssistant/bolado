import { describe, expect, test } from "vitest";
import type { NationPlayer } from "../../types";
import { nationPools, allNationPlayers } from "./index";

const VALID_POSITIONS = new Set(["GOL", "LD", "LE", "ZAG", "VOL", "MEI", "MD", "ME", "PD", "PE", "CA"]);
const VALID_ERA_BANDS = new Set(["50s-60s", "70s-80s", "90s-00s", "00s-10s", "10s-20s"]);
const DEEP_POOL_NATIONS = new Set(["Brazil", "Argentina", "Mexico", "USA", "Spain", "France", "Netherlands", "Colombia"]);
const LIGHT_POOL_NATIONS = new Set(["Morocco", "Japan", "Senegal", "Canada", "South Africa"]);
const GOALKEEPER_POSITION = "GOL";
const DEFENDER_POSITIONS = new Set(["LD", "LE", "ZAG"]);

describe("nation player pools", () => {
  test("all player ids are unique across all pools", () => {
    const ids = allNationPlayers.map((p) => p.id);
    const uniqueIds = new Set(ids);
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(duplicates, `Duplicate ids: ${duplicates.join(", ")}`).toHaveLength(0);
    expect(uniqueIds.size).toBe(ids.length);
  });

  test("every player has at least one valid position", () => {
    for (const player of allNationPlayers) {
      expect(player.positions.length, `${player.id} has no positions`).toBeGreaterThan(0);
      for (const pos of player.positions) {
        expect(VALID_POSITIONS.has(pos), `${player.id} has invalid position "${pos}"`).toBe(true);
      }
    }
  });

  test("all ratings are in range 1-99", () => {
    for (const player of allNationPlayers) {
      expect(player.attack, `${player.id}.attack out of range`).toBeGreaterThanOrEqual(1);
      expect(player.attack, `${player.id}.attack out of range`).toBeLessThanOrEqual(99);
      expect(player.midfield, `${player.id}.midfield out of range`).toBeGreaterThanOrEqual(1);
      expect(player.midfield, `${player.id}.midfield out of range`).toBeLessThanOrEqual(99);
      expect(player.defense, `${player.id}.defense out of range`).toBeGreaterThanOrEqual(1);
      expect(player.defense, `${player.id}.defense out of range`).toBeLessThanOrEqual(99);
    }
  });

  test("costTier is 1-5 for every player", () => {
    for (const player of allNationPlayers) {
      expect([1, 2, 3, 4, 5], `${player.id}.costTier invalid`).toContain(player.costTier);
    }
  });

  test("eraBand is a valid value for every player", () => {
    for (const player of allNationPlayers) {
      expect(VALID_ERA_BANDS.has(player.eraBand), `${player.id} has invalid eraBand "${player.eraBand}"`).toBe(true);
    }
  });

  test("bioHook is non-empty for every player", () => {
    for (const player of allNationPlayers) {
      expect(player.bioHook, `${player.id} has empty bioHook`).toBeTruthy();
      expect(player.bioHook.trim().length, `${player.id} bioHook is blank`).toBeGreaterThan(0);
    }
  });

  test("nation field is non-empty for every player", () => {
    for (const player of allNationPlayers) {
      expect(player.nation, `${player.id} has empty nation`).toBeTruthy();
    }
  });

  test("deep pools each have at least 18 players", () => {
    for (const nation of DEEP_POOL_NATIONS) {
      const pool = nationPools[nation];
      expect(pool, `${nation} pool missing`).toBeDefined();
      expect(pool!.length, `${nation} pool too small`).toBeGreaterThanOrEqual(18);
    }
  });

  test("light pools each have at least 10 players", () => {
    for (const nation of LIGHT_POOL_NATIONS) {
      const pool = nationPools[nation];
      expect(pool, `${nation} pool missing`).toBeDefined();
      expect(pool!.length, `${nation} pool too small`).toBeGreaterThanOrEqual(10);
    }
  });

  test("wildcards pool has at least 25 players", () => {
    expect(nationPools.wildcards).toBeDefined();
    expect(nationPools.wildcards!.length).toBeGreaterThanOrEqual(25);
  });

  test("deep pools have tier spread: at least 4 players at tier 1-2, at most 4 at tier 5", () => {
    for (const nation of DEEP_POOL_NATIONS) {
      const pool = nationPools[nation]!;
      const lowTierCount = pool.filter((p) => p.costTier <= 2).length;
      const tier5Count = pool.filter((p) => p.costTier === 5).length;
      expect(lowTierCount, `${nation} has fewer than 4 tier 1-2 players (${lowTierCount})`).toBeGreaterThanOrEqual(4);
      expect(tier5Count, `${nation} has more than 4 tier 5 players (${tier5Count})`).toBeLessThanOrEqual(4);
    }
  });

  test("every pool has at least one goalkeeper", () => {
    for (const [nation, pool] of Object.entries(nationPools)) {
      if (nation === "wildcards") continue; // wildcards is supplemental, not a standalone team
      const hasGK = pool.some((p) => p.positions.includes(GOALKEEPER_POSITION));
      expect(hasGK, `${nation} pool has no goalkeeper`).toBe(true);
    }
    // Wildcards should also have at least one GK
    const wildcardsHasGK = nationPools.wildcards!.some((p) => p.positions.includes(GOALKEEPER_POSITION));
    expect(wildcardsHasGK, "wildcards pool has no goalkeeper").toBe(true);
  });

  test("every nation pool has at least 2 defenders", () => {
    for (const [nation, pool] of Object.entries(nationPools)) {
      if (nation === "wildcards") continue;
      const defCount = pool.filter((p) => p.positions.some((pos) => DEFENDER_POSITIONS.has(pos))).length;
      expect(defCount, `${nation} pool has fewer than 2 defenders (${defCount})`).toBeGreaterThanOrEqual(2);
    }
  });

  test("players in deep pools have nation field matching their pool nation", () => {
    for (const nation of DEEP_POOL_NATIONS) {
      const pool = nationPools[nation]!;
      for (const player of pool) {
        expect(player.nation, `${player.id} has nation mismatch (expected ${nation})`).toBe(nation);
      }
    }
  });

  test("allNationPlayers includes all players from all pools", () => {
    const totalFromPools = Object.values(nationPools).reduce((sum, pool) => sum + pool.length, 0);
    expect(allNationPlayers.length).toBe(totalFromPools);
  });

  test("total player count is at least 200", () => {
    expect(allNationPlayers.length).toBeGreaterThanOrEqual(200);
  });

  test("player ids follow kebab-case prefix convention", () => {
    const prefixRe = /^[a-z]{2,3}-[a-z0-9-]+$/;
    for (const player of allNationPlayers) {
      expect(prefixRe.test(player.id), `${player.id} does not follow kebab-case with prefix`).toBe(true);
    }
  });
});
