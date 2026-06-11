/**
 * Deterministic daily challenge number for Bolado.
 *
 * Challenge #1 = 2026-06-11 (São Paulo / America/Sao_Paulo timezone).
 * Each calendar day in SP time increments the number by 1.
 *
 * Reuses getBrazilDateId from the existing game's daily-challenge module —
 * that function already handles the SP-timezone boundary correctly.
 */

import { getBrazilDateId } from "./engine/brazilDate";

/** ISO date string for challenge #1 (São Paulo time). */
const EPOCH_DATE = "2026-06-11";

/**
 * Returns the number of milliseconds between two ISO date strings
 * (YYYY-MM-DD) treated as UTC noon to avoid DST edge ambiguities.
 * We only care about whole-day differences so UTC noon is safe.
 */
function daysBetween(isoA: string, isoB: string): number {
  const msA = Date.UTC(
    parseInt(isoA.slice(0, 4)),
    parseInt(isoA.slice(5, 7)) - 1,
    parseInt(isoA.slice(8, 10)),
    12,
  );
  const msB = Date.UTC(
    parseInt(isoB.slice(0, 4)),
    parseInt(isoB.slice(5, 7)) - 1,
    parseInt(isoB.slice(8, 10)),
    12,
  );
  return Math.round((msB - msA) / 86_400_000);
}

/**
 * Returns the challenge number for the given Date, resolved in São Paulo time.
 * Returns 1 for 2026-06-11, 2 for 2026-06-12, etc.
 * Returns values < 1 for dates before the epoch (pre-launch).
 */
export function challengeNumberForDate(date: Date = new Date()): number {
  const dateId = getBrazilDateId(date);
  return daysBetween(EPOCH_DATE, dateId) + 1;
}

/**
 * Returns the challenge number for today (São Paulo time).
 */
export function todayChallengeNumber(): number {
  return challengeNumberForDate(new Date());
}
