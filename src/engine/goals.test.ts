import { describe, expect, it } from "vitest";
import { goalsFromExpected } from "./goals";

describe("goalsFromExpected bounds", () => {
  it("returns an integer in [0, 7] for all expected and roll combinations", () => {
    const expectedValues = [0, 0.5, 1.5, 3, 10];
    const rollValues = [0, 0.25, 0.5, 0.75, 0.999999];
    for (const expected of expectedValues) {
      for (const roll of rollValues) {
        const goals = goalsFromExpected(expected, roll);
        expect(Number.isInteger(goals), `expected=${expected} roll=${roll}`).toBe(true);
        expect(goals, `expected=${expected} roll=${roll}`).toBeGreaterThanOrEqual(0);
        expect(goals, `expected=${expected} roll=${roll}`).toBeLessThanOrEqual(7);
      }
    }
  });
});
