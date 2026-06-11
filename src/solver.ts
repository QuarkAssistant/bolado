/**
 * Bolado daily puzzle solver.
 *
 * Given a DailyChallenge, enumerates all valid completions:
 * - Choose exactly `n` candidates equal to the number of openSlots (5)
 * - Assign each chosen candidate to an open slot (position-compatible)
 * - Total cost (sum of costTier) ≤ budget (12)
 *
 * Uses bipartite matching (simple backtracking DFS) to check assignability.
 * 15-choose-5 = 3003 subsets × assignment check ≤ trivially fast (<50ms).
 * Completions are enumerated in candidate index order; no duplicates by construction.
 */

import type { DailyChallenge, NationPlayer, OpenSlot } from "./types";
import { canFill } from "./positionFit";
export { canFill } from "./positionFit";

// ---------------------------------------------------------------------------
// Bipartite assignment check via backtracking DFS.
// Returns true if there exists a perfect matching between `players` and `slots`
// where each player i can fill slot j iff canFill(players[i], slots[j]).
// ---------------------------------------------------------------------------
function hasAssignment(
  players: NationPlayer[],
  slots: OpenSlot[],
  playerIdx: number,
  usedSlots: boolean[],
): boolean {
  if (playerIdx === players.length) return true;
  const player = players[playerIdx];
  for (let j = 0; j < slots.length; j++) {
    if (!usedSlots[j] && canFill(player, slots[j])) {
      usedSlots[j] = true;
      if (hasAssignment(players, slots, playerIdx + 1, usedSlots)) return true;
      usedSlots[j] = false;
    }
  }
  return false;
}

function isAssignable(players: NationPlayer[], slots: OpenSlot[]): boolean {
  if (players.length !== slots.length) return false;
  return hasAssignment(players, slots, 0, new Array(slots.length).fill(false));
}

// ---------------------------------------------------------------------------
// Combination generator (indices into candidates array)
// ---------------------------------------------------------------------------
function* combinations(n: number, r: number): Generator<number[]> {
  const indices = Array.from({ length: r }, (_, i) => i);
  yield [...indices];
  while (true) {
    let i = r - 1;
    while (i >= 0 && indices[i] === n - r + i) i--;
    if (i < 0) return;
    indices[i]++;
    for (let j = i + 1; j < r; j++) indices[j] = indices[j - 1] + 1;
    yield [...indices];
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SolverResult {
  /** All distinct valid completions, enumerated in candidate index order; no duplicates by construction. */
  completions: NationPlayer[][];
  /** Number of valid completions */
  count: number;
}

/**
 * Enumerates all valid completions for the given challenge.
 *
 * A completion is a subset of `openSlots.length` candidates such that:
 * 1. They can be assigned to the open slots (bipartite match, position-compatible)
 * 2. Their combined costTier sum ≤ challenge.budget
 */
export function solveChallenge(challenge: DailyChallenge): SolverResult {
  const { candidates, openSlots, budget } = challenge;
  const k = openSlots.length;
  const completions: NationPlayer[][] = [];

  for (const combo of combinations(candidates.length, k)) {
    const picked = combo.map((i) => candidates[i]);
    const cost = picked.reduce((s, p) => s + p.costTier, 0);
    if (cost > budget) continue;
    if (isAssignable(picked, openSlots)) {
      completions.push(picked);
    }
  }

  return { completions, count: completions.length };
}

/**
 * Returns true if the given picks (a selection of k players from candidates)
 * can be assigned to the open slots under the budget constraint.
 */
export function isValidCompletion(
  picks: NationPlayer[],
  openSlots: OpenSlot[],
  budget: number,
): boolean {
  if (picks.length !== openSlots.length) return false;
  const cost = picks.reduce((s, p) => s + p.costTier, 0);
  if (cost > budget) return false;
  return isAssignable(picks, openSlots);
}
