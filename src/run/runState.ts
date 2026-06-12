/**
 * Run state machine — the seeded, replayable run core (Phase A1, spec §3.1).
 *
 * A run is a fold over a decisions log:
 *
 *   startRun(seed, mode, opts) → shop ⇄ match → … → dead | champion
 *   applyDecision(state, d)    → new state (pure, throws on illegal moves)
 *   replayRun(seed, mode, log) → identical final state (anti-forgery basis)
 *
 * Determinism bookkeeping: EVERY random draw derives from
 * `hashSeed(`${seed}:${stream}:${counter}`)` with per-stream counters stored
 * in state and advanced only by decisions. The streams:
 *
 *   "dice"           → club offer index per dice roll/reroll
 *   "cardOffer"      → shop card offer count + picks
 *   `match:${stage}` → seedStream handed to playRunMatch (stageIndex is the
 *                      counter — each stage plays exactly once)
 *
 * Same seed + same decisions ⇒ byte-identical run. Different seed ⇒ different
 * dice, different card offers, different matches.
 */

import { hashSeed, compareByCodePoint } from "../engine/random";
import { canFill } from "../positionFit";
import { nationPools } from "../data/nations";
import type { NationPlayer } from "../types";
import {
  CARDS,
  MAX_ACTIVE_CARDS,
  evalOnShopEnter,
  getCard,
  type CardDef,
} from "./cards";
import { REROLL_COST, STARTING_COINS, matchCoins, sellValue, signingCost, type CoinBreakdown } from "./economy";
import { generateJourneymen } from "./journeymen";
import { playRunMatch } from "./playRunMatch";
import { scoreMatch, type ScoreBreakdown } from "./runScoring";
import {
  FORMATIONS,
  type CardFiring,
  type FormationId,
  type RunMatchResult,
  type Squad,
  type StageDef,
} from "./types";

// ---------------------------------------------------------------------------
// Competition definition — modes plug stage lists into the shared engine.
// Phase B ships the real Libertadores def; Phase A ships TEST_COMPETITION.
// ---------------------------------------------------------------------------

/** Group-stage points (win/draw) toward qualification. */
export const GROUP_WIN_POINTS = 3;
export const GROUP_DRAW_POINTS = 1;

export interface GroupRule {
  /** Stage ids forming the group, in play order. */
  stageIds: string[];
  /** Points required when the LAST group stage ends, or the run dies. */
  qualifyPoints: number;
}

export interface CompetitionDef {
  id: string;
  label: string;
  /** Played in order; index = RunState.stageIndex. Last stage won → champion. */
  stages: StageDef[];
  /** Optional group qualification gate (groups tolerate losses; mata-mata doesn't). */
  groupRule?: GroupRule;
  /** Dice-draft source override (Phase B: Libertadores club rosters). */
  draftSource?: DraftSource;
}

// ---------------------------------------------------------------------------
// Draft source — what the dice rolls. Default: the v1 nation pools.
// ---------------------------------------------------------------------------

export interface DraftOffer {
  id: string;
  /** What the dice face shows, e.g. "Brazil" (Phase B: "Santos 1962-63"). */
  label: string;
  players: NationPlayer[];
}

export interface DraftSource {
  offerCount: number;
  getOffer(index: number): DraftOffer;
}

function buildNationDraftSource(): DraftSource {
  const keys = Object.keys(nationPools).sort(compareByCodePoint);
  return {
    offerCount: keys.length,
    getOffer(index: number): DraftOffer {
      const key = keys[index];
      if (key === undefined) throw new Error(`Draft offer index out of range: ${index}`);
      return {
        id: key,
        label: key === "wildcards" ? "Lendas do Mundo" : key,
        players: nationPools[key]!,
      };
    },
  };
}

/** Default dice source: one offer per nation pool (stable order). */
export const NATION_DRAFT_SOURCE: DraftSource = buildNationDraftSource();

// ---------------------------------------------------------------------------
// Test competition fixture — 2 group stages + 2 knockout stages.
// ---------------------------------------------------------------------------

export const TEST_COMPETITION: CompetitionDef = {
  id: "copa-teste",
  label: "Copa de Teste",
  stages: [
    {
      id: "g1",
      label: "Grupo — Jogo 1",
      opponent: { name: "Galáticos da Esquina", rating: 55, flavor: "várzea ilustrada", country: "Argentina" },
      homeAway: "home",
      elimination: false,
      completionBonus: 2,
    },
    {
      id: "g2",
      label: "Grupo — Jogo 2",
      opponent: { name: "Unidos da Altitude", rating: 58, flavor: "3.600m de raça", altitude: true },
      homeAway: "away",
      elimination: false,
      completionBonus: 2,
    },
    {
      id: "semi",
      label: "Semifinal",
      opponent: { name: "Tubarões do Litoral", rating: 60, flavor: "tradição copeira" },
      homeAway: "home",
      elimination: true,
      completionBonus: 3,
    },
    {
      id: "final",
      label: "FINAL",
      opponent: { name: "Império do Sul", rating: 63, flavor: "o chefão da taça" },
      homeAway: "away",
      elimination: true,
      completionBonus: 5,
    },
  ],
  groupRule: { stageIds: ["g1", "g2"], qualifyPoints: 2 },
};

