import { describe, expect, it } from "vitest";
import { generateJourneymen, isJourneyman, JOURNEYMAN_NAMES } from "./journeymen";
import { FORMATIONS, type FormationId } from "./types";

const ALL_NAMES = new Set(Object.values(JOURNEYMAN_NAMES).flat());

describe("journeymen name pools", () => {
  it("has 8 names per position pool", () => {
    for (const [pool, names] of Object.entries(JOURNEYMAN_NAMES)) {
      expect(names, pool).toHaveLength(8);
    }
  });

  it("has no duplicate names across pools", () => {
    const flat = Object.values(JOURNEYMAN_NAMES).flat();
    expect(new Set(flat).size).toBe(flat.length);
  });
});

describe("generateJourneymen", () => {
  const formations = Object.keys(FORMATIONS) as FormationId[];

  it("fills all 11 slots of every formation", () => {
    for (const formation of formations) {
      const squad = generateJourneymen("seed-a", formation);
      expect(squad.size).toBe(11);
      for (const slot of FORMATIONS[formation]) {
        expect(squad.has(slot.slotId), `${formation}/${slot.slotId}`).toBe(true);
      }
    }
  });

  it("assigns each journeyman the slot position they occupy", () => {
    const squad = generateJourneymen("seed-a", "4-3-3");
    for (const slot of FORMATIONS["4-3-3"]) {
      expect(squad.get(slot.slotId)!.positions).toEqual([slot.position]);
    }
  });

  it("is deterministic: same seed + formation → identical XI", () => {
    const a = generateJourneymen("seed-x", "4-4-2");
    const b = generateJourneymen("seed-x", "4-4-2");
    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  it("diverges across seeds", () => {
    const a = generateJourneymen("seed-x", "4-3-3");
    const b = generateJourneymen("seed-y", "4-3-3");
    const namesA = [...a.values()].map((p) => p.displayName).join("|");
    const namesB = [...b.values()].map((p) => p.displayName).join("|");
    expect(namesA).not.toBe(namesB);
  });

  it("never fields the same name twice in one XI", () => {
    for (let i = 0; i < 25; i += 1) {
      const squad = generateJourneymen(`seed-${i}`, "3-5-2");
      const names = [...squad.values()].map((p) => p.displayName);
      expect(new Set(names).size).toBe(11);
    }
  });

  it("draws every name from the curated pools", () => {
    const squad = generateJourneymen("seed-a", "4-3-3");
    for (const player of squad.values()) {
      expect(ALL_NAMES.has(player.displayName)).toBe(true);
    }
  });

  it("keeps ratings low: primary stat 60-66, costTier 1", () => {
    const squad = generateJourneymen("seed-low", "4-3-3");
    for (const player of squad.values()) {
      const primary = Math.max(player.attack, player.midfield, player.defense);
      expect(primary).toBeGreaterThanOrEqual(60);
      expect(primary).toBeLessThanOrEqual(66);
      expect(player.costTier).toBe(1);
    }
  });

  it("marks generated players as journeymen via id prefix", () => {
    const squad = generateJourneymen("seed-a", "4-3-3");
    for (const player of squad.values()) {
      expect(isJourneyman(player.id)).toBe(true);
    }
    expect(isJourneyman("br-pele")).toBe(false);
  });
});
