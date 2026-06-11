/**
 * TDD tests for buildShareText (src/daily/shareDaily.ts)
 *
 * Covers:
 *   - Exact-string snapshots: full / no-percentile / no-streak / zero-star variants
 *   - Percentile math: store "better than X%" → display "Top (100-X)%"
 *   - Grade order preserved in squares line
 *   - SHARE_FORMAT_VERSION export
 *   - URL line uses host only (no protocol)
 */

import { describe, expect, test } from "vitest";
import { buildShareText, SHARE_FORMAT_VERSION } from "./shareDaily";
import type { PickGradeEntry } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIVE_GRADES: PickGradeEntry[] = [
  { slotId: "s1", playerId: "p1", grade: "🟩" },
  { slotId: "s2", playerId: "p2", grade: "🟩" },
  { slotId: "s3", playerId: "p3", grade: "🟨" },
  { slotId: "s4", playerId: "p4", grade: "🟩" },
  { slotId: "s5", playerId: "p5", grade: "🟦" },
];

// ---------------------------------------------------------------------------
// Snapshot: full variant (percentile + streak)
// ---------------------------------------------------------------------------

describe("buildShareText: full variant", () => {
  test("exact output with percentile and streak", () => {
    const text = buildShareText({
      challengeNumber: 1,
      flags: "🇲🇽×🇿🇦",
      score: { user: 3, opp: 1 },
      stars: 4,
      percentile: 87, // "better than 87%" → Top 13%
      streakDays: 7,
      pickGrades: FIVE_GRADES,
    });

    expect(text).toBe(
      "⚽ Bolado #1 🇲🇽×🇿🇦\n" +
      "3×1 · ⭐⭐⭐⭐ · Top 13%\n" +
      "🔥 7 dias seguidos\n" +
      "🟩🟩🟨🟩🟦\n" +
      "bolado.pages.dev",
    );
  });
});

// ---------------------------------------------------------------------------
// Snapshot: no-percentile variant (Phase 2 not live)
// ---------------------------------------------------------------------------

describe("buildShareText: no-percentile variant", () => {
  test("omits '· Top X%' when percentile is null", () => {
    const text = buildShareText({
      challengeNumber: 1,
      flags: "🇲🇽×🇿🇦",
      score: { user: 3, opp: 1 },
      stars: 4,
      percentile: null,
      streakDays: 7,
      pickGrades: FIVE_GRADES,
    });

    expect(text).toBe(
      "⚽ Bolado #1 🇲🇽×🇿🇦\n" +
      "3×1 · ⭐⭐⭐⭐\n" +
      "🔥 7 dias seguidos\n" +
      "🟩🟩🟨🟩🟦\n" +
      "bolado.pages.dev",
    );
  });
});

// ---------------------------------------------------------------------------
// Snapshot: no-streak variant (streakDays null or < 2)
// ---------------------------------------------------------------------------

describe("buildShareText: no-streak variant", () => {
  test("omits streak line when streakDays is null", () => {
    const text = buildShareText({
      challengeNumber: 2,
      flags: "🇧🇷×🇦🇷",
      score: { user: 2, opp: 2 },
      stars: 3,
      percentile: 60, // → Top 40%
      streakDays: null,
      pickGrades: FIVE_GRADES,
    });

    expect(text).toBe(
      "⚽ Bolado #2 🇧🇷×🇦🇷\n" +
      "2×2 · ⭐⭐⭐ · Top 40%\n" +
      "🟩🟩🟨🟩🟦\n" +
      "bolado.pages.dev",
    );
  });

  test("omits streak line when streakDays is 1 (not a streak yet)", () => {
    const text = buildShareText({
      challengeNumber: 2,
      flags: "🇧🇷×🇦🇷",
      score: { user: 0, opp: 3 },
      stars: 1,
      percentile: null,
      streakDays: 1,
      pickGrades: FIVE_GRADES,
    });

    expect(text).toBe(
      "⚽ Bolado #2 🇧🇷×🇦🇷\n" +
      "0×3 · ⭐\n" +
      "🟩🟩🟨🟩🟦\n" +
      "bolado.pages.dev",
    );
  });

  test("includes streak line when streakDays is 2", () => {
    const text = buildShareText({
      challengeNumber: 2,
      flags: "🇧🇷×🇦🇷",
      score: { user: 1, opp: 0 },
      stars: 2,
      percentile: null,
      streakDays: 2,
      pickGrades: FIVE_GRADES,
    });

    expect(text).toContain("🔥 2 dias seguidos");
  });
});

// ---------------------------------------------------------------------------
// Snapshot: zero-star variant
// ---------------------------------------------------------------------------

