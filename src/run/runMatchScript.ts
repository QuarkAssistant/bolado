/**
 * Run broadcast script generator (Phase B part 2).
 *
 * buildRunMatchScript(result, cardFirings, opponent, ctx) → RunMatchBeat[]
 *
 * The v1 beat machinery (matchScript.ts) adapted for run matches:
 *   - kickoff carries the opponent flavor line ("o Rei de Copas…")
 *   - every real goal becomes exactly ONE goal beat at its minute
 *   - chance beats are pure theater — no invented goals
 *   - PLUS card-firing beats: every CardFiring becomes a beat at its moment
 *     (preMatch → right after kickoff; goal → right after that goal beat;
 *     result/shootout → after the fulltime beat). These are the legibility
 *     payoff — the UI renders them as poster-chip toasts.
 *   - drawn matches decided on penalties get a shootout beat after fulltime.
 *
 * Determinism: same ctx.seed + same result/firings → identical script.
 */

import { hashSeed } from "../engine/random";
import { pickPhrase, resolvePhrase } from "../matchScript";
import { runPhrases } from "../matchPhrases";
import { bucketForPosition } from "../teamStrength";
import {
  FORMATIONS,
  type CardFiring,
  type OpponentDef,
  type RunMatchResult,
  type Squad,
  type StageDef,
} from "./types";

// ---------------------------------------------------------------------------
// Beat types
// ---------------------------------------------------------------------------

export type RunBeatType =
  | "kickoff"
  | "chance"
  | "oppChance"
  | "goal"
  | "oppGoal"
  | "halftime"
  | "lateDrama"
  | "fulltime"
  | "shootout"
  | "cardFire";

export interface RunMatchBeat {
  minute: number;
  type: RunBeatType;
  /** Rendered commentary line (tokens already resolved). For cardFire beats: the firing label. */
  commentary: string;
  /** Only for goal/oppGoal beats. */
  scorer?: string;
  /** Running score at this beat (user goals, opp goals). */
  scoreAtBeat: [number, number];
  /** Only for cardFire beats — the firing this beat announces. */
  firing?: CardFiring;
}

export interface RunScriptCtx {
  /** Deterministic seed stream, e.g. `${run.seed}:match:${stageIndex}`. */
  seed: string;
  stage: StageDef;
  squad: Squad;
}

// ---------------------------------------------------------------------------
// Squad-derived helpers (run squads are always fully populated)
// ---------------------------------------------------------------------------

function findGkName(squad: Squad): string {
  for (const slot of FORMATIONS[squad.formation]) {
    if (slot.position !== "GOL") continue;
    const player = squad.slots.get(slot.slotId);
    if (player) return player.displayName;
  }
  return "nosso goleiro";
}

/** Outfield protagonists for chance beats, attack-weighted (3×/2×/1×). */
function buildChancePool(squad: Squad): string[] {
  const pool: string[] = [];
  for (const slot of FORMATIONS[squad.formation]) {
    if (slot.position === "GOL") continue;
    const player = squad.slots.get(slot.slotId);
    if (!player) continue;
    const bucket = bucketForPosition(slot.position);
    const times = bucket === "attack" ? 3 : bucket === "midfield" ? 2 : 1;
    for (let i = 0; i < times; i += 1) pool.push(player.displayName);
  }
  return pool;
}

// ---------------------------------------------------------------------------
// Script generation
// ---------------------------------------------------------------------------

const MIN_GAP_FOR_CHANCE = 15;

function scoreStr(userGoals: number, oppGoals: number): string {
  return `${userGoals} a ${oppGoals}`;
}

