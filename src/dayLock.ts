/**
 * Bolado day lock — localStorage persistence for completed daily challenges.
 *
 * Storage keys:
 *   bolado.day.<challengeId>  → DayRecord (picks + verdict + completedAt)
 *   bolado.history            → compact array of completed challenge IDs
 *
 * Design principles:
 *   - Storage failures degrade gracefully (game still playable, just no lock)
 *   - Never throws — all errors are caught and treated as "no saved state"
 *   - Pure functions for read/write; side-effect via save/load at call sites
 */

import type { PickedSlot } from "./types";
import type { DailyVerdict, DailyMatchResult } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DayRecord {
  /** Challenge ID this record belongs to. */
  challengeId: number;
  /** The 5 picked slots (slotId + player id+displayName+etc). */
  picks: PickedSlot[];
  /** Verdict from scorePerformance. */
  verdict: DailyVerdict;
  /** Match result (to replay the broadcast). */
  matchResult: DailyMatchResult;
  /** ISO timestamp when the player completed the challenge. */
  completedAt: string;
}

// ---------------------------------------------------------------------------
// Storage key helpers
// ---------------------------------------------------------------------------

function dayKey(challengeId: number): string {
  return `bolado.day.${challengeId}`;
}

const HISTORY_KEY = "bolado.history";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Attempt to load a completed day record for the given challenge.
 * Returns null if not found, invalid JSON, or any storage error.
 */
export function loadDayRecord(challengeId: number): DayRecord | null {
  try {
    const raw = localStorage.getItem(dayKey(challengeId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    // Minimal type guard
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "challengeId" in parsed &&
      "picks" in parsed &&
      "verdict" in parsed &&
      "matchResult" in parsed &&
      "completedAt" in parsed
    ) {
      return parsed as DayRecord;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Persist a completed day record.
 * Silently swallows any storage error (e.g. private browsing quota).
 */
export function saveDayRecord(record: DayRecord): void {
  try {
    localStorage.setItem(dayKey(record.challengeId), JSON.stringify(record));
    appendHistory(record.challengeId);
  } catch {
    // Degrade gracefully
  }
}

/**
 * Returns true if the given challenge has already been completed today.
 */
export function isChallengeCompleted(challengeId: number): boolean {
  return loadDayRecord(challengeId) !== null;
}

/**
 * Build a DayRecord from the game result data. Call before saveDayRecord.
 */
export function buildDayRecord(
  challengeId: number,
  picks: PickedSlot[],
  verdict: DailyVerdict,
  matchResult: DailyMatchResult,
): DayRecord {
  return {
    challengeId,
    picks,
    verdict,
    matchResult,
    completedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// History list (compact, for future streak feature)
// ---------------------------------------------------------------------------

/**
 * Returns the list of completed challenge IDs, most-recent first.
 * Returns empty array on any error.
 */
export function loadHistory(): number[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is number => typeof x === "number");
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Add a challenge ID to the history list (deduplicated, most-recent first).
 * Silently swallows errors.
 */
function appendHistory(challengeId: number): void {
  try {
    const existing = loadHistory().filter((id) => id !== challengeId);
    const updated = [challengeId, ...existing];
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // Degrade gracefully
  }
}

/**
 * Clear all Bolado storage. Useful for testing resets.
 * Silently swallows errors.
 */
export function clearAllStorage(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("bolado.")) keysToRemove.push(key);
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    // Degrade gracefully
  }
}
