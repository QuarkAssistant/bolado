/**
 * Bolado single-match simulation.
 *
 * playDailyMatch(challenge, picks) → DailyMatchResult
 *
 * Determinism guarantee: same challenge.id + same sorted pick IDs → same result.
 * Algorithm:
 *   1. Build XI strength from pre-placed (6) + picked (5) players.
 *   2. Apply condition bonuses and chemistry bonuses to each player's contributing stat.
 *   3. Derive attack / midfield / defense aggregates → overall.
 *   4. Compute expected goals for both sides from strength differential.
 *   5. Sample goals via goalsFromExpected with seeded RNG.
 *   6. Generate goal events (minutes + scorers from outfield pool).
 */

import { compareByCodePoint, hashSeed, createRng } from "./engine/random";
import { goalsFromExpected } from "./engine/goals";
import type { DailyChallenge, DailyMatchResult, MatchGoalEvent, NationPlayer, PickedSlot } from "./types";

export type { PickedSlot } from "./types";

// ---------------------------------------------------------------------------
// Position → stat mapping
// GOL/ZAG/LD/LE → defense; VOL/MEI → midfield; PD/PE/CA → attack
// ---------------------------------------------------------------------------

function primaryStat(player: NationPlayer, position: string): "attack" | "midfield" | "defense" {
  if (["PD", "PE", "CA"].includes(position)) return "attack";
  if (["VOL", "MEI", "MD", "ME"].includes(position)) return "midfield";
  return "defense"; // GOL, ZAG, LD, LE
}

/**
 * Determine which stat a player contributes based on their primary assigned position.
 * If the player has multiple positions, the first listed position is authoritative.
 */
function contributionStat(player: NationPlayer): "attack" | "midfield" | "defense" {
  return primaryStat(player, player.positions[0] ?? "GOL");
}

// ---------------------------------------------------------------------------
// Chemistry: a picked player sharing an eraBand with ≥2 pre-placed players
//            gets +2 on their contributing stat.
// ---------------------------------------------------------------------------

function chemistryBonus(
  player: NationPlayer,
  prePlaced: DailyChallenge["prePlaced"],
): number {
  const era = player.eraBand;
  const count = prePlaced.filter((s) => s.player.eraBand === era).length;
  return count >= 2 ? 2 : 0;
}

// ---------------------------------------------------------------------------
// Build aggregated XI ratings from the full 11-player roster
// ---------------------------------------------------------------------------

interface XIStrength {
  attack: number;
  midfield: number;
  defense: number;
  overall: number;
}

function buildXIStrength(
  challenge: DailyChallenge,
  picks: PickedSlot[],
): XIStrength {
  const prePlaced = challenge.prePlaced;
  const condition = challenge.condition;

  // Collect all 11 entries with their contributing stat and bonuses
  const entries: Array<{ stat: number; bucket: "attack" | "midfield" | "defense" }> = [];

  // Pre-placed six: use their assigned slot position for bucket, base stat, add condition bonus
  for (const slot of prePlaced) {
    const bucket = primaryStat(slot.player, slot.position);
    const base = slot.player[bucket];
    const condBonus = condition.appliesTo(slot.player) ? condition.bonus : 0;
    // Pre-placed get no chemistry (they are the pre-placed players, chemistry is for picks)
    entries.push({ stat: base + condBonus, bucket });
  }

  // Picked five: use their slot position, apply condition and chemistry bonuses
  for (const pick of picks) {
    // Find the open slot position for this pick
    const openSlot = challenge.openSlots.find((s) => s.slotId === pick.slotId);
    const position = openSlot?.position ?? pick.player.positions[0] ?? "CA";
    const bucket = primaryStat(pick.player, position);
    const base = pick.player[bucket];
    const condBonus = condition.appliesTo(pick.player) ? condition.bonus : 0;
    const chem = chemistryBonus(pick.player, prePlaced);
    entries.push({ stat: base + condBonus + chem, bucket });
  }

  const avg = (values: number[]) =>
    values.length === 0 ? 70 : Math.round(values.reduce((s, v) => s + v, 0) / values.length);

  const attackValues = entries.filter((e) => e.bucket === "attack").map((e) => e.stat);
  const midfieldValues = entries.filter((e) => e.bucket === "midfield").map((e) => e.stat);
  const defenseValues = entries.filter((e) => e.bucket === "defense").map((e) => e.stat);

  const attack = avg(attackValues);
  const midfield = avg(midfieldValues);
  const defense = avg(defenseValues);
  const overall = avg(entries.map((e) => e.stat));

  return { attack, midfield, defense, overall };
}

// ---------------------------------------------------------------------------
// Expected goals formula
// Adapted from simulator.ts playMatch formula, single-match version.
// Typical outcome: a ~rating-83 XI vs benchmark ~85 is a competitive match.
//
// Expected goals formula (tuned for 0-4 goals per side on average):
//   xG_user = BASE_USER + (attack_user - defense_opp) / ATTACK_SCALE
//             + (overall_user - benchmark_rating) / OVERALL_SCALE
//   xG_opp  = BASE_OPP  + (benchmark_rating - defense_user) / ATTACK_SCALE
//
// Constants tuned so that:
//   - A balanced match (user~85, benchmark~85) produces ~1.2 xG per side
//   - A very strong team (user~95) can reach ~2.5 xG
//   - A weak team (~70) drops to ~0.5 xG
// ---------------------------------------------------------------------------

