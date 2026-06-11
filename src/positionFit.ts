/**
 * Position-compatibility check for the Bolado daily puzzle.
 *
 * WARNING: This module is the authoritative position-fit rule for the daily game.
 * The game's `draft.ts` has a `canFillSlot` helper with DIFFERENT flex rules
 * (it may allow positional adjacency, formation flex, etc.) and MUST NOT be used
 * in place of this function for daily puzzle logic.
 *
 * Rule: a player can fill a slot if and only if the slot's position string
 * appears verbatim in the player's `positions` array. No flex, no aliases.
 */

import type { NationPlayer, OpenSlot } from "./types";

/**
 * Returns true if `player` is eligible to fill `slot` in the daily puzzle.
 *
 * Strict exact-match only — no adjacency flex, no formation aliases.
 * Do NOT substitute `canFillSlot` from `src/game/draft.ts` here; that
 * function applies formation-based flex rules that are invalid for the puzzle.
 */
export function canFill(player: NationPlayer, slot: OpenSlot): boolean {
  return player.positions.includes(slot.position);
}
