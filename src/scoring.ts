/**
 * Bolado performance scoring.
 *
 * scorePerformance(challenge, picks, matchResult) → DailyVerdict
 *
 * All weights are named constants in one block.
 * Deterministic and pure.
 *
 * Score components (total 100 pts):
 *   RESULT_WEIGHT   = 50  (win=50, draw=25, loss scaled by goal-margin 0-10)
 *   GOALS_WEIGHT    = 15  (user goals, capped at GOALS_CAP=5)
 *   CHEMISTRY_WEIGHT= 20  (era-link hits + condition hits across picked players)
 *   BUDGET_WEIGHT   = 15  (unspent budget + value-pick bonus)
 */

import type {
  DailyChallenge,
  DailyMatchResult,
  DailyVerdict,
  PickedSlot,
  PickGrade,
  PickGradeEntry,
} from "./types";

// ---------------------------------------------------------------------------
// Named weight constants
// ---------------------------------------------------------------------------

/** Maximum points from the result component. */
export const RESULT_WEIGHT = 50;
/** Maximum points from user goals. */
export const GOALS_WEIGHT = 15;
/** Maximum points from chemistry (era links + condition hits). */
export const CHEMISTRY_WEIGHT = 20;
/** Maximum points from budget efficiency. */
export const BUDGET_WEIGHT = 15;

/** User goals needed to earn full GOALS_WEIGHT (capped). */
export const GOALS_CAP = 5;

/** Number of pre-placed players sharing an era required for chemistry link. */
export const CHEMISTRY_ERA_THRESHOLD = 2;
/** Bonus stat points per chemistry link. */
export const CHEMISTRY_BONUS = 2;

/** Star bucket thresholds: points[i] = minimum pts for (i+1) stars */
//   0 stars: < 20,  1 star: 20-39,  2 stars: 40-54,  3 stars: 55-69,  4 stars: 70-84,  5 stars: 85+
export const STAR_THRESHOLDS = [20, 40, 55, 70, 85] as const;

/** Cost tier at-or-above which a player is "expensive". */
export const EXPENSIVE_TIER = 4;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function prePlacedEraCounts(challenge: DailyChallenge): Map<string, number> {
  const counts = new Map<string, number>();
  for (const slot of challenge.prePlaced) {
    const era = slot.player.eraBand;
    counts.set(era, (counts.get(era) ?? 0) + 1);
  }
  return counts;
}

function hasChemistryLink(
  player: import("./types").NationPlayer,
  eraCounts: Map<string, number>,
): boolean {
  return (eraCounts.get(player.eraBand) ?? 0) >= CHEMISTRY_ERA_THRESHOLD;
}

function hasConditionBonus(
  player: import("./types").NationPlayer,
  challenge: DailyChallenge,
): boolean {
  return challenge.condition.appliesTo(player);
}

// ---------------------------------------------------------------------------
// Result component (0–RESULT_WEIGHT)
// ---------------------------------------------------------------------------

function resultScore(matchResult: DailyMatchResult): number {
  if (matchResult.outcome === "win") return RESULT_WEIGHT;
  if (matchResult.outcome === "draw") return Math.round(RESULT_WEIGHT * 0.5); // 25
  // Loss: scale 0-10 by margin (margin 1 → 10, margin ≥5 → 0)
  const margin = matchResult.opponentGoals - matchResult.userGoals;
  const lossMax = Math.round(RESULT_WEIGHT * 0.2); // 10 pts max for a narrow loss
  return Math.max(0, lossMax - (margin - 1) * 3);
}

// ---------------------------------------------------------------------------
// Goals component (0–GOALS_WEIGHT)
// ---------------------------------------------------------------------------

function goalsScore(matchResult: DailyMatchResult): number {
  const goals = Math.min(matchResult.userGoals, GOALS_CAP);
  return Math.round((goals / GOALS_CAP) * GOALS_WEIGHT);
}

// ---------------------------------------------------------------------------
// Chemistry component (0–CHEMISTRY_WEIGHT)
// ---------------------------------------------------------------------------