const BASE_USER_XG = 1.10;
const BASE_OPP_XG  = 1.05;
const ATTACK_SCALE  = 30;
const OVERALL_SCALE = 50;

function computeExpectedGoals(
  xiStrength: XIStrength,
  benchmarkRating: number,
): { userXG: number; opponentXG: number } {
  const benchDefense = benchmarkRating; // Benchmark is flat-rated, single number for all

  const userXG =
    BASE_USER_XG +
    (xiStrength.attack - benchDefense) / ATTACK_SCALE +
    (xiStrength.overall - benchmarkRating) / OVERALL_SCALE;

  const opponentXG =
    BASE_OPP_XG +
    (benchmarkRating - xiStrength.defense) / ATTACK_SCALE;

  return { userXG, opponentXG };
}

// ---------------------------------------------------------------------------
// Deterministic match seed
// ---------------------------------------------------------------------------

function buildMatchSeed(challenge: DailyChallenge, picks: PickedSlot[]): string {
  const sortedPickIds = [...picks.map((p) => p.player.id)].sort(compareByCodePoint);
  return `bolado-${challenge.id}-${sortedPickIds.join(",")}`;
}

// ---------------------------------------------------------------------------
// Goal minutes (deterministic, 1-90)
// ---------------------------------------------------------------------------

function goalMinute(seed: string, side: "user" | "opponent", goalIndex: number): number {
  return 1 + (hashSeed(`${seed}-${side}-minute-${goalIndex}`) % 90);
}

// ---------------------------------------------------------------------------
// Scorer attribution pool (outfield only, attack-weighted)
// ---------------------------------------------------------------------------

function buildScorerPool(challenge: DailyChallenge, picks: PickedSlot[]): string[] {
  const allPlayers: Array<{ player: NationPlayer; bucket: "attack" | "midfield" | "defense" }> = [];

  for (const slot of challenge.prePlaced) {
    if (slot.position === "GOL") continue; // Exclude GK
    const bucket = primaryStat(slot.player, slot.position);
    allPlayers.push({ player: slot.player, bucket });
  }

  for (const pick of picks) {
    const openSlot = challenge.openSlots.find((s) => s.slotId === pick.slotId);
    const position = openSlot?.position ?? pick.player.positions[0] ?? "CA";
    if (position === "GOL") continue; // Exclude GK
    const bucket = primaryStat(pick.player, position);
    allPlayers.push({ player: pick.player, bucket });
  }

  // Build pool with attack-weighted duplicates: attackers appear 3×, midfielders 2×, defenders 1×
  const pool: string[] = [];
  for (const entry of allPlayers) {
    const times = entry.bucket === "attack" ? 3 : entry.bucket === "midfield" ? 2 : 1;
    for (let i = 0; i < times; i++) {
      pool.push(entry.player.displayName);
    }
  }

  return pool;
}

function pickScorer(pool: string[], seed: string, side: "user" | "opponent", goalIndex: number): string {
  if (pool.length === 0) return "Craque do XI";
  const idx = hashSeed(`${seed}-${side}-scorer-${goalIndex}`) % pool.length;
  return pool[idx]!;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function playDailyMatch(
  challenge: DailyChallenge,
  picks: PickedSlot[],
): DailyMatchResult {
  const seed = buildMatchSeed(challenge, picks);
  const xiStrength = buildXIStrength(challenge, picks);
  const { userXG, opponentXG } = computeExpectedGoals(xiStrength, challenge.benchmark.rating);

  const rng = createRng(seed);
  const userGoals = goalsFromExpected(userXG, rng());
  const opponentGoals = goalsFromExpected(opponentXG, rng());

  const outcome: DailyMatchResult["outcome"] =
    userGoals > opponentGoals ? "win" : userGoals === opponentGoals ? "draw" : "loss";

  // Build goal events
  const scorerPool = buildScorerPool(challenge, picks);
  const rawEvents: MatchGoalEvent[] = [];

  for (let i = 0; i < userGoals; i++) {
    rawEvents.push({
      minute: goalMinute(seed, "user", i),
      side: "user",
      scorer: pickScorer(scorerPool, seed, "user", i),
    });
  }

  for (let i = 0; i < opponentGoals; i++) {
    rawEvents.push({
      minute: goalMinute(seed, "opponent", i),
      side: "opponent",
      scorer: challenge.benchmark.name,
    });
  }

  const goalEvents = rawEvents.sort(
    (a, b) =>
      a.minute - b.minute ||
      (a.side === b.side ? 0 : a.side === "user" ? -1 : 1),
  );

  return { userGoals, opponentGoals, outcome, goalEvents };
}