describe("buildShareText: zero-star variant", () => {
  test("shows '💀' for 0 stars (zoeira-friendly)", () => {
    const text = buildShareText({
      challengeNumber: 3,
      flags: "🇺🇸×🇲🇽",
      score: { user: 0, opp: 5 },
      stars: 0,
      percentile: null,
      streakDays: null,
      pickGrades: [
        { slotId: "s1", playerId: "p1", grade: "🟥" },
        { slotId: "s2", playerId: "p2", grade: "🟥" },
        { slotId: "s3", playerId: "p3", grade: "🟥" },
        { slotId: "s4", playerId: "p4", grade: "🟥" },
        { slotId: "s5", playerId: "p5", grade: "🟥" },
      ],
    });

    expect(text).toBe(
      "⚽ Bolado #3 🇺🇸×🇲🇽\n" +
      "0×5 · 💀\n" +
      "🟥🟥🟥🟥🟥\n" +
      "bolado.pages.dev",
    );
  });
});

// ---------------------------------------------------------------------------
// Percentile math
// ---------------------------------------------------------------------------

describe("buildShareText: percentile math", () => {
  test("87th percentile → 'Top 13%'", () => {
    const text = buildShareText({
      challengeNumber: 1,
      flags: "🇲🇽×🇿🇦",
      score: { user: 3, opp: 1 },
      stars: 4,
      percentile: 87,
      streakDays: null,
      pickGrades: FIVE_GRADES,
    });

    expect(text).toContain("Top 13%");
  });

  test("50th percentile → 'Top 50%'", () => {
    const text = buildShareText({
      challengeNumber: 1,
      flags: "🇲🇽×🇿🇦",
      score: { user: 2, opp: 1 },
      stars: 3,
      percentile: 50,
      streakDays: null,
      pickGrades: FIVE_GRADES,
    });

    expect(text).toContain("Top 50%");
  });

  test("0th percentile → 'Top 100%'", () => {
    const text = buildShareText({
      challengeNumber: 1,
      flags: "🇲🇽×🇿🇦",
      score: { user: 0, opp: 2 },
      stars: 1,
      percentile: 0,
      streakDays: null,
      pickGrades: FIVE_GRADES,
    });

    expect(text).toContain("Top 100%");
  });

  test("99th percentile → 'Top 1%'", () => {
    const text = buildShareText({
      challengeNumber: 1,
      flags: "🇲🇽×🇿🇦",
      score: { user: 4, opp: 0 },
      stars: 5,
      percentile: 99,
      streakDays: null,
      pickGrades: FIVE_GRADES,
    });

    expect(text).toContain("Top 1%");
  });
});

// ---------------------------------------------------------------------------
// Grade order preserved
// ---------------------------------------------------------------------------

describe("buildShareText: grade order", () => {
  test("squares appear in slot order (as passed)", () => {
    const grades: PickGradeEntry[] = [
      { slotId: "s1", playerId: "p1", grade: "🟥" },
      { slotId: "s2", playerId: "p2", grade: "🟦" },
      { slotId: "s3", playerId: "p3", grade: "🟩" },
      { slotId: "s4", playerId: "p4", grade: "🟨" },
      { slotId: "s5", playerId: "p5", grade: "🟥" },
    ];

    const text = buildShareText({
      challengeNumber: 5,
      flags: "🇦🇷×🇺🇾",
      score: { user: 1, opp: 1 },
      stars: 2,
      percentile: null,
      streakDays: null,
      pickGrades: grades,
    });

    // Find the squares line (line index 2 — no percentile, no streak)
    const lines = text.split("\n");
    // Line 0: header, Line 1: score, Line 2: squares, Line 3: URL
    expect(lines[2]).toBe("🟥🟦🟩🟨🟥");
  });
});

// ---------------------------------------------------------------------------
// URL line: host without protocol
// ---------------------------------------------------------------------------

describe("buildShareText: URL line", () => {
  test("last line is 'bolado.pages.dev' (no https://)", () => {
    const text = buildShareText({
      challengeNumber: 1,
      flags: "🇲🇽×🇿🇦",
      score: { user: 2, opp: 0 },
      stars: 3,
      percentile: null,
      streakDays: null,
      pickGrades: FIVE_GRADES,
    });

    const lines = text.split("\n");
    expect(lines[lines.length - 1]).toBe("bolado.pages.dev");
  });
});

// ---------------------------------------------------------------------------
// SHARE_FORMAT_VERSION constant
// ---------------------------------------------------------------------------

describe("SHARE_FORMAT_VERSION", () => {
  test("is 'v1'", () => {
    expect(SHARE_FORMAT_VERSION).toBe("v1");
  });
});

// ---------------------------------------------------------------------------
// Stars: 1..5 stars → correct count of ⭐
// ---------------------------------------------------------------------------

describe("buildShareText: star emoji count", () => {
  for (const stars of [1, 2, 3, 4, 5] as const) {
    test(`stars=${stars} → ${stars} ⭐ chars`, () => {
      const text = buildShareText({
        challengeNumber: 1,
        flags: "🇲🇽×🇿🇦",
        score: { user: 2, opp: 1 },
        stars,
        percentile: null,
        streakDays: null,
        pickGrades: FIVE_GRADES,
      });

      const scoreLine = text.split("\n")[1]!;
      // Count ⭐ occurrences
      const starCount = [...scoreLine].filter((ch) => ch === "⭐").length;
      expect(starCount).toBe(stars);
    });
  }
});