export function buildRunMatchScript(
  result: RunMatchResult,
  cardFirings: CardFiring[],
  opponent: OpponentDef,
  ctx: RunScriptCtx,
): RunMatchBeat[] {
  const seed = `bolado-run-script-${ctx.seed}`;
  const gkName = findGkName(ctx.squad);
  const chancePool = buildChancePool(ctx.squad);
  const common = {
    opponent: opponent.name,
    stageLabel: ctx.stage.label,
    // Flavor lines are full sentences; trim trailing punctuation so the
    // kickoff templates' own ".", "!" don't double up.
    flavor: opponent.flavor.replace(/[.!…\s]+$/u, ""),
  };

  const beats: RunMatchBeat[] = [];
  let phraseIndex = 0;
  let userScore = 0;
  let oppScore = 0;

  const say = (pool: readonly string[], vars: Record<string, string> = {}): string =>
    resolvePhrase(pickPhrase(pool, seed, phraseIndex++), { ...common, ...vars });

  // ── Kickoff (minute 1) — carries the opponent flavor line
  beats.push({ minute: 1, type: "kickoff", commentary: say(runPhrases.kickoff), scoreAtBeat: [0, 0] });

  // ── preMatch card firings slam in right after kickoff
  const preMatchFirings = cardFirings.filter((f) => f.moment === "preMatch");
  for (const firing of preMatchFirings) {
    beats.push({ minute: 1, type: "cardFire", commentary: firing.label, scoreAtBeat: [0, 0], firing });
  }

  // ── Goal-moment firings queue — emitted in order, attached to the first
  //    goal beat whose minute matches the firing's minute (playRunMatch
  //    records them chronologically, so a simple consume keeps them aligned).
  const goalFirings = cardFirings.filter((f) => f.moment === "goal");
  let goalFiringCursor = 0;

  // ── Chance beats in gaps ≥15min between anchors (same machinery as v1)
  const anchorMinutes = [1, ...result.goalEvents.map((g) => g.minute), 45, 90].sort((a, b) => a - b);
  const gaps: Array<[number, number]> = [];
  for (let i = 0; i < anchorMinutes.length - 1; i += 1) {
    const from = anchorMinutes[i]!;
    const to = anchorMinutes[i + 1]!;
    if (to - from >= MIN_GAP_FOR_CHANCE) gaps.push([from, to]);
  }
  const targetChanceBeatCount = 2 + (hashSeed(`${seed}-chance-count`) % 3);
  const sortedGaps = [...gaps].sort((a, b) => {
    const ha = hashSeed(`${seed}-gap-${a[0]}-${a[1]}`);
    const hb = hashSeed(`${seed}-gap-${b[0]}-${b[1]}`);
    return ha - hb;
  });
  const chanceMinutes: number[] = [];
  for (let i = 0; i < Math.min(targetChanceBeatCount, sortedGaps.length); i += 1) {
    const [from, to] = sortedGaps[i]!;
    const fraction = 0.3 + ((hashSeed(`${seed}-gap-place-${i}`) % 40) / 100);
    const minute = Math.max(from + 3, Math.min(to - 3, Math.round(from + (to - from) * fraction)));
    chanceMinutes.push(minute);
  }

  // ── Late drama: real late goal or a seeded 1-in-5
  const hasLateDrama =
    result.goalEvents.some((e) => e.minute >= 80) || hashSeed(`${seed}-late`) % 5 === 0;

  // ── Weave the in-match timeline
  type EventEntry =
    | { kind: "goal"; minute: number; side: "user" | "opponent"; scorer: string }
    | { kind: "chance"; minute: number }
    | { kind: "halftime"; minute: number }
    | { kind: "lateDrama"; minute: number };

  const events: EventEntry[] = result.goalEvents.map((g) => ({
    kind: "goal" as const,
    minute: g.minute,
    side: g.side,
    scorer: g.scorer,
  }));
  for (const minute of chanceMinutes) {
    if (!events.some((e) => e.minute === minute)) events.push({ kind: "chance", minute });
  }
  events.push({ kind: "halftime", minute: 45 });
  if (hasLateDrama) {
    const lateGoal = result.goalEvents.find((e) => e.minute >= 80);
    const insertMinute = Math.max(80, lateGoal ? lateGoal.minute - 1 : 88);
    if (!events.some((e) => e.minute === insertMinute)) {
      events.push({ kind: "lateDrama", minute: insertMinute });
    }
  }
  events.sort((a, b) => {
    if (a.minute !== b.minute) return a.minute - b.minute;
    return (a.kind === "goal" ? 0 : 1) - (b.kind === "goal" ? 0 : 1);
  });

  let chanceIdx = 0;
  for (const event of events) {
    if (event.kind === "goal") {
      if (event.side === "user") {
        userScore += 1;
        const score = scoreStr(userScore, oppScore);
        beats.push({
          minute: event.minute,
          type: "goal",
          commentary: say(runPhrases.goal, { scorer: event.scorer, score }),
          scorer: event.scorer,
          scoreAtBeat: [userScore, oppScore],
        });
        // onGoal card firings ride the goal they fired on
        while (
          goalFiringCursor < goalFirings.length &&
          goalFirings[goalFiringCursor]!.minute === event.minute
        ) {
          const firing = goalFirings[goalFiringCursor]!;
          goalFiringCursor += 1;
          beats.push({
            minute: event.minute,
            type: "cardFire",
            commentary: firing.label,
            scoreAtBeat: [userScore, oppScore],
            firing,
          });
        }
      } else {
        oppScore += 1;
        const score = scoreStr(userScore, oppScore);
        beats.push({
          minute: event.minute,
          type: "oppGoal",
          commentary: say(runPhrases.oppGoal, { minute: String(event.minute), score }),
          scorer: event.scorer,
          scoreAtBeat: [userScore, oppScore],
        });
      }
    } else if (event.kind === "chance") {
      const isOpp = chanceIdx % 2 === 1;
      chanceIdx += 1;
      if (isOpp) {
        beats.push({
          minute: event.minute,
          type: "oppChance",
          commentary: say(runPhrases.oppChance, { gk: gkName }),
          scoreAtBeat: [userScore, oppScore],
        });
      } else {
        const player =
          chancePool.length > 0
            ? chancePool[hashSeed(`${seed}-chance-player-${phraseIndex}`) % chancePool.length]!
            : "nosso camisa 10";
        beats.push({
          minute: event.minute,
          type: "chance",
          commentary: say(runPhrases.chance, { player }),
          scoreAtBeat: [userScore, oppScore],
        });
      }
    } else if (event.kind === "halftime") {
      beats.push({
        minute: 45,
        type: "halftime",
        commentary: say(runPhrases.halftime, { score: scoreStr(userScore, oppScore) }),
        scoreAtBeat: [userScore, oppScore],
      });
    } else {
      beats.push({
        minute: event.minute,
        type: "lateDrama",
        commentary: say(runPhrases.lateDrama, { score: scoreStr(userScore, oppScore) }),
        scoreAtBeat: [userScore, oppScore],
      });
    }
  }

  // ── Fulltime
  const finalScore: [number, number] = [userScore, oppScore];
  beats.push({
    minute: 90,
    type: "fulltime",
    commentary: say(runPhrases.fulltime, { score: scoreStr(userScore, oppScore) }),
    scoreAtBeat: finalScore,
  });

  // ── Tail: shootout drama + result/shootout firings, in firing order.
  //    The narrative shootout beat lands right before the first
  //    shootout-moment firing (Catimba), or right after fulltime otherwise.
  const tailFirings = cardFirings.filter((f) => f.moment === "result" || f.moment === "shootout");
  const hadShootout = result.viaPenalties || tailFirings.some((f) => f.moment === "shootout");
  const shootoutBeat = (): RunMatchBeat => ({
    minute: 90,
    type: "shootout",
    commentary: say(
      result.viaPenalties
        ? result.outcome === "win"
          ? runPhrases.shootoutWin
          : runPhrases.shootoutLoss
        : runPhrases.shootoutDraw,
    ),
    scoreAtBeat: finalScore,
  });

  let shootoutEmitted = false;
  for (const firing of tailFirings) {
    if (hadShootout && !shootoutEmitted && firing.moment === "shootout") {
      beats.push(shootoutBeat());
      shootoutEmitted = true;
    }
    beats.push({ minute: 90, type: "cardFire", commentary: firing.label, scoreAtBeat: finalScore, firing });
  }
  if (hadShootout && !shootoutEmitted) {
    // Penalties without a Catimba firing (drawn mata-mata) — announce anyway.
    beats.push(shootoutBeat());
  }

  return beats;
}
