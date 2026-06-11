/**
 * Bolado — pick screen reducer (pure logic, no React).
 *
 * State: { picks: Map<slotId, NationPlayer>, budgetSpent, selectedCandidateId }
 * Actions: SELECT_CANDIDATE | PLACE | REMOVE | RESET
 *
 * Key rules:
 *  - PLACE uses canFill (positionFit.ts) for slot compatibility — strict exact-match.
 *  - Budget is hard-enforced: placements that would exceed the budget are blocked.
 *  - PLACE on an occupied slot replaces the occupant (cost refunded first) — same
 *    net-cost check applies.
 *  - If the placed candidate is already in another slot, they are removed from that
 *    slot first (move semantics: no player appears in two slots simultaneously).
 *
 * Design note on PLACE: the action carries the full NationPlayer object because
 * the reducer is pure (no challenge reference embedded in state). The component
 * resolves the selected candidate from the challenge before dispatching.
 */

import type { DailyChallenge, NationPlayer, OpenSlot } from "./types";
import type { PickedSlot } from "./playDailyMatch";
import { canFill } from "./positionFit";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface PickState {
  /** Map from slotId → picked NationPlayer. Size 0–5 during play. */
  readonly picks: ReadonlyMap<string, NationPlayer>;
  /** Sum of costTier for all currently placed candidates. */
  readonly budgetSpent: number;
  /** Currently selected candidate id, or null if no candidate is selected. */
  readonly selectedCandidateId: string | null;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type PickAction =
  | { type: "SELECT_CANDIDATE"; candidateId: string }
  /**
   * Place the selected candidate into the given slot.
   * The `candidate` is the resolved NationPlayer (from challenge.candidates).
   * The `slot` is the OpenSlot object (from challenge.openSlots).
   * The `budget` is the challenge budget for over-spend checking.
   */
  | { type: "PLACE"; candidate: NationPlayer; slot: OpenSlot; budget: number }
  | { type: "REMOVE"; slotId: string }
  | { type: "RESET" };

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPickState(_challenge: DailyChallenge): PickState {
  return {
    picks: new Map(),
    budgetSpent: 0,
    selectedCandidateId: null,
  };
}

// ---------------------------------------------------------------------------
// Derived selectors
// ---------------------------------------------------------------------------

/** Stars remaining after current placements. */
export function remainingBudget(state: PickState, challenge: DailyChallenge): number {
  return challenge.budget - state.budgetSpent;
}

/** True when all 5 open slots are filled (budget is already enforced by PLACE). */
export function canConfirm(state: PickState): boolean {
  return state.picks.size === 5;
}

/**
 * Returns the slotIds that `candidate` can legally be placed into right now.
 *
 * A slot is "placeable" if:
 *  1. canFill(candidate, slot) is true (position match)
 *  2. Net budget impact ≤ remaining budget
 *     net = candidate.costTier − (refund if candidate is already in a slot)
 *                              − (refund of occupant if different player)
 *
 * Includes slots already occupied by a different player (replacement is valid).
 * Includes the slot occupied by the candidate themselves (for visual highlight / move).
 */
export function placeableSlotIds(
  state: PickState,
  candidate: NationPlayer,
  challenge: DailyChallenge,
): string[] {
  const result: string[] = [];
  const remaining = remainingBudget(state, challenge);

  // Cost refund if candidate is already placed somewhere (move semantics)
  const candidateCurrentSlotId =
    [...state.picks.entries()].find(([, p]) => p.id === candidate.id)?.[0] ?? null;
  const candidateRefund = candidateCurrentSlotId !== null ? candidate.costTier : 0;

  for (const slot of challenge.openSlots) {
    if (!canFill(candidate, slot)) continue;

    const occupant = state.picks.get(slot.slotId);
    // If occupant is the same candidate — no net cost change
    const occupantRefund =
      occupant && occupant.id !== candidate.id ? occupant.costTier : 0;

    const net = candidate.costTier - candidateRefund - occupantRefund;
    if (net > remaining) continue;

    result.push(slot.slotId);
  }
  return result;
}

/**
 * Converts the picks Map to an array of PickedSlot (for use with playDailyMatch/scoring).
 */
export function picksAsArray(state: PickState): PickedSlot[] {
  return [...state.picks.entries()].map(([slotId, player]) => ({ slotId, player }));
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function pickReducer(state: PickState, action: PickAction): PickState {
  switch (action.type) {
    case "SELECT_CANDIDATE": {
      if (state.selectedCandidateId === action.candidateId) {
        return { ...state, selectedCandidateId: null };
      }
      return { ...state, selectedCandidateId: action.candidateId };
    }

    case "PLACE": {
      const { candidate, slot, budget } = action;

      // 1. Position compatibility check
      if (!canFill(candidate, slot)) return state;

      // 2. Budget check
      const remaining = budget - state.budgetSpent;
      const candidateCurrentSlotId =
        [...state.picks.entries()].find(([, p]) => p.id === candidate.id)?.[0] ?? null;
      const candidateRefund = candidateCurrentSlotId !== null ? candidate.costTier : 0;

      const occupant = state.picks.get(slot.slotId);
      const occupantRefund =
        occupant && occupant.id !== candidate.id ? occupant.costTier : 0;

      const net = candidate.costTier - candidateRefund - occupantRefund;
      if (net > remaining) return state; // over-budget: blocked (caller triggers shake animation)

      // 3. Build new picks map
      const newPicks = new Map(state.picks);

      // Remove candidate from their current slot (move semantics)
      if (candidateCurrentSlotId !== null) {
        newPicks.delete(candidateCurrentSlotId);
      }

      // Place candidate in target slot
      newPicks.set(slot.slotId, candidate);

      const newBudget =
        state.budgetSpent - candidateRefund - occupantRefund + candidate.costTier;

      return {
        picks: newPicks,
        budgetSpent: newBudget,
        selectedCandidateId: null, // deselect after placement
      };
    }

    case "REMOVE": {
      const occupant = state.picks.get(action.slotId);
      if (!occupant) return state;

      const newPicks = new Map(state.picks);
      newPicks.delete(action.slotId);
      return {
        ...state,
        picks: newPicks,
        budgetSpent: state.budgetSpent - occupant.costTier,
      };
    }

    case "RESET": {
      return {
        picks: new Map(),
        budgetSpent: 0,
        selectedCandidateId: null,
      };
    }

    default:
      return state;
  }
}
