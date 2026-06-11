import { describe, expect, test } from "vitest";
import { getBrazilDateId } from "./brazilDate";

describe("getBrazilDateId", () => {
  test("uses the Brazil calendar date instead of the local machine date", () => {
    expect(getBrazilDateId(new Date("2026-06-08T02:30:00.000Z"))).toBe("2026-06-07");
    expect(getBrazilDateId(new Date("2026-06-08T03:30:00.000Z"))).toBe("2026-06-08");
  });
});
