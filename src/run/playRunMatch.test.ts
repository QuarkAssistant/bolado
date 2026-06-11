import { describe, expect, it } from "vitest";
import {
  ALTITUDE_AWAY_DEBUFF,
  AWAY_DEBUFF,
  awayDebuff,
  computeRunSquadStrength,
  isGoleada,
  playRunMatch,
  type RunMatchCtx,
} from "./playRunMatch";
import { getCard } from "./cards";
import { generateJourneymen } from "./journeymen";
import type { OpponentDef, Squad, StageDef } from "./types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSquad(boost = 0): Squad {
  const slots = generateJourneymen("match-test-seed", "4-3-3");
  if (boost !== 0) {
    for (const [sid, p] of slots) {
      slots.set(sid, {
        ...p,
        attack: p.attack + boost,
        midfield: p.midfield + boost,
        defense: p.defense + boost,
      });
    }
  }
  return { formation: "4-3-3", slots };
}

const opponent: OpponentDef = { name: "Peñarol 1966", rating: 72, flavor: "garra charrúa" };
const altitudeOpponent: OpponentDef = {
  name: "Bolívar 1985",
  rating: 72,
  flavor: "fortaleza de La Paz",
  altitude: true,
};

function makeStage(patch: Partial<StageDef> = {}): StageDef {
  return {
    id: "g1",
    label: "Grupo — Jogo 1",
    opponent,
    homeAway: "home",
    elimination: false,
    completionBonus: 2,
    ...patch,
  };
}

function makeCtx(patch: Partial<RunMatchCtx> = {}): RunMatchCtx {
  return { homeAway: "home", stage: makeStage(), seedStream: "run-seed:match:0", ...patch };
}

