/**
 * Bolado — spoiler-free emoji share text builder (Task 1.6)
 *
 * Format (v1):
 *   ⚽ Bolado #1 🇲🇽×🇿🇦
 *   3×1 · ⭐⭐⭐⭐ · Top 13%
 *   🔥 7 dias seguidos
 *   🟩🟩🟨🟩🟦
 *   bolado.pages.dev
 *
 * Rules:
 *   - Percentile line segment omitted when percentile is null (Phase 2 not live).
 *   - Percentile stored as "better than X%" → displayed as "Top (100-X)%".
 *   - Streak line omitted when streakDays is null or < 2.
 *   - Stars: 0 → "💀" (zoeira-friendly); ≥1 → repeat ⭐.
 *   - URL: host only, no protocol.
 */

import { BOLADO_NAME, BOLADO_SHARE_URL } from "./brand";
import type { PickGradeEntry } from "./types";

// ---------------------------------------------------------------------------
// Public constants
// ---------------------------------------------------------------------------

/** Increment when the share format changes incompatibly. Used as analytics tag. */
export const SHARE_FORMAT_VERSION = "v1";

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

export interface BuildShareTextInput {
  challengeNumber: number;
  /** Flag emoji string as stored in DailyChallenge.flags, e.g. "🇲🇽×🇿🇦" */
  flags: string;
  score: {
    /** User's XI goals */
    user: number;
    /** Benchmark XI goals */
    opp: number;
  };
  /** 0–5 star bucket */
  stars: 0 | 1 | 2 | 3 | 4 | 5;
  /**
   * Percentile stored as "better than X% of players".
   * null when the Phase 2 score service is not live yet.
   * Display = "Top (100-X)%" so 87 → "Top 13%".
   */
  percentile: number | null;
  /**
   * Current streak length in calendar days.
   * Line is omitted when null or < 2.
   */
  streakDays: number | null;
  /** Pick grades in slot order (5 entries). */
  pickGrades: PickGradeEntry[];
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Build a spoiler-free plain-text share card for a completed Bolado puzzle.
 * Pure function; suitable for unit testing.
 */
export function buildShareText(input: BuildShareTextInput): string {
  const { challengeNumber, flags, score, stars, percentile, streakDays, pickGrades } = input;

  // ── Line 1: header
  const header = `⚽ ${BOLADO_NAME} #${challengeNumber} ${flags}`;

  // ── Line 2: score · stars · (optional) percentile
  const scoreStr = `${score.user}×${score.opp}`;
  const starsStr = stars === 0 ? "💀" : "⭐".repeat(stars);
  const percentileStr =
    percentile !== null ? ` · Top ${100 - percentile}%` : "";
  const scoreLine = `${scoreStr} · ${starsStr}${percentileStr}`;

  // ── Line 3 (optional): streak
  const streakLine =
    streakDays !== null && streakDays >= 2
      ? `🔥 ${streakDays} dias seguidos`
      : null;

  // ── Line 4: pick-grade squares in slot order
  const squaresLine = pickGrades.map((g) => g.grade).join("");

  // ── Line 5: URL (host only, no protocol)
  const urlLine = BOLADO_SHARE_URL.replace(/^https?:\/\//, "");

  // ── Assemble
  const lines = [header, scoreLine];
  if (streakLine !== null) lines.push(streakLine);
  lines.push(squaresLine, urlLine);

  return lines.join("\n");
}
