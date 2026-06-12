import { describe, expect, it } from "vitest";
import { compareByCodePoint } from "../engine/random";
import { nationPools } from "../data/nations";
import { bucketForPosition } from "../teamStrength";
import { canFill } from "../positionFit";
import { MAX_ACTIVE_CARDS, getCard, type CardDef } from "./cards";
import { REROLL_COST, STARTING_COINS, sellValue, signingCost } from "./economy";
import { isJourneyman } from "./journeymen";
import {
  GROUP_DRAW_POINTS,
  GROUP_WIN_POINTS,
  TEST_COMPETITION,
  applyDecision,
  replayRun,
  startRun,
  type CompetitionDef,
  type RunDecision,
  type RunState,
  type ShopState,
} from "./runState";
import { FORMATIONS } from "./types";

// ---------------------------------------------------------------------------
// Fixtures + helpers
// ---------------------------------------------------------------------------

const BRUTAL_COMPETITION: CompetitionDef = {
  id: "morte-subita",
  label: "Morte Súbita",
  stages: [
    {
      id: "boss",
      label: "Chefão",
      opponent: { name: "Esquadrão Imortal", rating: 99, flavor: "imbatível" },
      homeAway: "away",
      elimination: true,
      completionBonus: 0,
    },
  ],
};

/** TEST_COMPETITION but with an impossible group target (max is 6 points). */
const GROUP_WALL_COMPETITION: CompetitionDef = {
  ...TEST_COMPETITION,
  id: "muro-do-grupo",
  groupRule: { stageIds: ["g1", "g2"], qualifyPoints: 7 },
};

function shopOf(state: RunState): ShopState {
  if (!state.shop) throw new Error("expected shop state");
  return state.shop;
}

/** A real player from the nation pools matching a predicate. */
function poolPlayer(pred: (p: import("../types").NationPlayer) => boolean) {
  const player = Object.values(nationPools)
    .flat()
    .find(pred);
  if (!player) throw new Error("no pool player matches predicate");
  return player;
}

/** Patch the current shop's dice offers with a hand-picked offer (test rig). */
function withDiceOffer(state: RunState, players: import("../types").NationPlayer[]): RunState {
  return {
    ...state,
    shop: {
      ...shopOf(state),
      rolled: true,
      diceOffers: [{ id: "rigged", label: "Time de Teste", players }],
    },
  };
}

/** Deterministic greedy bot: buy cheapest card, roll, sign best upgrade, kickoff. */
function greedyDecide(state: RunState): RunDecision {
  if (state.phase === "match") return { type: "advance" };
  const shop = shopOf(state);

  if (!shop.boughtCardThisShop && state.cards.length < MAX_ACTIVE_CARDS) {
    const affordable = shop.cardOffers
      .filter((c) => c.price <= state.coins && !state.cards.some((o) => o.id === c.id))
      .sort((a, b) => a.price - b.price || compareByCodePoint(a.id, b.id));
    if (affordable.length > 0) return { type: "buyCard", cardId: affordable[0]!.id };
  }

  if (!shop.rolled && !shop.signClosed) return { type: "roll" };

  if (!shop.signClosed) {
    let best: { playerId: string; slotId: string; gain: number } | null = null;
    const occupants = new Set([...state.squad.slots.values()].map((p) => p.id));
    for (const offer of shop.diceOffers) {
      for (const player of offer.players) {
        if (occupants.has(player.id) || signingCost(player.costTier) > state.coins) continue;
        for (const slot of FORMATIONS[state.squad.formation]) {
          if (!canFill(player, { slotId: slot.slotId, position: slot.position })) continue;
          const bucket = bucketForPosition(slot.position);
          const gain = player[bucket] - state.squad.slots.get(slot.slotId)![bucket];
          if (
            gain > 0 &&
            (!best ||
              gain > best.gain ||
              (gain === best.gain &&
                compareByCodePoint(player.id + slot.slotId, best.playerId + best.slotId) < 0))
          ) {
            best = { playerId: player.id, slotId: slot.slotId, gain };
          }
        }
      }
    }
    if (best) return { type: "sign", playerId: best.playerId, slotId: best.slotId };
    return { type: "skipSign" };
  }

  return { type: "kickoff" };
}