/** Find a seedStream whose no-card result satisfies a predicate. */
function findSeed(
  predicate: (outcome: "win" | "draw" | "loss", userGoals: number) => boolean,
  ctxPatch: Partial<RunMatchCtx> = {},
  squad = makeSquad(),
): string {
  for (let i = 0; i < 500; i += 1) {
    const seedStream = `probe:match:${i}`;
    const { result } = playRunMatch(squad, [], opponent, makeCtx({ ...ctxPatch, seedStream }));
    if (predicate(result.outcome, result.userGoals)) return seedStream;
  }
  throw new Error("no seed found");
}

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("determinism", () => {
  it("same squad/cards/opponent/seedStream → identical result and firings", () => {
    const cards = [getCard("caldeirao"), getCard("artilheiro-nato"), getCard("muralha")];
    const a = playRunMatch(makeSquad(), cards, opponent, makeCtx());
    const b = playRunMatch(makeSquad(), cards, opponent, makeCtx());
    expect(a).toEqual(b);
  });

  it("different seedStreams diverge", () => {
    const scores = new Set<string>();
    for (let i = 0; i < 30; i += 1) {
      const { result } = playRunMatch(makeSquad(), [], opponent, makeCtx({ seedStream: `s:${i}` }));
      scores.add(`${result.userGoals}-${result.opponentGoals}`);
    }
    expect(scores.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// Home/away math
// ---------------------------------------------------------------------------

describe("home/away força", () => {
  it("away = -2 on every aggregate, altitude away = -4", () => {
    expect(awayDebuff("home", opponent)).toBe(0);
    expect(awayDebuff("away", opponent)).toBe(AWAY_DEBUFF);
    expect(awayDebuff("away", altitudeOpponent)).toBe(ALTITUDE_AWAY_DEBUFF);

    const home = playRunMatch(makeSquad(), [], opponent, makeCtx({ homeAway: "home" })).result;
    const away = playRunMatch(makeSquad(), [], opponent, makeCtx({ homeAway: "away" })).result;
    expect(away.userStrength.overall).toBe(home.userStrength.overall - 2);
    expect(away.userStrength.attack).toBe(home.userStrength.attack - 2);
    expect(away.userStrength.defense).toBe(home.userStrength.defense - 2);

    const altitude = playRunMatch(makeSquad(), [], altitudeOpponent, makeCtx({ homeAway: "away" })).result;
    expect(altitude.userStrength.overall).toBe(home.userStrength.overall - 4);
  });

  it("Doutor Altitude negates the away debuff (firing recorded)", () => {
    const home = playRunMatch(makeSquad(), [], altitudeOpponent, makeCtx({ homeAway: "home" })).result;
    const { result, cardFirings } = playRunMatch(
      makeSquad(),
      [getCard("doutor-altitude")],
      altitudeOpponent,
      makeCtx({ homeAway: "away" }),
    );
    expect(result.userStrength.overall).toBe(home.userStrength.overall);
    expect(cardFirings).toContainEqual(
      expect.objectContaining({ cardId: "doutor-altitude", moment: "preMatch" }),
    );
  });

  it("Caldeirão adds +3 at home only", () => {
    const plain = playRunMatch(makeSquad(), [], opponent, makeCtx()).result;
    const withCard = playRunMatch(makeSquad(), [getCard("caldeirao")], opponent, makeCtx()).result;
    expect(withCard.userStrength.overall).toBe(plain.userStrength.overall + 3);

    const awayPlain = playRunMatch(makeSquad(), [], opponent, makeCtx({ homeAway: "away" }));
    const awayCard = playRunMatch(makeSquad(), [getCard("caldeirao")], opponent, makeCtx({ homeAway: "away" }));
    expect(awayCard.result.userStrength.overall).toBe(awayPlain.result.userStrength.overall);
    expect(awayCard.cardFirings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Strength model
// ---------------------------------------------------------------------------

describe("computeRunSquadStrength", () => {
  it("Paredão (gkToMidfield) raises midfield when GK defense beats the mids", () => {
    const squad = makeSquad();
    const gk = squad.slots.get("GOL")!;
    squad.slots.set("GOL", { ...gk, defense: 95 });
    const plain = computeRunSquadStrength(squad);
    const walled = computeRunSquadStrength(squad, { gkToMidfield: true });
    expect(walled.midfield).toBeGreaterThan(plain.midfield);
    expect(walled.attack).toBe(plain.attack);
  });

  it("slot deltas hit only the targeted occupant's contributing stat", () => {
    const squad = makeSquad();
    const plain = computeRunSquadStrength(squad);
    const boosted = computeRunSquadStrength(squad, { slotDeltas: new Map([["CA", 30]]) });
    expect(boosted.attack).toBe(plain.attack + 10); // +30 over 3 attackers
    expect(boosted.defense).toBe(plain.defense);
  });
});

// ---------------------------------------------------------------------------
// Card firings during the match
// ---------------------------------------------------------------------------

describe("card firings", () => {
  it("Artilheiro Nato fires exactly once per CA goal, with the goal minute", () => {
    const squad = makeSquad(25); // strong squad → goals
    for (let i = 0; i < 200; i += 1) {
      const ctx = makeCtx({ seedStream: `firing:${i}` });
      const { result, cardFirings } = playRunMatch(squad, [getCard("artilheiro-nato")], opponent, ctx);
      const caGoals = result.goalEvents.filter((e) => e.side === "user" && e.scorerSlotId === "CA");
      const firings = cardFirings.filter((f) => f.cardId === "artilheiro-nato");
      expect(firings).toHaveLength(caGoals.length);
      for (const firing of firings) {
        expect(firing.moment).toBe("goal");
        expect(caGoals.map((g) => g.minute)).toContain(firing.minute);
        expect(firing.label).toContain("Artilheiro Nato");
      }
    }
  });

  it("Muralha fires on clean sheets only", () => {
    let cleanSeed = "";
    let concededSeed = "";
    for (let i = 0; i < 500 && !(cleanSeed && concededSeed); i += 1) {
      const s = `cs:${i}`;
      const { result } = playRunMatch(makeSquad(), [], opponent, makeCtx({ seedStream: s }));
      if (result.opponentGoals === 0 && !cleanSeed) cleanSeed = s;
      if (result.opponentGoals > 0 && !concededSeed) concededSeed = s;
    }
    expect(cleanSeed).not.toBe("");
    expect(concededSeed).not.toBe("");

    const clean = playRunMatch(makeSquad(), [getCard("muralha")], opponent, makeCtx({ seedStream: cleanSeed }));
    expect(clean.cardFirings).toContainEqual(
      expect.objectContaining({ cardId: "muralha", moment: "result", value: 5 }),
    );
    const conceded = playRunMatch(makeSquad(), [getCard("muralha")], opponent, makeCtx({ seedStream: concededSeed }));
    expect(conceded.cardFirings.filter((f) => f.cardId === "muralha")).toHaveLength(0);
  });

  it("every firing carries a non-empty pt-BR label", () => {
    const cards = ["caldeirao", "artilheiro-nato", "gol-de-placa", "bicho-pago", "muralha"].map(getCard);
    for (let i = 0; i < 50; i += 1) {
      const { cardFirings } = playRunMatch(makeSquad(20), cards, opponent, makeCtx({ seedStream: `lbl:${i}` }));
      for (const firing of cardFirings) {
        expect(firing.label.length).toBeGreaterThan(5);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Catimba + shootouts
// ---------------------------------------------------------------------------

describe("Catimba and draw resolution", () => {
  const drawSeed = () => findSeed((o) => o === "draw");

  it("group draw without Catimba stands as a draw", () => {
    const seed = drawSeed();
    const { result } = playRunMatch(makeSquad(), [], opponent, makeCtx({ seedStream: seed }));
    expect(result.outcome).toBe("draw");
    expect(result.viaPenalties).toBe(false);
  });

  it("Catimba sends group draws to a shootout: win upgrades, loss keeps the draw", () => {
    let sawWin = false;
    let sawKeptDraw = false;
    for (let i = 0; i < 500 && !(sawWin && sawKeptDraw); i += 1) {
      const seedStream = `probe:match:${i}`;
      const plain = playRunMatch(makeSquad(), [], opponent, makeCtx({ seedStream }));
      if (plain.result.outcome !== "draw") continue;
      const { result, cardFirings } = playRunMatch(
        makeSquad(),
        [getCard("catimba")],
        opponent,
        makeCtx({ seedStream }),
      );
      expect(cardFirings).toContainEqual(
        expect.objectContaining({ cardId: "catimba", moment: "result" }),
      );
      const shootout = cardFirings.find((f) => f.moment === "shootout");
      expect(shootout?.cardId).toBe("catimba");
      if (result.outcome === "win") {
        expect(result.viaPenalties).toBe(true);
        expect(shootout!.label).toContain("vitória nos pênaltis");
        sawWin = true;
      } else {
        expect(result.outcome).toBe("draw");
        expect(result.viaPenalties).toBe(false);
        sawKeptDraw = true;
      }
    }
    expect(sawWin).toBe(true);
    expect(sawKeptDraw).toBe(true);
  });

  it("elimination draws always resolve on penalties (win or loss, never draw)", () => {
    const ko = makeStage({ elimination: true });
    let resolved = 0;
    for (let i = 0; i < 500; i += 1) {
      const seedStream = `probe:match:${i}`;
      const plain = playRunMatch(makeSquad(), [], opponent, makeCtx({ seedStream }));
      if (plain.result.outcome !== "draw") continue;
      const { result } = playRunMatch(makeSquad(), [], opponent, makeCtx({ seedStream, stage: ko }));
      expect(["win", "loss"]).toContain(result.outcome);
      expect(result.viaPenalties).toBe(true);
      resolved += 1;
    }
    expect(resolved).toBeGreaterThan(0);
  });

  it("Catimba shootout outcome is deterministic for a given seed", () => {
    const seed = drawSeed();
    const a = playRunMatch(makeSquad(), [getCard("catimba")], opponent, makeCtx({ seedStream: seed }));
    const b = playRunMatch(makeSquad(), [getCard("catimba")], opponent, makeCtx({ seedStream: seed }));
    expect(a.result.outcome).toBe(b.result.outcome);
    expect(a.cardFirings).toEqual(b.cardFirings);
  });
});

// ---------------------------------------------------------------------------
// Scorer pool bias (Zagueiro Artilheiro)
// ---------------------------------------------------------------------------

describe("Zagueiro Artilheiro scorer bias", () => {
  it("defenders score a much larger share of goals with the card active", () => {
    const squad = makeSquad(25);
    const defenderSlots = new Set(["LD", "ZAG1", "ZAG2", "LE"]);
    let plainDef = 0;
    let plainTotal = 0;
    let cardDef = 0;
    let cardTotal = 0;
    for (let i = 0; i < 300; i += 1) {
      const ctx = makeCtx({ seedStream: `zaga:${i}` });
      for (const e of playRunMatch(squad, [], opponent, ctx).result.goalEvents) {
        if (e.side !== "user") continue;
        plainTotal += 1;
        if (defenderSlots.has(e.scorerSlotId!)) plainDef += 1;
      }
      for (const e of playRunMatch(squad, [getCard("zagueiro-artilheiro")], opponent, ctx).result.goalEvents) {
        if (e.side !== "user") continue;
        cardTotal += 1;
        if (defenderSlots.has(e.scorerSlotId!)) cardDef += 1;
      }
    }
    expect(plainTotal).toBeGreaterThan(50);
    expect(cardDef / cardTotal).toBeGreaterThan((plainDef / plainTotal) * 1.5);
  });
});

// ---------------------------------------------------------------------------
// Goleada detection
// ---------------------------------------------------------------------------

describe("isGoleada", () => {
  it("detects 4+ goal margins", () => {
    expect(isGoleada({ userGoals: 4, opponentGoals: 0 })).toBe(true);
    expect(isGoleada({ userGoals: 7, opponentGoals: 0 })).toBe(true);
    expect(isGoleada({ userGoals: 5, opponentGoals: 1 })).toBe(true);
    expect(isGoleada({ userGoals: 3, opponentGoals: 0 })).toBe(false);
    expect(isGoleada({ userGoals: 4, opponentGoals: 1 })).toBe(false);
    expect(isGoleada({ userGoals: 0, opponentGoals: 4 })).toBe(false);
  });
});