// ---------------------------------------------------------------------------
// Run state
// ---------------------------------------------------------------------------

export type RunMode = "libertadores" | "campanha";
export type RunPhase = "shop" | "match" | "dead" | "champion";

export interface ShopState {
  /** Current dice result: 0 before rolling, 1 offer (2 with Maluquice). */
  diceOffers: DraftOffer[];
  rolled: boolean;
  rerollsUsed: number;
  /** Olheiro active: first reroll of this shop is free. */
  freeReroll: boolean;
  /** Maluquice active: each roll reveals 2 clubs. */
  dualRoll: boolean;
  cardOffers: CardDef[];
  /** Set by sign/skipSign — ONE signing per shop, then the draft closes. */
  signClosed: boolean;
  boughtCardThisShop: boolean;
  /** onShopEnter card popups (Olheiro/Maluquice), for the UI. */
  enterFirings: Array<{ cardId: string; label: string }>;
}

export type RunDecision =
  | { type: "roll" }
  | { type: "reroll" }
  | { type: "sign"; playerId: string; slotId: string }
  | { type: "skipSign" }
  | { type: "buyCard"; cardId: string }
  | { type: "sellCard"; cardId: string }
  | { type: "kickoff" }
  | { type: "advance" };

/** One finished match: result + the legibility receipts. */
export interface MatchRecord {
  stageId: string;
  result: RunMatchResult;
  cardFirings: CardFiring[];
  coinBreakdown: CoinBreakdown;
  scoreBreakdown: ScoreBreakdown;
}

export interface RunState {
  mode: RunMode;
  seed: string;
  competition: CompetitionDef;
  stageIndex: number;
  phase: RunPhase;
  squad: Squad;
  /** Active cards, max MAX_ACTIVE_CARDS. */
  cards: CardDef[];
  coins: number;
  score: number;
  /** Group-stage qualification points (win 3 / draw 1). */
  groupPoints: number;
  /** Score + coin breakdowns per played match, in order. */
  matchHistory: MatchRecord[];
  decisionsLog: RunDecision[];
  /** Players signed during the run (everyone except journeymen). */
  signedPlayerIds: ReadonlySet<string>;
  /** Draw-cursor bookkeeping: stream → next counter (determinism). */
  drawCounters: { dice: number; cardOffer: number };
  /** Present iff phase === "shop". */
  shop: ShopState | null;
}

export interface StartRunOptions {
  formation?: FormationId;
  /** Defaults to TEST_COMPETITION until Phase B ships the real defs. */
  competition?: CompetitionDef;
}

// ---------------------------------------------------------------------------
// Seeded draws
// ---------------------------------------------------------------------------

function drawHash(seed: string, stream: string, counter: number): number {
  return hashSeed(`${seed}:${stream}:${counter}`);
}

function draftSourceOf(state: RunState): DraftSource {
  return state.competition.draftSource ?? NATION_DRAFT_SOURCE;
}

// ---------------------------------------------------------------------------
// Shop entry
// ---------------------------------------------------------------------------

function enterShop(
  seed: string,
  cards: CardDef[],
  counters: RunState["drawCounters"],
): { shop: ShopState; counters: RunState["drawCounters"] } {
  let cardOffer = counters.cardOffer;

  // onShopEnter hooks (Olheiro / Maluquice)
  const enterContribs = evalOnShopEnter(cards);
  const freeReroll = enterContribs.some(({ effect }) => effect.freeReroll);
  const dualRoll = enterContribs.some(({ effect }) => effect.dualRoll);
  const enterFirings = enterContribs.map(({ card, effect }) => ({
    cardId: card.id,
    label: effect.label,
  }));

  // Card offers: 2-3 seeded picks from the registry, never duplicating owned.
  const ownedIds = new Set(cards.map((c) => c.id));
  const available = CARDS.filter((c) => !ownedIds.has(c.id));
  const offerCount = Math.min(2 + (drawHash(seed, "cardOffer", cardOffer++) % 2), available.length);
  const cardOffers: CardDef[] = [];
  for (let i = 0; i < offerCount; i += 1) {
    const index = drawHash(seed, "cardOffer", cardOffer++) % available.length;
    cardOffers.push(available.splice(index, 1)[0]!);
  }

  return {
    shop: {
      diceOffers: [],
      rolled: false,
      rerollsUsed: 0,
      freeReroll,
      dualRoll,
      cardOffers,
      signClosed: false,
      boughtCardThisShop: false,
      enterFirings,
    },
    counters: { ...counters, cardOffer },
  };
}

