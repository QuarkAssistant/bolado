import { describe, expect, test } from "vitest";
import { nationPools } from "../nations";
import {
  RATING_BANDS,
  findLibertadoresOpponent,
  libertadoresOpponents,
  opponentsByTier,
  toOpponentDef,
  type LibertadoresTier,
} from "./opponents";

const TIERS: LibertadoresTier[] = ["group", "mata", "boss"];
// Country flags are exactly one emoji: a pair of regional indicator symbols.
const FLAG_RE = /^[\u{1F1E6}-\u{1F1FF}]{2}$/u;
const ERA_RE = /^\d{4}(-\d{4})?$/;
const NAME_RE = /^.+ \d{4}/;
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Highland fortresses (La Paz, Quito) that must carry the altitude flag.
const ALTITUDE_IDS = ["ldu-quito-2008", "bolivar-2014", "the-strongest-2017"];

describe("libertadores opponents", () => {
  test("all opponent ids are unique", () => {
    const ids = libertadoresOpponents.map((o) => o.id);
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(duplicates, `Duplicate ids: ${duplicates.join(", ")}`).toHaveLength(0);
  });

  test("ids follow kebab-case convention", () => {
    for (const opponent of libertadoresOpponents) {
      expect(ID_RE.test(opponent.id), `${opponent.id} is not kebab-case`).toBe(true);
    }
  });

  test("names follow the 'Club YYYY' convention", () => {
    for (const opponent of libertadoresOpponents) {
      expect(NAME_RE.test(opponent.name), `${opponent.name} lacks a year`).toBe(true);
    }
  });

  test("country is a single flag emoji", () => {
    for (const opponent of libertadoresOpponents) {
      expect(FLAG_RE.test(opponent.country), `${opponent.id} country "${opponent.country}" is not a flag`).toBe(true);
    }
  });

  test("era is a year or year span and non-empty", () => {
    for (const opponent of libertadoresOpponents) {
      expect(ERA_RE.test(opponent.era), `${opponent.id} era "${opponent.era}" malformed`).toBe(true);
    }
  });

  test("flavor is a non-blank pt-BR line", () => {
    for (const opponent of libertadoresOpponents) {
      expect(opponent.flavor.trim().length, `${opponent.id} flavor blank`).toBeGreaterThan(0);
    }
  });

  test("ratings sit inside their tier band", () => {
    for (const opponent of libertadoresOpponents) {
      const band = RATING_BANDS[opponent.tier];
      expect(opponent.rating, `${opponent.id} rating below ${opponent.tier} band`).toBeGreaterThanOrEqual(band.min);
      expect(opponent.rating, `${opponent.id} rating above ${opponent.tier} band`).toBeLessThanOrEqual(band.max);
    }
  });

  test("pool sizes meet the run-curve minimums (≥10 group, ≥6 mata, ≥6 boss, ≥28 total)", () => {
    expect(opponentsByTier("group").length).toBeGreaterThanOrEqual(10);
    expect(opponentsByTier("mata").length).toBeGreaterThanOrEqual(6);
    expect(opponentsByTier("boss").length).toBeGreaterThanOrEqual(6);
    expect(libertadoresOpponents.length).toBeGreaterThanOrEqual(28);
  });

  test("every opponent belongs to a known tier", () => {
    for (const opponent of libertadoresOpponents) {
      expect(TIERS, `${opponent.id} has unknown tier`).toContain(opponent.tier);
    }
  });

  test("known highland sides carry the altitude flag", () => {
    for (const id of ALTITUDE_IDS) {
      const opponent = findLibertadoresOpponent(id);
      expect(opponent, `${id} missing from pool`).toBeDefined();
      expect(opponent!.altitude, `${id} should be flagged altitude`).toBe(true);
    }
  });

  test("every Bolivian side is an altitude fortress", () => {
    for (const opponent of libertadoresOpponents) {
      if (opponent.country === "🇧🇴") {
        expect(opponent.altitude, `${opponent.id} (La Paz) must flag altitude`).toBe(true);
      }
    }
  });

  test("nationTag, when present, names an existing nation pool", () => {
    for (const opponent of libertadoresOpponents) {
      if (opponent.nationTag === undefined) continue;
      expect(nationPools[opponent.nationTag], `${opponent.id} nationTag "${opponent.nationTag}" has no pool`).toBeDefined();
    }
  });

  test("opponentsByTier partitions the full pool", () => {
    const total = TIERS.reduce((sum, tier) => sum + opponentsByTier(tier).length, 0);
    expect(total).toBe(libertadoresOpponents.length);
  });

  test("findLibertadoresOpponent resolves ids and rejects unknowns", () => {
    expect(findLibertadoresOpponent("santos-1962")?.name).toBe("Santos 1962-63");
    expect(findLibertadoresOpponent("clube-inventado")).toBeUndefined();
  });

  test("toOpponentDef maps to the playRunMatch shape (nation tag, not emoji)", () => {
    for (const opponent of libertadoresOpponents) {
      const def = toOpponentDef(opponent);
      expect(def.name).toBe(opponent.name);
      expect(def.rating).toBe(opponent.rating);
      expect(def.flavor).toBe(opponent.flavor);
      expect(def.altitude).toBe(opponent.altitude ? true : undefined);
      expect(def.country, `${opponent.id} OpponentDef.country must never be an emoji`).toBe(opponent.nationTag);
    }
  });
});
