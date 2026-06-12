import { describe, expect, test } from "vitest";
import { createRng } from "../../engine/random";
import type { NationPlayer } from "../../types";
import { nationPools } from "../nations";
import {
  MIN_DISTINCT_POSITIONS,
  OFFER_SIZE,
  POOL_LABELS,
  isRollablePool,
  rollDraftOffer,
} from "./draftClubs";

const SEEDS = Array.from({ length: 200 }, (_, i) => `draft-seed-${i}`);

function offerPositions(players: readonly NationPlayer[]): Set<string> {
  const positions = new Set<string>();
  for (const player of players) for (const pos of player.positions) positions.add(pos);
  return positions;
}

function makePlayer(id: string, positions: string[]): NationPlayer {
  return {
    id,
    displayName: id,
    nation: "Testland",
    positions,
    eraBand: "90s-00s",
    attack: 70,
    midfield: 70,
    defense: 70,
    costTier: 2,
    bioHook: "test",
  };
}

describe("rollDraftOffer over the real nation pools", () => {
  test("every offer has exactly 5 players with no duplicates", () => {
    for (const seed of SEEDS) {
      const offer = rollDraftOffer(nationPools, createRng(seed));
      expect(offer.players).toHaveLength(OFFER_SIZE);
      const ids = offer.players.map((p) => p.id);
      expect(new Set(ids).size, `${seed} rolled duplicate players`).toBe(OFFER_SIZE);
    }
  });

  test("every offer covers at least 3 distinct positions", () => {
    for (const seed of SEEDS) {
      const offer = rollDraftOffer(nationPools, createRng(seed));
      expect(
        offerPositions(offer.players).size,
        `${seed} offer covers too few positions`,
      ).toBeGreaterThanOrEqual(MIN_DISTINCT_POSITIONS);
    }
  });

  test("all 5 players come from the single rolled pool, and label matches it", () => {
    const membership = new Map<string, string>();
    for (const [key, pool] of Object.entries(nationPools)) {
      for (const player of pool) membership.set(player.id, key);
    }
    for (const seed of SEEDS) {
      const offer = rollDraftOffer(nationPools, createRng(seed));
      const poolKeys = new Set(offer.players.map((p) => membership.get(p.id)));
      expect(poolKeys.size, `${seed} mixed players across pools`).toBe(1);
      const [poolKey] = poolKeys;
      expect(poolKey, `${seed} rolled players outside the pools`).toBeDefined();
      expect(offer.label).toBe(POOL_LABELS[poolKey!] ?? poolKey);
      expect(offer.label.trim().length).toBeGreaterThan(0);
    }
  });

  test("is deterministic: same seed → identical offer", () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const a = rollDraftOffer(nationPools, createRng(seed));
      const b = rollDraftOffer(nationPools, createRng(seed));
      expect(a.label).toBe(b.label);
      expect(a.players.map((p) => p.id)).toEqual(b.players.map((p) => p.id));
    }
  });

  test("diverges across seeds", () => {
    const signatures = new Set(
      SEEDS.slice(0, 30).map((seed) => {
        const offer = rollDraftOffer(nationPools, createRng(seed));
        return `${offer.label}|${offer.players.map((p) => p.id).join(",")}`;
      }),
    );
    expect(signatures.size).toBeGreaterThan(1);
  });

  test("does not depend on pool key insertion order", () => {
    const reversed = Object.fromEntries(Object.entries(nationPools).reverse());
    for (const seed of SEEDS.slice(0, 20)) {
      const a = rollDraftOffer(nationPools, createRng(seed));
      const b = rollDraftOffer(reversed, createRng(seed));
      expect(a.label).toBe(b.label);
      expect(a.players.map((p) => p.id)).toEqual(b.players.map((p) => p.id));
    }
  });

  test("is pure: never mutates the pools it receives", () => {
    const before = JSON.stringify(nationPools);
    for (const seed of SEEDS.slice(0, 20)) rollDraftOffer(nationPools, createRng(seed));
    expect(JSON.stringify(nationPools)).toBe(before);
  });

  test("every nation pool in the repo is rollable", () => {
    for (const [key, pool] of Object.entries(nationPools)) {
      expect(isRollablePool(pool), `${key} pool cannot fill an offer`).toBe(true);
    }
  });
});

describe("rollDraftOffer edge cases", () => {
  test("throws when no pool can satisfy the offer", () => {
    expect(() => rollDraftOffer({}, createRng("x"))).toThrow();
    const tiny = { small: [makePlayer("t-a", ["GOL"]), makePlayer("t-b", ["ZAG"])] };
    expect(() => rollDraftOffer(tiny, createRng("x"))).toThrow();
    const monoPosition = {
      mono: ["a", "b", "c", "d", "e", "f"].map((n) => makePlayer(`t-${n}`, ["CA"])),
    };
    expect(() => rollDraftOffer(monoPosition, createRng("x"))).toThrow();
  });

  test("skips ineligible pools but still rolls from eligible ones", () => {
    const eligible = [
      makePlayer("e-gk", ["GOL"]),
      makePlayer("e-zag", ["ZAG"]),
      makePlayer("e-mei", ["MEI"]),
      makePlayer("e-ca1", ["CA"]),
      makePlayer("e-ca2", ["CA"]),
    ];
    const pools = {
      tooSmall: [makePlayer("s-a", ["GOL"])],
      ok: eligible,
    };
    for (const seed of SEEDS.slice(0, 10)) {
      const offer = rollDraftOffer(pools, createRng(seed));
      expect(offer.label).toBe("ok");
      expect(offer.players.map((p) => p.id).sort()).toEqual(["e-ca1", "e-ca2", "e-gk", "e-mei", "e-zag"]);
    }
  });

  test("still reaches 3 positions when the pool is position-heavy on one role", () => {
    // 6 strikers + 1 GK + 1 ZAG: a naive draw can roll 5 CAs; the offer must not.
    const skewed = {
      skew: [
        ...["a", "b", "c", "d", "e", "f"].map((n) => makePlayer(`k-ca-${n}`, ["CA"])),
        makePlayer("k-gk", ["GOL"]),
        makePlayer("k-zag", ["ZAG"]),
      ],
    };
    for (const seed of SEEDS) {
      const offer = rollDraftOffer(skewed, createRng(seed));
      expect(offer.players).toHaveLength(OFFER_SIZE);
      expect(offerPositions(offer.players).size).toBeGreaterThanOrEqual(MIN_DISTINCT_POSITIONS);
    }
  });
});