function rollDiceOffers(state: RunState): { offers: DraftOffer[]; counters: RunState["drawCounters"] } {
  const source = draftSourceOf(state);
  let dice = state.drawCounters.dice;
  const first = drawHash(state.seed, "dice", dice++) % source.offerCount;
  const indices = [first];
  if (state.shop!.dualRoll && source.offerCount > 1) {
    const second = drawHash(state.seed, "dice", dice++) % source.offerCount;
    // Maluquice shows two DISTINCT clubs.
    indices.push(second === first ? (second + 1) % source.offerCount : second);
  }
  return {
    offers: indices.map((i) => source.getOffer(i)),
    counters: { ...state.drawCounters, dice },
  };
}

// ---------------------------------------------------------------------------
// startRun / applyDecision / replayRun
// ---------------------------------------------------------------------------

export function startRun(seed: string, mode: RunMode, options: StartRunOptions = {}): RunState {
  const formation = options.formation ?? "4-3-3";
  const competition = options.competition ?? TEST_COMPETITION;
  if (competition.stages.length === 0) throw new Error("CompetitionDef needs at least one stage");

  const cards: CardDef[] = [];
  const { shop, counters } = enterShop(seed, cards, { dice: 0, cardOffer: 0 });

  return {
    mode,
    seed,
    competition,
    stageIndex: 0,
    phase: "shop",
    squad: { formation, slots: generateJourneymen(seed, formation) },
    cards,
    coins: STARTING_COINS,
    score: 0,
    groupPoints: 0,
    matchHistory: [],
    decisionsLog: [],
    signedPlayerIds: new Set(),
    drawCounters: counters,
    shop,
  };
}

function illegal(decision: RunDecision, reason: string): never {
  throw new Error(`Illegal decision "${decision.type}": ${reason}`);
}

function requireShop(state: RunState, decision: RunDecision): ShopState {
  if (state.phase !== "shop" || !state.shop) {
    illegal(decision, `not in shop phase (phase is "${state.phase}")`);
  }
  return state.shop;
}

function withLog(state: RunState, decision: RunDecision): RunState {
  return { ...state, decisionsLog: [...state.decisionsLog, decision] };
}

