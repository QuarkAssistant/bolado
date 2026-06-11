/**
 * Bolado broadcast script generator.
 *
 * buildMatchScript(challenge, picks, result) → MatchBeat[]
 *
 * Determinism guarantee: same challenge.id + same sorted pick IDs → identical script.
 * Every real goal becomes exactly ONE goal beat at its minute.
 * Generated chance beats are pure theater — no invented goals.
 */

import { hashSeed, createRng, compareByCodePoint } from "./engine/random";
import { phrases } from "./matchPhrases";
import type { DailyChallenge, DailyMatchResult, NationPlayer, PickedSlot } from "./types";

// ---------------------------------------------------------------------------
// Beat types
// ---------------------------------------------------------------------------

export type BeatType =
  | "kickoff"
  | "chance"
  | "oppChance"
  | "goal"
  | "oppGoal"
  | "halftime"
  | "lateDrama"
  | "fulltime";

export interface MatchBeat {
  minute: number;
  type: BeatType;
  /** Rendered commentary line (tokens already resolved). */
  commentary: string;
  /** Only for goal/oppGoal beats. */
  scorer?: string;
  /** Running score at this beat (user goals, opp goals). */
  scoreAtBeat: [number, number];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreStr(userGoals: number, oppGoals: number): string {
  return `${userGoals} a ${oppGoals}`;
}

/** Resolve phrase tokens. */
function resolve(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}

/** Pick a phrase variant deterministically from a pool. */
function pickPhrase(pool: readonly string[], seed: string, index: number): string {
  const h = hashSeed(`${seed}-phrase-${index}`) % pool.length;
  return pool[h]!;
}

/** Find GK display name from the XI (prePlaced + picks). */
function findGkName(challenge: DailyChallenge, picks: PickedSlot[]): string {
  // Check pre-placed
  for (const slot of challenge.prePlaced) {
    if (slot.position === "GOL") return slot.player.displayName;
  }
  // Check open slots
  for (const pick of picks) {
    const slot = challenge.openSlots.find((s) => s.slotId === pick.slotId);
    if (slot?.position === "GOL") return pick.player.displayName;
  }
  return "nosso goleiro";
}

/** Collect all outfield players for chance beat protagonists,
 *  attack-weighted (attackers 3×, midfielders 2×, defenders 1×).
 *  GK intentionally excluded. */
function buildChancePool(challenge: DailyChallenge, picks: PickedSlot[]): string[] {
  type Bucket = "attack" | "midfield" | "defense";

  function bucket(position: string): Bucket {
    if (["PD", "PE", "CA"].includes(position)) return "attack";
    if (["VOL", "MEI", "MD", "ME"].includes(position)) return "midfield";
    return "defense";
  }

  const pool: string[] = [];

  for (const slot of challenge.prePlaced) {
    if (slot.position === "GOL") continue;
    const b = bucket(slot.position);
    const times = b === "attack" ? 3 : b === "midfield" ? 2 : 1;
    for (let i = 0; i < times; i++) pool.push(slot.player.displayName);
  }

  for (const pick of picks) {
    const openSlot = challenge.openSlots.find((s) => s.slotId === pick.slotId);
    const pos = openSlot?.position ?? pick.player.positions[0] ?? "CA";
    if (pos === "GOL") continue;
    const b = bucket(pos);
    const times = b === "attack" ? 3 : b === "midfield" ? 2 : 1;
    for (let i = 0; i < times; i++) pool.push(pick.player.displayName);
  }

  return pool;
}

/** Sorted pick IDs (same convention as playDailyMatch). */
function sortedPickIds(picks: PickedSlot[]): string {
  return [...picks.map((p) => p.player.id)].sort(compareByCodePoint).join(",");
}

// ---------------------------------------------------------------------------
// Script generation
// ---------------------------------------------------------------------------

const MIN_GAP_FOR_CHANCE = 15; // Minutes: gap ≥15 between events to insert a chance beat

/**
 * Build a deterministic broadcast script interleaving real goal events
 * with generated tension beats.
 *
 * Total beats: 10-14 depending on goal count and gaps.
 */
export function buildMatchScript(
  challenge: DailyChallenge,
  picks: PickedSlot[],
  result: DailyMatchResult,
): MatchBeat[] {
  const seed = `bolado-script-${challenge.id}-${sortedPickIds(picks)}`;
  const rng = createRng(seed);
  // Consume a few rng calls upfront so phrase selection varies independently of placement
  rng(); rng();

  const gkName = findGkName(challenge, picks);
  const chancePool = buildChancePool(challenge, picks);
  const marquee = challenge.themeLabel;

  const beats: MatchBeat[] = [];
  let phraseIndex = 0;

  // Track running score as we walk through the match timeline
  let userScore = 0;
  let oppScore = 0;

  // ── Kickoff beat (minute 1)
  const kickoffText = resolve(
    pickPhrase(phrases.kickoff, seed, phraseIndex++),
    { marquee },
  );
  beats.push({ minute: 1, type: "kickoff", commentary: kickoffText, scoreAtBeat: [0, 0] });

  // ── Collect "anchor" event minutes: real goals + fixed markers (45, 90)
  // We'll use these to decide where to insert chance/oppChance beats.
  const goalBeats: Array<{ minute: number; side: "user" | "opponent"; scorer: string }> =
    result.goalEvents.map((e) => ({ minute: e.minute, side: e.side, scorer: e.scorer }));

  // Build full sorted event list: kickoff(1) + goals + halftime(45) + fulltime(90)
  const anchorMinutes = [1, ...goalBeats.map((g) => g.minute), 45, 90].sort((a, b) => a - b);

  // Find gaps ≥ MIN_GAP_FOR_CHANCE between consecutive anchors (excluding 1 already used)
  const gaps: Array<[number, number]> = [];
  for (let i = 0; i < anchorMinutes.length - 1; i++) {
    const from = anchorMinutes[i]!;
    const to = anchorMinutes[i + 1]!;
    if (to - from >= MIN_GAP_FOR_CHANCE) gaps.push([from, to]);
  }

  // Select 2-4 chance beats from available gaps (deterministic)
  const targetChanceBeatCount = 2 + (hashSeed(`${seed}-chance-count`) % 3); // 2, 3, or 4
  const chanceMinutes: number[] = [];

  // For each gap, insert at most one chance beat; sample deterministically
  const shuffledGaps = [...gaps];
  // Deterministic sort of gaps by a hash to vary which ones get beats
  shuffledGaps.sort((a, b) => {
    const ha = hashSeed(`${seed}-gap-${a[0]}-${a[1]}`);
    const hb = hashSeed(`${seed}-gap-${b[0]}-${b[1]}`);
    return ha - hb;
  });

  for (let i = 0; i < Math.min(targetChanceBeatCount, shuffledGaps.length); i++) {
    const [from, to] = shuffledGaps[i]!;
    // Place chance beat at ~30-70% into the gap
    const fraction = 0.3 + ((hashSeed(`${seed}-gap-place-${i}`) % 40) / 100);
    const minute = Math.max(from + 3, Math.min(to - 3, Math.round(from + (to - from) * fraction)));
    chanceMinutes.push(minute);
  }

  // ── Late drama beat: if any goal is at minute ≥ 80
  const hasLateDrama = result.goalEvents.some((e) => e.minute >= 80) || (hashSeed(`${seed}-late`) % 5 === 0);

  // ── Now weave everything together in minute order
  // Build the full event timeline
  type EventEntry =
    | { kind: "goal"; minute: number; side: "user" | "opponent"; scorer: string }
    | { kind: "chance"; minute: number }
    | { kind: "halftime"; minute: number }
    | { kind: "lateDrama"; minute: number }
    | { kind: "fulltime"; minute: number };

  const events: EventEntry[] = [];

  for (const g of goalBeats) {
    events.push({ kind: "goal", minute: g.minute, side: g.side, scorer: g.scorer });
  }

  for (const m of chanceMinutes) {
    // Don't double up on a goal minute
    if (!events.some((e) => e.minute === m)) {
      // Alternate chance / oppChance deterministically
      events.push({ kind: "chance", minute: m });
    }
  }

  events.push({ kind: "halftime", minute: 45 });

  if (hasLateDrama) {
    const rawMinute = result.goalEvents.find((e) => e.minute >= 80)?.minute
      ? result.goalEvents.find((e) => e.minute >= 80)!.minute - 1
      : 88;
    const insertMinute = Math.max(80, rawMinute);
    if (!events.some((e) => e.minute === insertMinute)) {
      events.push({ kind: "lateDrama", minute: insertMinute });
    }
  }

  events.push({ kind: "fulltime", minute: 91 }); // After all real events

  // Sort events by minute, then goals before chance/halftime
  events.sort((a, b) => {
    if (a.minute !== b.minute) return a.minute - b.minute;
    // Goals before other events at same minute
    const aPriority = a.kind === "goal" ? 0 : 1;
    const bPriority = b.kind === "goal" ? 0 : 1;
    return aPriority - bPriority;
  });

  // Track chance/oppChance alternation index for variety
  let chanceIdx = 0;

  for (const event of events) {
    if (event.kind === "goal") {
      if (event.side === "user") {
        userScore++;
        const score = scoreStr(userScore, oppScore);
        const template = pickPhrase(phrases.goal, seed, phraseIndex++);
        const text = resolve(template, { scorer: event.scorer, score });
        beats.push({
          minute: event.minute,
          type: "goal",
          commentary: text,
          scorer: event.scorer,
          scoreAtBeat: [userScore, oppScore],
        });
      } else {
        oppScore++;
        const score = scoreStr(userScore, oppScore);
        const template = pickPhrase(phrases.oppGoal, seed, phraseIndex++);
        const text = resolve(template, { minute: String(event.minute), score });
        beats.push({
          minute: event.minute,
          type: "oppGoal",
          commentary: text,
          scorer: event.scorer,
          scoreAtBeat: [userScore, oppScore],
        });
      }
    } else if (event.kind === "chance") {
      // Alternate between chance and oppChance
      const isOpp = chanceIdx % 2 === 1;
      chanceIdx++;
      if (isOpp) {
        const template = pickPhrase(phrases.oppChance, seed, phraseIndex++);
        const text = resolve(template, { gk: gkName });
        beats.push({
          minute: event.minute,
          type: "oppChance",
          commentary: text,
          scoreAtBeat: [userScore, oppScore],
        });
      } else {
        const playerName = chancePool.length > 0
          ? chancePool[hashSeed(`${seed}-chance-player-${phraseIndex}`) % chancePool.length]!
          : "nosso jogador";
        const template = pickPhrase(phrases.chance, seed, phraseIndex++);
        const text = resolve(template, { player: playerName });
        beats.push({
          minute: event.minute,
          type: "chance",
          commentary: text,
          scoreAtBeat: [userScore, oppScore],
        });
      }
    } else if (event.kind === "halftime") {
      const score = scoreStr(userScore, oppScore);
      const template = pickPhrase(phrases.halftime, seed, phraseIndex++);
      const text = resolve(template, { score });
      beats.push({
        minute: 45,
        type: "halftime",
        commentary: text,
        scoreAtBeat: [userScore, oppScore],
      });
    } else if (event.kind === "lateDrama") {
      const score = scoreStr(userScore, oppScore);
      const template = pickPhrase(phrases.lateDrama, seed, phraseIndex++);
      const text = resolve(template, { score });
      beats.push({
        minute: event.minute,
        type: "lateDrama",
        commentary: text,
        scoreAtBeat: [userScore, oppScore],
      });
    } else if (event.kind === "fulltime") {
      const score = scoreStr(userScore, oppScore);
      const template = pickPhrase(phrases.fulltime, seed, phraseIndex++);
      const text = resolve(template, { score });
      beats.push({
        minute: 90,
        type: "fulltime",
        commentary: text,
        scoreAtBeat: [userScore, oppScore],
      });
    }
  }

  return beats;
}
