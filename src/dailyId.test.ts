import { describe, expect, test } from "vitest";
import { challengeNumberForDate } from "./dailyId";

describe("Bolado daily challenge identity", () => {
  test("challenge #1 on 2026-06-11 (São Paulo time)", () => {
    // 15:00 UTC on June 11 = 12:00 SP time (UTC-3)
    expect(challengeNumberForDate(new Date("2026-06-11T15:00:00.000Z"))).toBe(1);
  });

  test("challenge #2 on 2026-06-12 (São Paulo time)", () => {
    expect(challengeNumberForDate(new Date("2026-06-12T15:00:00.000Z"))).toBe(2);
  });

  test("challenge #7 on 2026-06-17 (São Paulo time)", () => {
    expect(challengeNumberForDate(new Date("2026-06-17T15:00:00.000Z"))).toBe(7);
  });

  test("SP-midnight rollover: 23:59 SP on June 11 is still #1", () => {
    // 23:59 SP = 02:59 UTC on June 12
    expect(challengeNumberForDate(new Date("2026-06-12T02:59:00.000Z"))).toBe(1);
  });

  test("SP-midnight rollover: 00:01 SP on June 12 is already #2", () => {
    // 00:01 SP = 03:01 UTC on June 12
    expect(challengeNumberForDate(new Date("2026-06-12T03:01:00.000Z"))).toBe(2);
  });

  test("same UTC date but different SP date: early UTC June 12 is still SP June 11 (#1)", () => {
    // 01:00 UTC June 12 = 22:00 SP June 11 → still #1
    expect(challengeNumberForDate(new Date("2026-06-12T01:00:00.000Z"))).toBe(1);
  });

  test("stable across two calls with the same input", () => {
    const d = new Date("2026-06-15T18:00:00.000Z");
    expect(challengeNumberForDate(d)).toBe(challengeNumberForDate(d));
  });

  test("returns a value < 1 for a date before the epoch", () => {
    expect(challengeNumberForDate(new Date("2026-06-10T15:00:00.000Z"))).toBe(0);
  });
});