export function applyDecision(state: RunState, decision: RunDecision): RunState {
  switch (decision.type) {
    case "roll": {
      const shop = requireShop(state, decision);
      if (shop.rolled) illegal(decision, "dice already rolled this shop — use reroll");
      if (shop.signClosed) illegal(decision, "signing window is closed for this shop");
      const { offers, counters } = rollDiceOffers(state);
      return withLog(
        { ...state, drawCounters: counters, shop: { ...shop, rolled: true, diceOffers: offers } },
        decision,
      );
    }

    case "reroll": {
      const shop = requireShop(state, decision);
      if (!shop.rolled) illegal(decision, "roll the dice before rerolling");
      if (shop.signClosed) illegal(decision, "signing window is closed for this shop");
      const free = shop.freeReroll && shop.rerollsUsed === 0;
      const cost = free ? 0 : REROLL_COST;
      if (state.coins < cost) {
        illegal(decision, `not enough coins (reroll costs ${cost}, you have ${state.coins})`);
      }
      const { offers, counters } = rollDiceOffers(state);
      return withLog(
        {
          ...state,
          coins: state.coins - cost,
          drawCounters: counters,
          shop: { ...shop, diceOffers: offers, rerollsUsed: shop.rerollsUsed + 1 },
        },
        decision,
      );
    }

    case "sign": {
      const shop = requireShop(state, decision);
      if (!shop.rolled) illegal(decision, "roll the dice before signing");
      if (shop.signClosed) illegal(decision, "already signed (or skipped) this shop — one signing per shop");

      const player = shop.diceOffers
        .flatMap((offer) => offer.players)
        .find((p) => p.id === decision.playerId);
      if (!player) illegal(decision, `player "${decision.playerId}" is not in the current dice offers`);

      const slot = FORMATIONS[state.squad.formation].find((s) => s.slotId === decision.slotId);
      if (!slot) illegal(decision, `unknown slot "${decision.slotId}" in formation ${state.squad.formation}`);
      if (!canFill(player, { slotId: slot.slotId, position: slot.position })) {
        illegal(
          decision,
          `${player.displayName} (${player.positions.join("/")}) cannot fill slot ${slot.slotId} (${slot.position})`,
        );
      }

      const occupants = new Set([...state.squad.slots.values()].map((p) => p.id));
      if (occupants.has(player.id)) illegal(decision, `${player.displayName} is already in your squad`);

      const cost = signingCost(player.costTier);
      if (state.coins < cost) {
        illegal(decision, `not enough coins (${player.displayName} costs ${cost}, you have ${state.coins})`);
      }

      const slots = new Map(state.squad.slots);
      slots.set(slot.slotId, player);
      return withLog(
        {
          ...state,
          coins: state.coins - cost,
          squad: { ...state.squad, slots },
          signedPlayerIds: new Set([...state.signedPlayerIds, player.id]),
          shop: { ...shop, signClosed: true },
        },
        decision,
      );
    }

    case "skipSign": {
      const shop = requireShop(state, decision);
      if (shop.signClosed) illegal(decision, "signing window is already closed for this shop");
      return withLog({ ...state, shop: { ...shop, signClosed: true } }, decision);
    }

    case "buyCard": {
      const shop = requireShop(state, decision);
      const card = getCard(decision.cardId);
      if (!shop.cardOffers.some((c) => c.id === card.id)) {
        illegal(decision, `${card.name} is not on offer in this shop`);
      }
      if (state.cards.some((c) => c.id === card.id)) illegal(decision, `you already own ${card.name}`);
      if (state.cards.length >= MAX_ACTIVE_CARDS) {
        illegal(decision, `card limit reached (${MAX_ACTIVE_CARDS} active) — sell one first`);
      }
      if (state.coins < card.price) {
        illegal(decision, `not enough coins (${card.name} costs ${card.price}, you have ${state.coins})`);
      }
      return withLog(
        {
          ...state,
          coins: state.coins - card.price,
          cards: [...state.cards, card],
          shop: {
            ...shop,
            cardOffers: shop.cardOffers.filter((c) => c.id !== card.id),
            boughtCardThisShop: true,
          },
        },
        decision,
      );
    }

    case "sellCard": {
      requireShop(state, decision);
      const card = state.cards.find((c) => c.id === decision.cardId);
      if (!card) illegal(decision, `you do not own card "${decision.cardId}"`);
      return withLog(
        {
          ...state,
          coins: state.coins + sellValue(card.price),
          cards: state.cards.filter((c) => c.id !== card.id),
        },
        decision,
      );
    }

    case "kickoff": {
      const shop = requireShop(state, decision);
      const stage = state.competition.stages[state.stageIndex]!;

      const seedStream = `${state.seed}:match:${state.stageIndex}`;
      const { result, cardFirings } = playRunMatch(state.squad, state.cards, stage.opponent, {
        homeAway: stage.homeAway,
        stage,
        seedStream,
        boughtCardThisShop: shop.boughtCardThisShop,
        signedPlayerIds: state.signedPlayerIds,
      });

      const matchCtx = { stage, homeAway: stage.homeAway, squad: state.squad };
      const coinBreakdown = matchCoins(result, state.cards, matchCtx);
      const scoreBreakdown = scoreMatch(result, state.cards, matchCtx);

      let groupPoints = state.groupPoints;
      if (!stage.elimination) {
        groupPoints +=
          result.outcome === "win" ? GROUP_WIN_POINTS : result.outcome === "draw" ? GROUP_DRAW_POINTS : 0;
      }

      // Phase transition: mata-mata loss kills; group-end shortfall kills;
      // final-stage survival crowns; otherwise post-match review.
      let phase: RunPhase = "match";
      if (stage.elimination && result.outcome === "loss") {
        phase = "dead";
      } else {
        const rule = state.competition.groupRule;
        const groupEnds = rule && rule.stageIds[rule.stageIds.length - 1] === stage.id;
        if (groupEnds && groupPoints < rule.qualifyPoints) {
          phase = "dead";
        } else if (state.stageIndex === state.competition.stages.length - 1) {
          phase = "champion";
        }
      }

      const record: MatchRecord = { stageId: stage.id, result, cardFirings, coinBreakdown, scoreBreakdown };
      return withLog(
        {
          ...state,
          phase,
          coins: state.coins + coinBreakdown.total,
          score: state.score + scoreBreakdown.total,
          groupPoints,
          matchHistory: [...state.matchHistory, record],
          shop: null,
        },
        decision,
      );
    }

    case "advance": {
      if (state.phase !== "match") {
        illegal(decision, `nothing to advance from (phase is "${state.phase}")`);
      }
      const stageIndex = state.stageIndex + 1;
      const { shop, counters } = enterShop(state.seed, state.cards, state.drawCounters);
      return withLog(
        { ...state, stageIndex, phase: "shop", drawCounters: counters, shop },
        decision,
      );
    }
  }
}

/**
 * Replay a run from its seed + decisions log. Deterministic: this is the
 * anti-forgery foundation — the server replays the log and compares scores.
 */
export function replayRun(
  seed: string,
  mode: RunMode,
  decisions: readonly RunDecision[],
  options: StartRunOptions = {},
): RunState {
  return decisions.reduce(applyDecision, startRun(seed, mode, options));
}
