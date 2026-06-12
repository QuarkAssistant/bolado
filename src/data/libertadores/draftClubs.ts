/**
 * Dice draft source — "roll → a club appears → sign ONE player from it"
 * (docs/spec-v2.md §3.1 step 2, 7a0 DNA).
 *
 * At launch the dice are powered by the existing nation pools (spec §6); club
 * rosters slot in later behind the same offer shape. rollDraftOffer is PURE
 * over the pools it receives and deterministic in the rng it is given —
 * createRng(seed) in, same offer out, forever (daily-run replay foundation).
 */

import type { NationPlayer } from "../../types";
import { compareByCodePoint } from "../../engine/random";

/** Matches the return shape of engine/random.createRng. */
export type Rng = () => number;

export interface DraftOffer {
  /** pt-BR card title for the rolled pool, e.g. "Lendas do Brasil". */
  label: string;
  /** Exactly 5 players, no duplicates, ≥3 distinct positions covered. */
  players: NationPlayer[];
}

export const OFFER_SIZE = 5;
export const MIN_DISTINCT_POSITIONS = 3;

/** pt-BR labels for the launch pools; unknown keys fall back to the key. */
export const POOL_LABELS: Record<string, string> = {
  Brazil: "Lendas do Brasil",
  Argentina: "Lendas da Argentina",
  Mexico: "Lendas do México",
  USA: "Lendas dos EUA",
  Spain: "Lendas da Espanha",
  France: "Lendas da França",
  Netherlands: "Lendas da Holanda",
  Colombia: "Lendas da Colômbia",
  Morocco: "Lendas do Marrocos",
  Japan: "Lendas do Japão",
  Senegal: "Lendas do Senegal",
  Canada: "Lendas do Canadá",
  "South Africa": "Lendas da África do Sul",
  wildcards: "Bolada Mundial",
};

function distinctPositions(players: readonly NationPlayer[]): Set<string> {
  const positions = new Set<string>();
  for (const player of players) {
    for (const position of player.positions) positions.add(position);
  }
  return positions;
}

/** A pool can power an offer when 5 picks can cover ≥3 positions. */
export function isRollablePool(pool: readonly NationPlayer[]): boolean {
  return pool.length >= OFFER_SIZE && distinctPositions(pool).size >= MIN_DISTINCT_POSITIONS;
}

/** Deterministic Fisher-Yates over a copy — never mutates the input. */
function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap]!, copy[index]!];
  }
  return copy;
}

/**
 * Roll one draft offer: pick a pool, then 5 distinct players from it covering
 * at least 3 positions.
 *
 * Deterministic given the rng sequence; pure over `pools` (no mutation).
 * Pool keys are sorted code-point-wise so the roll never depends on object
 * insertion order. Throws when no pool can satisfy the offer invariants.
 */
export function rollDraftOffer(
  pools: Record<string, readonly NationPlayer[]>,
  rng: Rng,
): DraftOffer {
  const rollable = Object.keys(pools)
    .filter((key) => isRollablePool(pools[key]!))
    .sort(compareByCodePoint);
  if (rollable.length === 0) {
    throw new Error("rollDraftOffer: no pool can fill a 5-player, 3-position offer");
  }

  const poolKey = rollable[Math.floor(rng() * rollable.length) % rollable.length]!;
  const candidates = shuffled(pools[poolKey]!, rng);

  // Greedy pick over the shuffled order: a candidate that brings no new
  // position is only taken while there is slack to still reach 3 positions
  // with the remaining slots. Sound because the pool covers ≥3 positions.
  const players: NationPlayer[] = [];
  const covered = new Set<string>();
  for (const candidate of candidates) {
    if (players.length === OFFER_SIZE) break;
    const addsPosition = candidate.positions.some((position) => !covered.has(position));
    const slotsLeft = OFFER_SIZE - players.length;
    const positionsMissing = Math.max(0, MIN_DISTINCT_POSITIONS - covered.size);
    if (!addsPosition && slotsLeft <= positionsMissing) continue;
    players.push(candidate);
    for (const position of candidate.positions) covered.add(position);
  }

  return { label: POOL_LABELS[poolKey] ?? poolKey, players };
}