interface GreedyRun {
  final: RunState;
  decisions: RunDecision[];
  /** State snapshot AFTER each decision (parallel to `decisions`). */
  steps: RunState[];
}

function playGreedy(seed: string, competition = TEST_COMPETITION): GreedyRun {
  let state = startRun(seed, "libertadores", { competition });
  const decisions: RunDecision[] = [];
  const steps: RunState[] = [];
  for (let i = 0; i < 200 && (state.phase === "shop" || state.phase === "match"); i += 1) {
    const decision = greedyDecide(state);
    state = applyDecision(state, decision);
    decisions.push(decision);
    steps.push(state);
  }
  return { final: state, decisions, steps };
}

function findSeed(pred: (seed: string) => boolean, prefix: string, max = 500): string {
  for (let i = 0; i < max; i += 1) {
    const seed = `${prefix}-${i}`;
    if (pred(seed)) return seed;
  }
  throw new Error(`no seed found for ${prefix} within ${max} tries`);
}

// ---------------------------------------------------------------------------
// startRun
// ---------------------------------------------------------------------------

describe("startRun", () => {
  it("opens the first shop with journeymen, 3 coins and an empty log", () => {
    const state = startRun("alpha", "libertadores");
    expect(state.phase).toBe("shop");
    expect(state.stageIndex).toBe(0);
    expect(state.coins).toBe(STARTING_COINS);
    expect(state.score).toBe(0);
    expect(state.groupPoints).toBe(0);
    expect(state.cards).toEqual([]);
    expect(state.decisionsLog).toEqual([]);
    expect(state.matchHistory).toEqual([]);
    expect(state.signedPlayerIds.size).toBe(0);
    expect(state.squad.slots.size).toBe(11);
    for (const player of state.squad.slots.values()) {
      expect(isJourneyman(player.id)).toBe(true);
    }
    const shop = shopOf(state);
    expect(shop.rolled).toBe(false);
    expect(shop.diceOffers).toEqual([]);
    expect(shop.cardOffers.length).toBeGreaterThanOrEqual(2);
    expect(shop.cardOffers.length).toBeLessThanOrEqual(3);
  });

  it("is deterministic: same seed produces an identical state", () => {
    expect(startRun("alpha", "libertadores")).toEqual(startRun("alpha", "libertadores"));
  });

  it("supports other formations", () => {
    const state = startRun("alpha", "campanha", { formation: "3-5-2" });
    expect(state.squad.formation).toBe("3-5-2");
    expect(state.squad.slots.size).toBe(11);
  });
});

// ---------------------------------------------------------------------------
// Shop determinism + seed divergence
// ---------------------------------------------------------------------------

