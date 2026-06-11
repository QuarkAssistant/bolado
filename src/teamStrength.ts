/**
 * Bolado XI-strength helpers — the single source of truth for how a lineup's
 * attack/midfield/defense/overall aggregates are computed.
 *
 * computeXiStrength(challenge, picks) works with PARTIAL picks (0–5 placed):
 * the pick screen uses it for the live força meter, and playDailyMatch
 * consumes the exact same function for the match simulation (determinism:
 * identical inputs → identical aggregates).
 *
 * candidateImpact(challenge, currentPicks, candidate, slot) previews the
 * effect of placing a candidate: overall delta + condition/chemistry flags.
 *
 * Rules (unchanged from the original engine):
 *   - Bucket by assigned slot position: GOL/ZAG/LD/LE → defense,
 *     VOL/MEI (MD/ME) → midfield, PD/PE/CA → attack.
 *   - Condition bonus applies to pre-placed AND picked players.
 *   - Chemistry (+2) applies only to picked players sharing an eraBand
 *     with ≥2 pre-placed players.
 *   - Empty bucket averages fall back to a neutral 70.
 */

import type { DailyChallenge, NationPlayer, OpenSlot, PickedSlot } from "./types";

// ---------------------------------------------------------------------------
// Position → stat mapping
// ---------------------------------------------------------------------------

export type StatBucket = "attack" | "midfield" | "defense";

/** Map a slot position to the stat bucket the occupant contributes. */
export function bucketForPosition(position: string): StatBucket {
  if (["PD", "PE", "CA"].includes(position)) return "attack";
  if (["VOL", "MEI", "MD", "ME"].includes(position)) return "midfield";
  return "defense"; // GOL, ZAG, LD, LE
}

// ---------------------------------------------------------------------------
// Chemistry: a picked player sharing an eraBand with ≥2 pre-placed players
//            gets +2 on their contributing stat.
// ---------------------------------------------------------------------------

const CHEMISTRY_STAT_BONUS = 2;
const CHEMISTRY_ERA_THRESHOLD = 2;
const EMPTY_BUCKET_NEUTRAL = 70;

function chemistryBonus(player: NationPlayer, prePlaced: DailyChallenge["prePlaced"]): number {
  const count = prePlaced.filter((s) => s.player.eraBand === player.eraBand).length;
  return count >= CHEMISTRY_ERA_THRESHOLD ? CHEMISTRY_STAT_BONUS : 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface XiStrength {
  attack: number;
  midfield: number;
  defense: number;
  overall: number;
  /** Player ids (pre-placed + picked) earning the day's condition bonus. */
  conditionHits: string[];
  /** Picked player ids earning the era-link chemistry bonus. */
  chemistryLinks: string[];
}

/**
 * Aggregate XI strength for the pre-placed six plus 0–5 picks.
 * Pure and deterministic; identical to the original playDailyMatch math
 * for a full 5-pick lineup.
 */
export function computeXiStrength(challenge: DailyChallenge, picks: PickedSlot[]): XiStrength {
  const prePlaced = challenge.prePlaced;
  const condition = challenge.condition;

  const entries: Array<{ stat: number; bucket: StatBucket }> = [];
  const conditionHits: string[] = [];
  const chemistryLinks: string[] = [];

  // Pre-placed: slot-position bucket, base stat + condition bonus (no chemistry)
  for (const slot of prePlaced) {
    const bucket = bucketForPosition(slot.position);
    const condApplies = condition.appliesTo(slot.player);
    if (condApplies) conditionHits.push(slot.player.id);
    entries.push({ stat: slot.player[bucket] + (condApplies ? condition.bonus : 0), bucket });
  }

  // Picked: slot-position bucket, base stat + condition + chemistry bonuses
  for (const pick of picks) {
    const openSlot = challenge.openSlots.find((s) => s.slotId === pick.slotId);
    const position = openSlot?.position ?? pick.player.positions[0] ?? "CA";
    const bucket = bucketForPosition(position);
    const condApplies = condition.appliesTo(pick.player);
    if (condApplies) conditionHits.push(pick.player.id);
    const chem = chemistryBonus(pick.player, prePlaced);
    if (chem > 0) chemistryLinks.push(pick.player.id);
    entries.push({
      stat: pick.player[bucket] + (condApplies ? condition.bonus : 0) + chem,
      bucket,
    });
  }

  const avg = (values: number[]) =>
    values.length === 0
      ? EMPTY_BUCKET_NEUTRAL
      : Math.round(values.reduce((s, v) => s + v, 0) / values.length);

  const attack = avg(entries.filter((e) => e.bucket === "attack").map((e) => e.stat));
  const midfield = avg(entries.filter((e) => e.bucket === "midfield").map((e) => e.stat));
  const defense = avg(entries.filter((e) => e.bucket === "defense").map((e) => e.stat));
  const overall = avg(entries.map((e) => e.stat));

  return { attack, midfield, defense, overall, conditionHits, chemistryLinks };
}

// ---------------------------------------------------------------------------
// Candidate impact preview (live pick feedback)
// ---------------------------------------------------------------------------

export interface CandidateImpact {
  /** Change in overall strength if the candidate is placed into the slot. */
  strengthDelta: number;
  /** True when the day's condition bonus applies to this candidate. */
  conditionHit: boolean;
  /** True when the candidate shares an eraBand with ≥2 pre-placed players. */
  chemistryLink: boolean;
}

/**
 * Preview what placing `candidate` into `slot` would do to the XI's overall
 * strength (replacing the current occupant of the slot, if any, and moving
 * the candidate out of any slot they already occupy).
 */
export function candidateImpact(
  challenge: DailyChallenge,
  currentPicks: PickedSlot[],
  candidate: NationPlayer,
  slot: OpenSlot,
): CandidateImpact {
  const before = computeXiStrength(challenge, currentPicks).overall;

  const nextPicks: PickedSlot[] = [
    ...currentPicks.filter((p) => p.slotId !== slot.slotId && p.player.id !== candidate.id),
    { slotId: slot.slotId, player: candidate },
  ];
  const after = computeXiStrength(challenge, nextPicks).overall;

  return {
    strengthDelta: after - before,
    conditionHit: challenge.condition.appliesTo(candidate),
    chemistryLink: chemistryBonus(candidate, challenge.prePlaced) > 0,
  };
}