function chemistryScore(challenge: DailyChallenge, picks: PickedSlot[]): number {
  const eraCounts = prePlacedEraCounts(challenge);
  let hits = 0;
  const maxHits = picks.length; // one hit per picked player

  for (const pick of picks) {
    const chem = hasChemistryLink(pick.player, eraCounts);
    const cond = hasConditionBonus(pick.player, challenge);
    if (chem || cond) hits++;
  }

  return Math.round((hits / maxHits) * CHEMISTRY_WEIGHT);
}

// ---------------------------------------------------------------------------
// Budget efficiency component (0–BUDGET_WEIGHT)
// ---------------------------------------------------------------------------

function budgetScore(challenge: DailyChallenge, picks: PickedSlot[]): number {
  const totalCost = picks.reduce((s, p) => s + p.player.costTier, 0);
  const unspent = challenge.budget - totalCost;

  // Unspent budget base: 0-8 pts scaled to budget (spending exactly is baseline)
  const baseMax = Math.round(BUDGET_WEIGHT * 0.5); // 7-8 pts
  const budgetBase = Math.max(0, Math.round((unspent / challenge.budget) * baseMax * 2));

  // Value-pick bonus: tier 1 or 2 player with chemistry link or condition hit
  const eraCounts = prePlacedEraCounts(challenge);
  const valuePicks = picks.filter(
    (p) =>
      p.player.costTier <= 2 &&
      (hasChemistryLink(p.player, eraCounts) || hasConditionBonus(p.player, challenge)),
  ).length;

  const valueBonus = Math.min(valuePicks * 3, Math.round(BUDGET_WEIGHT * 0.6));

  return Math.min(BUDGET_WEIGHT, budgetBase + valueBonus);
}

// ---------------------------------------------------------------------------
// Pick grades
// ---------------------------------------------------------------------------

function gradeForPick(
  pick: PickedSlot,
  challenge: DailyChallenge,
  eraCounts: Map<string, number>,
  scorerNames: Set<string>,
): PickGrade {
  const cond = hasConditionBonus(pick.player, challenge);
  const chem = hasChemistryLink(pick.player, eraCounts);
  const scored = scorerNames.has(pick.player.displayName);

  // 🟦 = condition bonus hit (highest priority badge)
  if (cond) return "🟦";

  // 🟩 = great value: chemistry link + affordable (tier ≤ 3)
  if (chem && pick.player.costTier <= 3) return "🟩";

  // 🟥 = expensive flop: tier ≥ EXPENSIVE_TIER, no link, no condition, no goal
  if (pick.player.costTier >= EXPENSIVE_TIER && !chem && !cond && !scored) return "🟥";

  // 🟩 = goal scorer + not expensive
  if (scored && pick.player.costTier < EXPENSIVE_TIER) return "🟩";

  // 🟨 = fine (everything else)
  return "🟨";
}

// ---------------------------------------------------------------------------
// Star bucket
// ---------------------------------------------------------------------------

function starsFromPoints(points: number): DailyVerdict["stars"] {
  if (points >= STAR_THRESHOLDS[4]) return 5;
  if (points >= STAR_THRESHOLDS[3]) return 4;
  if (points >= STAR_THRESHOLDS[2]) return 3;
  if (points >= STAR_THRESHOLDS[1]) return 2;
  if (points >= STAR_THRESHOLDS[0]) return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function scorePerformance(
  challenge: DailyChallenge,
  picks: PickedSlot[],
  matchResult: DailyMatchResult,
): DailyVerdict {
  const rs = resultScore(matchResult);
  const gs = goalsScore(matchResult);
  const cs = chemistryScore(challenge, picks);
  const bs = budgetScore(challenge, picks);

  const points = Math.min(100, Math.max(0, rs + gs + cs + bs));
  const stars = starsFromPoints(points);

  // Build pick grades
  const eraCounts = prePlacedEraCounts(challenge);
  const scorerNames = new Set(
    matchResult.goalEvents
      .filter((e) => e.side === "user")
      .map((e) => e.scorer),
  );

  const pickGrades: PickGradeEntry[] = picks.map((pick) => ({
    slotId: pick.slotId,
    playerId: pick.player.id,
    grade: gradeForPick(pick, challenge, eraCounts, scorerNames),
  }));

  return { points, stars, pickGrades };
}