describe("shop determinism", () => {
  it("same seed → same card offers and same dice roll", () => {
    const a = applyDecision(startRun("det", "libertadores"), { type: "roll" });
    const b = applyDecision(startRun("det", "libertadores"), { type: "roll" });
    expect(shopOf(a).cardOffers.map((c) => c.id)).toEqual(shopOf(b).cardOffers.map((c) => c.id));
    expect(shopOf(a).diceOffers.map((o) => o.id)).toEqual(shopOf(b).diceOffers.map((o) => o.id));
    expect(a).toEqual(b);
  });

  it("different seeds diverge in shop offers", () => {
    const fingerprint = (seed: string) => {
      const state = applyDecision(startRun(seed, "libertadores"), { type: "roll" });
      const shop = shopOf(state);
      return JSON.stringify([shop.cardOffers.map((c) => c.id), shop.diceOffers.map((o) => o.id)]);
    };
    const base = fingerprint("div-0");
    const diverges = Array.from({ length: 10 }, (_, i) => fingerprint(`div-${i + 1}`)).some(
      (fp) => fp !== base,
    );
    expect(diverges).toBe(true);
  });

  it("different seeds diverge in match outcomes", () => {
    const scores = Array.from({ length: 12 }, (_, i) => {
      const state = applyDecision(startRun(`mdiv-${i}`, "libertadores"), { type: "kickoff" });
      return state.score;
    });
    expect(new Set(scores).size).toBeGreaterThan(1);
  });

  it("dice draws advance the cursor: roll then reroll give independent draws", () => {
    let state = startRun("cursor", "libertadores");
    expect(state.drawCounters.dice).toBe(0);
    state = applyDecision(state, { type: "roll" });
    expect(state.drawCounters.dice).toBe(1);
    state = applyDecision(state, { type: "reroll" });
    expect(state.drawCounters.dice).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Dice: roll / reroll / Olheiro / Maluquice
// ---------------------------------------------------------------------------

describe("dice draft", () => {
  it("roll reveals one club offer with players", () => {
    const state = applyDecision(startRun("dice", "libertadores"), { type: "roll" });
    const shop = shopOf(state);
    expect(shop.rolled).toBe(true);
    expect(shop.diceOffers).toHaveLength(1);
    expect(shop.diceOffers[0]!.players.length).toBeGreaterThan(0);
  });

  it("rolling twice is illegal — use reroll", () => {
    const state = applyDecision(startRun("dice", "libertadores"), { type: "roll" });
    expect(() => applyDecision(state, { type: "roll" })).toThrow(/already rolled/);
  });

  it("reroll before rolling is illegal", () => {
    expect(() => applyDecision(startRun("dice", "libertadores"), { type: "reroll" })).toThrow(
      /roll the dice before/,
    );
  });

  it("reroll costs coins", () => {
    let state = applyDecision(startRun("dice", "libertadores"), { type: "roll" });
    state = applyDecision(state, { type: "reroll" });
    expect(state.coins).toBe(STARTING_COINS - REROLL_COST);
    expect(shopOf(state).rerollsUsed).toBe(1);
  });

  it("reroll beyond your coins is illegal", () => {
    let state = applyDecision(startRun("dice", "libertadores"), { type: "roll" });
    state = { ...state, coins: REROLL_COST - 1 };
    expect(() => applyDecision(state, { type: "reroll" })).toThrow(/not enough coins/);
  });

  it("Olheiro makes the first reroll of each shop free (via onShopEnter)", () => {
    // Real flow: own Olheiro, finish a match, advance → next shop has the perk.
    let state = startRun("olheiro", "libertadores");
    state = { ...state, cards: [getCard("olheiro")] };
    state = applyDecision(state, { type: "kickoff" });
    expect(state.phase).toBe("match");
    state = applyDecision(state, { type: "advance" });
    expect(shopOf(state).freeReroll).toBe(true);
    expect(shopOf(state).enterFirings.map((f) => f.cardId)).toContain("olheiro");

    state = applyDecision(state, { type: "roll" });
    const coinsBefore = state.coins;
    state = applyDecision(state, { type: "reroll" });
    expect(state.coins).toBe(coinsBefore); // first one free
    state = applyDecision(state, { type: "reroll" });
    expect(state.coins).toBe(coinsBefore - REROLL_COST); // second one paid
  });

  it("Maluquice rolls two distinct clubs", () => {
    let state = startRun("maluquice", "libertadores");
    state = { ...state, cards: [getCard("maluquice")] };
    state = applyDecision(state, { type: "kickoff" });
    state = applyDecision(state, { type: "advance" });
    expect(shopOf(state).dualRoll).toBe(true);
    state = applyDecision(state, { type: "roll" });
    const offers = shopOf(state).diceOffers;
    expect(offers).toHaveLength(2);
    expect(offers[0]!.id).not.toBe(offers[1]!.id);
  });
});

// ---------------------------------------------------------------------------
// Signing
// ---------------------------------------------------------------------------

describe("signing", () => {
  const keeper = poolPlayer((p) => p.positions.includes("GOL") && p.costTier <= 2);
  const star = poolPlayer((p) => p.costTier === 5);

  it("signs a position-compatible player into a slot, paying tier cost", () => {
    const base = withDiceOffer(startRun("sign", "libertadores"), [keeper]);
    const state = applyDecision(base, { type: "sign", playerId: keeper.id, slotId: "GOL" });
    expect(state.squad.slots.get("GOL")!.id).toBe(keeper.id);
    expect(state.coins).toBe(STARTING_COINS - signingCost(keeper.costTier));
    expect(state.signedPlayerIds.has(keeper.id)).toBe(true);
    expect(shopOf(state).signClosed).toBe(true);
    // purity: the input state was not mutated
    expect(isJourneyman(base.squad.slots.get("GOL")!.id)).toBe(true);
    expect(base.signedPlayerIds.size).toBe(0);
    expect(shopOf(base).signClosed).toBe(false);
  });

  it("rejects position-incompatible signings (canFill)", () => {
    const base = withDiceOffer(startRun("sign", "libertadores"), [keeper]);
    expect(() => applyDecision(base, { type: "sign", playerId: keeper.id, slotId: "CA" })).toThrow(
      /cannot fill slot CA/,
    );
  });

  it("rejects over-budget signings", () => {
    const slotId = FORMATIONS["4-3-3"].find((s) => star.positions.includes(s.position))?.slotId;
    if (!slotId) throw new Error("fixture star has no slot in 4-3-3");
    const base = withDiceOffer(startRun("sign", "libertadores"), [star]);
    expect(() => applyDecision(base, { type: "sign", playerId: star.id, slotId })).toThrow(
      /not enough coins/,
    );
  });

  it("rejects players that are not in the dice offers", () => {
    const state = applyDecision(startRun("sign", "libertadores"), { type: "roll" });
    expect(() =>
      applyDecision(state, { type: "sign", playerId: "ghost-player", slotId: "GOL" }),
    ).toThrow(/not in the current dice offers/);
  });

  it("rejects signing before rolling and unknown slots", () => {
    const fresh = startRun("sign", "libertadores");
    expect(() => applyDecision(fresh, { type: "sign", playerId: keeper.id, slotId: "GOL" })).toThrow(
      /roll the dice before signing/,
    );
    const rigged = withDiceOffer(fresh, [keeper]);
    expect(() =>
      applyDecision(rigged, { type: "sign", playerId: keeper.id, slotId: "NOPE" }),
    ).toThrow(/unknown slot/);
  });

  it("allows only ONE signing per shop; skipSign also closes the draft", () => {
    const base = withDiceOffer(startRun("sign", "libertadores"), [keeper]);
    const signed = applyDecision(base, { type: "sign", playerId: keeper.id, slotId: "GOL" });
    expect(() =>
      applyDecision(signed, { type: "sign", playerId: keeper.id, slotId: "GOL" }),
    ).toThrow(/one signing per shop/);
    expect(() => applyDecision(signed, { type: "reroll" })).toThrow(/closed/);

    const skipped = applyDecision(base, { type: "skipSign" });
    expect(shopOf(skipped).signClosed).toBe(true);
    expect(() =>
      applyDecision(skipped, { type: "sign", playerId: keeper.id, slotId: "GOL" }),
    ).toThrow(/one signing per shop/);
    expect(() => applyDecision(skipped, { type: "skipSign" })).toThrow(/already closed/);
  });

  it("rejects signing a player who is already in the squad", () => {
    const base = withDiceOffer(startRun("sign", "libertadores"), [keeper]);
    const signed = applyDecision(base, { type: "sign", playerId: keeper.id, slotId: "GOL" });
    const reopened: RunState = {
      ...withDiceOffer(signed, [keeper]),
      shop: { ...shopOf(withDiceOffer(signed, [keeper])), signClosed: false },
    };
    expect(() =>
      applyDecision(reopened, { type: "sign", playerId: keeper.id, slotId: "GOL" }),
    ).toThrow(/already in your squad/);
  });
});

// ---------------------------------------------------------------------------
// Cards: buy / sell
// ---------------------------------------------------------------------------

describe("card shop", () => {
  function richShop(seed = "cards"): RunState {
    return { ...startRun(seed, "libertadores"), coins: 50 };
  }

  it("buys an offered card: coins down, card active, offer removed", () => {
    const base = richShop();
    const offer = shopOf(base).cardOffers[0]!;
    const state = applyDecision(base, { type: "buyCard", cardId: offer.id });
    expect(state.cards.map((c) => c.id)).toContain(offer.id);
    expect(state.coins).toBe(50 - offer.price);
    expect(shopOf(state).cardOffers.map((c) => c.id)).not.toContain(offer.id);
    expect(shopOf(state).boughtCardThisShop).toBe(true);
    // purity
    expect(base.cards).toEqual([]);
    expect(shopOf(base).cardOffers.map((c) => c.id)).toContain(offer.id);
  });

  it("rejects cards that are not on offer", () => {
    const base = richShop();
    const notOffered = ["catimba", "maestro", "caldeirao", "muralha", "olheiro"].find(
      (id) => !shopOf(base).cardOffers.some((c) => c.id === id),
    )!;
    expect(() => applyDecision(base, { type: "buyCard", cardId: notOffered })).toThrow(
      /not on offer/,
    );
    expect(() => applyDecision(base, { type: "buyCard", cardId: "carta-fantasma" })).toThrow(
      /Unknown card/,
    );
  });

  it("rejects over-budget purchases", () => {
    const base = { ...richShop(), coins: 0 };
    const offer = shopOf(base).cardOffers[0]!;
    expect(() => applyDecision(base, { type: "buyCard", cardId: offer.id })).toThrow(
      /not enough coins/,
    );
  });

  it("rejects a 6th active card", () => {
    const base = richShop();
    const offer = shopOf(base).cardOffers[0]!;
    const five: CardDef[] = ["catimba", "maestro", "caldeirao", "muralha", "olheiro", "paredao"]
      .filter((id) => id !== offer.id)
      .slice(0, MAX_ACTIVE_CARDS)
      .map(getCard);
    const full: RunState = { ...base, cards: five };
    expect(() => applyDecision(full, { type: "buyCard", cardId: offer.id })).toThrow(
      /card limit reached/,
    );
  });

  it("rejects buying a duplicate of an owned card", () => {
    const base = richShop();
    const offer = shopOf(base).cardOffers[0]!;
    const owned: RunState = { ...base, cards: [getCard(offer.id)] };
    expect(() => applyDecision(owned, { type: "buyCard", cardId: offer.id })).toThrow(
      /already own/,
    );
  });

  it("sells an owned card at half price; selling unowned cards is illegal", () => {
    const catimba = getCard("catimba");
    const base: RunState = { ...richShop(), cards: [catimba] };
    const state = applyDecision(base, { type: "sellCard", cardId: "catimba" });
    expect(state.cards).toEqual([]);
    expect(state.coins).toBe(50 + sellValue(catimba.price));
    expect(() => applyDecision(state, { type: "sellCard", cardId: "catimba" })).toThrow(
      /do not own/,
    );
  });

  it("card offers never duplicate owned cards on shop entry", () => {
    let state = startRun("no-dup", "libertadores");
    state = { ...state, cards: [getCard("catimba"), getCard("muralha"), getCard("olheiro")] };
    state = applyDecision(state, { type: "kickoff" });
    state = applyDecision(state, { type: "advance" });
    const offered = shopOf(state).cardOffers.map((c) => c.id);
    for (const id of ["catimba", "muralha", "olheiro"]) {
      expect(offered).not.toContain(id);
    }
  });
});

// ---------------------------------------------------------------------------
// Match phase, outcomes and phase transitions
// ---------------------------------------------------------------------------

describe("kickoff + advance", () => {
  it("kickoff resolves the match and applies coins/score with breakdowns", () => {
    const state = applyDecision(startRun("match-1", "libertadores"), { type: "kickoff" });
    expect(state.shop).toBeNull();
    expect(state.matchHistory).toHaveLength(1);
    const record = state.matchHistory[0]!;
    expect(record.stageId).toBe("g1");
    expect(state.score).toBe(record.scoreBreakdown.total);
    expect(state.coins).toBe(STARTING_COINS + record.coinBreakdown.total);
    const expectedPoints =
      record.result.outcome === "win"
        ? GROUP_WIN_POINTS
        : record.result.outcome === "draw"
          ? GROUP_DRAW_POINTS
          : 0;
    expect(state.groupPoints).toBe(expectedPoints);
  });

  it("kickoff is deterministic for a given seed", () => {
    const a = applyDecision(startRun("match-2", "libertadores"), { type: "kickoff" });
    const b = applyDecision(startRun("match-2", "libertadores"), { type: "kickoff" });
    expect(a).toEqual(b);
  });

  it("advance moves to the next stage's shop", () => {
    let state = applyDecision(startRun("match-3", "libertadores"), { type: "kickoff" });
    expect(state.phase).toBe("match");
    state = applyDecision(state, { type: "advance" });
    expect(state.phase).toBe("shop");
    expect(state.stageIndex).toBe(1);
    expect(shopOf(state).rolled).toBe(false);
  });

  it("rejects out-of-phase decisions with clear errors", () => {
    const shop = startRun("phase", "libertadores");
    expect(() => applyDecision(shop, { type: "advance" })).toThrow(/nothing to advance/);
    const match = applyDecision(shop, { type: "kickoff" });
    expect(() => applyDecision(match, { type: "kickoff" })).toThrow(/not in shop phase/);
    expect(() => applyDecision(match, { type: "roll" })).toThrow(/not in shop phase/);
    expect(() =>
      applyDecision(match, { type: "sign", playerId: "x", slotId: "GOL" }),
    ).toThrow(/not in shop phase/);
    expect(() => applyDecision(match, { type: "buyCard", cardId: "catimba" })).toThrow(
      /not in shop phase/,
    );
  });
});

// ---------------------------------------------------------------------------
// Full run paths
// ---------------------------------------------------------------------------

describe("run paths", () => {
  it("happy path: a greedy run can take the testCompetition to champion", () => {
    const seed = findSeed((s) => playGreedy(s).final.phase === "champion", "champ");
    const { final, steps } = playGreedy(seed);
    expect(final.phase).toBe("champion");
    expect(final.matchHistory).toHaveLength(TEST_COMPETITION.stages.length);
    expect(final.matchHistory.map((m) => m.stageId)).toEqual(["g1", "g2", "semi", "final"]);
    expect(final.score).toBe(
      final.matchHistory.reduce((sum, m) => sum + m.scoreBreakdown.total, 0),
    );
    for (const step of steps) expect(step.coins).toBeGreaterThanOrEqual(0);
    // terminal: no decisions allowed
    expect(() => applyDecision(final, { type: "advance" })).toThrow(/Illegal/);
    expect(() => applyDecision(final, { type: "kickoff" })).toThrow(/Illegal/);
  });

  it("death path: losing a mata-mata match kills the run", () => {
    const seed = findSeed(
      (s) =>
        applyDecision(startRun(s, "libertadores", { competition: BRUTAL_COMPETITION }), {
          type: "kickoff",
        }).phase === "dead",
      "death",
    );
    const dead = applyDecision(startRun(seed, "libertadores", { competition: BRUTAL_COMPETITION }), {
      type: "kickoff",
    });
    expect(dead.phase).toBe("dead");
    expect(dead.matchHistory[0]!.result.outcome).toBe("loss");
    expect(() => applyDecision(dead, { type: "advance" })).toThrow(/Illegal/);
    expect(() => applyDecision(dead, { type: "roll" })).toThrow(/not in shop phase/);
  });

  it("group stages tolerate losses but missing the points target kills at group end", () => {
    let state = startRun("group-wall", "libertadores", { competition: GROUP_WALL_COMPETITION });
    state = applyDecision(state, { type: "kickoff" }); // g1: never lethal (no elimination)
    expect(state.phase).toBe("match");
    state = applyDecision(state, { type: "advance" });
    state = applyDecision(state, { type: "kickoff" }); // g2: group ends, 7 points unreachable
    expect(state.phase).toBe("dead");
    expect(state.matchHistory).toHaveLength(2);
  });

  it("a losing group match does not kill mid-group", () => {
    const seed = findSeed((s) => {
      const after = applyDecision(startRun(s, "libertadores"), { type: "kickoff" });
      return after.matchHistory[0]!.result.outcome === "loss";
    }, "group-loss");
    const after = applyDecision(startRun(seed, "libertadores"), { type: "kickoff" });
    expect(after.phase).toBe("match");
    expect(after.groupPoints).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Replay equivalence (the anti-forgery foundation)
// ---------------------------------------------------------------------------

describe("replayRun", () => {
  it("replaying the decisions log reproduces the exact final state", () => {
    const seed = findSeed((s) => playGreedy(s).final.phase === "champion", "replay");
    const { final, decisions } = playGreedy(seed);
    expect(decisions.length).toBeGreaterThan(8); // shop activity happened
    expect(decisions.some((d) => d.type === "sign")).toBe(true);
    expect(decisions.some((d) => d.type === "buyCard")).toBe(true);
    const replayed = replayRun(seed, "libertadores", decisions, { competition: TEST_COMPETITION });
    expect(replayed).toEqual(final);
    expect(replayed.decisionsLog).toEqual(decisions);
  });

  it("replaying any PREFIX of the log reproduces every intermediate state", () => {
    const { decisions, steps } = playGreedy("replay-prefix");
    for (const k of [1, Math.floor(decisions.length / 2), decisions.length]) {
      const replayed = replayRun("replay-prefix", "libertadores", decisions.slice(0, k), {
        competition: TEST_COMPETITION,
      });
      expect(replayed).toEqual(steps[k - 1]);
    }
  });

  it("the same log under a different seed produces a different run", () => {
    const a = replayRun("seed-A", "libertadores", [{ type: "kickoff" }]);
    const candidates = Array.from({ length: 10 }, (_, i) =>
      replayRun(`seed-B${i}`, "libertadores", [{ type: "kickoff" }]),
    );
    expect(candidates.some((b) => b.score !== a.score)).toBe(true);
  });

  it("replay throws on logs with illegal moves (forged logs are rejected)", () => {
    expect(() =>
      replayRun("forged", "libertadores", [{ type: "kickoff" }, { type: "kickoff" }]),
    ).toThrow(/Illegal/);
  });
});

// ---------------------------------------------------------------------------
// Cards affect runs (integration smoke)
// ---------------------------------------------------------------------------

describe("card integration", () => {
  function kickoffWith(seed: string, cards: CardDef[]): RunState {
    let state = startRun(seed, "libertadores");
    state = { ...state, cards };
    return applyDecision(state, { type: "kickoff" });
  }

  it("Catimba turns a group-stage draw into a penalty win, paying like a win", () => {
    const seed = findSeed((s) => {
      const plain = kickoffWith(s, []);
      const catimba = kickoffWith(s, [getCard("catimba")]);
      return (
        plain.matchHistory[0]!.result.outcome === "draw" &&
        catimba.matchHistory[0]!.result.outcome === "win" &&
        catimba.matchHistory[0]!.result.viaPenalties
      );
    }, "catimba");

    const plain = kickoffWith(seed, []);
    const catimba = kickoffWith(seed, [getCard("catimba")]);
    expect(catimba.matchHistory[0]!.cardFirings.some((f) => f.cardId === "catimba")).toBe(true);
    expect(catimba.groupPoints).toBe(GROUP_WIN_POINTS);
    expect(plain.groupPoints).toBe(GROUP_DRAW_POINTS);
    expect(catimba.score).toBeGreaterThan(plain.score);
    expect(
      catimba.matchHistory[0]!.coinBreakdown.lines.some((l) => l.label === "Vitória nos pênaltis"),
    ).toBe(true);
  });

  it("Bicho Pago pays +2 coins on wins (economy hook reaches the run)", () => {
    const seed = findSeed((s) => kickoffWith(s, []).matchHistory[0]!.result.outcome === "win", "bicho");
    const plain = kickoffWith(seed, []);
    const bicho = kickoffWith(seed, [getCard("bicho-pago")]);
    expect(bicho.coins).toBe(plain.coins + 2);
    expect(
      bicho.matchHistory[0]!.coinBreakdown.lines.some((l) => l.cardId === "bicho-pago"),
    ).toBe(true);
  });

  it("Caldeirão boosts home strength (preMatch hook reaches the engine)", () => {
    const seed = "caldeirao-smoke";
    const plain = kickoffWith(seed, []);
    const boosted = kickoffWith(seed, [getCard("caldeirao")]);
    expect(boosted.matchHistory[0]!.result.userStrength.overall).toBe(
      plain.matchHistory[0]!.result.userStrength.overall + 3,
    );
    expect(boosted.matchHistory[0]!.cardFirings.some((f) => f.cardId === "caldeirao")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Decision log bookkeeping
// ---------------------------------------------------------------------------

describe("decisionsLog", () => {
  it("records every applied decision in order", () => {
    let state = startRun("log", "libertadores");
    const script: RunDecision[] = [{ type: "roll" }, { type: "skipSign" }, { type: "kickoff" }];
    for (const d of script) state = applyDecision(state, d);
    expect(state.decisionsLog).toEqual(script);
  });

  it("does not record rejected decisions", () => {
    const state = startRun("log", "libertadores");
    expect(() => applyDecision(state, { type: "advance" })).toThrow();
    expect(state.decisionsLog).toEqual([]);
  });
});
