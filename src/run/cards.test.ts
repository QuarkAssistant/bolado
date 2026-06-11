import { describe, expect, it } from "vitest";
import {
  CARDS,
  CARDS_BY_ID,
  MAX_ACTIVE_CARDS,
  evalOnGoal,
  evalOnResult,
  evalOnShopEnter,
  evalPreMatch,
  evalScoreMults,
  getCard,
  type GoalCtx,
  type PreMatchCtx,
  type ResultCtx,
  type ScoreCtx,
} from "./cards";
import { generateJourneymen } from "./journeymen";
import type { NationPlayer } from "../types";
import { CAMISA_10_SLOT, type OpponentDef, type Squad, type StageDef } from "./types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSquad(overrides: Record<string, Partial<NationPlayer>> = {}): Squad {
  const slots = generateJourneymen("card-test-seed", "4-3-3");
  for (const [slotId, patch] of Object.entries(overrides)) {
    const current = slots.get(slotId);
    if (!current) throw new Error(`no slot ${slotId}`);
    slots.set(slotId, { ...current, ...patch });
  }
  return { formation: "4-3-3", slots };
}

const opponent: OpponentDef = { name: "Estudiantes 1968", rating: 80, flavor: "catimba raiz" };

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

function preCtx(patch: Partial<PreMatchCtx> = {}): PreMatchCtx {
  return {
    squad: makeSquad(),
    opponent,
    homeAway: "home",
    stage: makeStage(),
    boughtCardThisShop: false,
    signedPlayerIds: new Set(),
    ...patch,
  };
}

function goalCtx(patch: Partial<GoalCtx> = {}): GoalCtx {
  return {
    side: "user",
    goalIndexForSide: 0,
    minute: 10,
    scorerSlotId: "CA",
    scorerPosition: "CA",
    squad: makeSquad(),
    ...patch,
  };
}

function resultCtx(patch: Partial<ResultCtx> = {}): ResultCtx {
  return {
    outcome: "win",
    userGoals: 2,
    opponentGoals: 0,
    viaPenalties: false,
    stage: makeStage(),
    homeAway: "home",
    ...patch,
  };
}

function scoreCtx(patch: Partial<ScoreCtx> = {}): ScoreCtx {
  return { outcome: "win", userGoals: 2, opponentGoals: 0, stage: makeStage(), homeAway: "home", ...patch };
}

const card = (id: string) => [getCard(id)];

// ---------------------------------------------------------------------------
// Catalog invariants
// ---------------------------------------------------------------------------

describe("card catalog", () => {
  it("ships 20 launch cards with unique ids", () => {
    expect(CARDS).toHaveLength(20);
    expect(CARDS_BY_ID.size).toBe(20);
  });

  it("enforces max 5 active cards as a constant", () => {
    expect(MAX_ACTIVE_CARDS).toBe(5);
  });

  it("prices within rarity tuning bands (comum 3-4, rara 6-8, lendaria 10-12)", () => {
    const bands = { comum: [3, 4], rara: [6, 8], lendaria: [10, 12] } as const;
    for (const c of CARDS) {
      const [lo, hi] = bands[c.rarity];
      expect(c.price, c.id).toBeGreaterThanOrEqual(lo);
      expect(c.price, c.id).toBeLessThanOrEqual(hi);
    }
  });

  it("every card has emoji, pt-BR description, and at least one hook", () => {
    for (const c of CARDS) {
      expect(c.emoji.length, c.id).toBeGreaterThan(0);
      expect(c.description.length, c.id).toBeGreaterThan(10);
      expect(Object.keys(c.hooks).length, c.id).toBeGreaterThan(0);
    }
  });

  it("getCard throws on unknown ids", () => {
    expect(() => getCard("carta-fantasma")).toThrow(/Unknown card/);
  });
});

// ---------------------------------------------------------------------------
// Tática
// ---------------------------------------------------------------------------

describe("Caldeirão", () => {
  it("gives +3 team força at home, nothing away", () => {
    const home = evalPreMatch(card("caldeirao"), preCtx({ homeAway: "home" }));
    expect(home).toHaveLength(1);
    expect(home[0]!.effect.teamDelta).toBe(3);
    expect(home[0]!.effect.label).toContain("Caldeirão");
    expect(evalPreMatch(card("caldeirao"), preCtx({ homeAway: "away" }))).toHaveLength(0);
  });
});

describe("Doutor Altitude", () => {
  it("negates the away debuff only away", () => {
    const away = evalPreMatch(card("doutor-altitude"), preCtx({ homeAway: "away" }));
    expect(away[0]!.effect.negateAwayDebuff).toBe(true);
    expect(evalPreMatch(card("doutor-altitude"), preCtx({ homeAway: "home" }))).toHaveLength(0);
  });
});

describe("Mística da Taça", () => {
  it("gives +2 only in elimination stages", () => {
    const ko = evalPreMatch(card("mistica-da-taca"), preCtx({ stage: makeStage({ elimination: true }) }));
    expect(ko[0]!.effect.teamDelta).toBe(2);
    expect(evalPreMatch(card("mistica-da-taca"), preCtx())).toHaveLength(0);
  });
});

describe("Catimba", () => {
  it("overrides draws into a penalty shootout", () => {
    const fired = evalOnResult(card("catimba"), resultCtx({ outcome: "draw", userGoals: 1, opponentGoals: 1 }));
    expect(fired[0]!.effect.resultOverride).toBe("penaltyShootout");
    expect(fired[0]!.effect.label).toContain("Catimba");
  });

  it("does nothing on wins or losses", () => {
    expect(evalOnResult(card("catimba"), resultCtx({ outcome: "win" }))).toHaveLength(0);
    expect(evalOnResult(card("catimba"), resultCtx({ outcome: "loss" }))).toHaveLength(0);
  });
});

describe("Artilheiro Nato", () => {
  it("doubles points for CA goals only", () => {
    const ca = evalOnGoal(card("artilheiro-nato"), goalCtx({ scorerPosition: "CA" }));
    expect(ca[0]!.effect.pointsMult).toBe(2);
    expect(evalOnGoal(card("artilheiro-nato"), goalCtx({ scorerPosition: "MEI", scorerSlotId: "MEI1" }))).toHaveLength(0);
    expect(evalOnGoal(card("artilheiro-nato"), goalCtx({ side: "opponent" }))).toHaveLength(0);
  });
});

describe("Joga Bonito", () => {
  it("doubles user goals from the third on (index >= 2)", () => {
    expect(evalOnGoal(card("joga-bonito"), goalCtx({ goalIndexForSide: 0 }))).toHaveLength(0);
    expect(evalOnGoal(card("joga-bonito"), goalCtx({ goalIndexForSide: 1 }))).toHaveLength(0);
    const third = evalOnGoal(card("joga-bonito"), goalCtx({ goalIndexForSide: 2 }));
    expect(third[0]!.effect.pointsMult).toBe(2);
    const fourth = evalOnGoal(card("joga-bonito"), goalCtx({ goalIndexForSide: 3 }));
    expect(fourth[0]!.effect.pointsMult).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Vestiário
// ---------------------------------------------------------------------------

describe("Maestro", () => {
  it("gives camisa 10 +2 per same-era teammate", () => {
    const squad = makeSquad();
    const tenSlot = CAMISA_10_SLOT["4-3-3"];
    const ten = squad.slots.get(tenSlot)!;
    const mates = [...squad.slots.entries()].filter(
      ([sid, p]) => sid !== tenSlot && p.eraBand === ten.eraBand,
    ).length;
    const fired = evalPreMatch(card("maestro"), preCtx({ squad }));
    if (mates === 0) {
      expect(fired).toHaveLength(0);
    } else {
      expect(fired[0]!.effect.slotDeltas).toEqual({ [tenSlot]: 2 * mates });
    }
  });

  it("scales: all-same-era XI gives +20", () => {
    const squad = makeSquad();
    for (const [sid, p] of squad.slots) squad.slots.set(sid, { ...p, eraBand: "70s-80s" });
    const fired = evalPreMatch(card("maestro"), preCtx({ squad }));
    expect(fired[0]!.effect.slotDeltas).toEqual({ [CAMISA_10_SLOT["4-3-3"]]: 20 });
  });

  it("stays silent with zero same-era teammates", () => {
    const squad = makeSquad();
    const tenSlot = CAMISA_10_SLOT["4-3-3"];
    const eras = ["50s-60s", "70s-80s", "90s-00s", "00s-10s"] as const;
    let i = 0;
    for (const [sid, p] of squad.slots) {
      if (sid === tenSlot) squad.slots.set(sid, { ...p, eraBand: "10s-20s" });
      else squad.slots.set(sid, { ...p, eraBand: eras[i++ % eras.length]! });
    }
    expect(evalPreMatch(card("maestro"), preCtx({ squad }))).toHaveLength(0);
  });
});

describe("Mago da Várzea", () => {
  it("gives +3 to every tier-1 player", () => {
    const squad = makeSquad({ CA: { costTier: 5 }, PD: { costTier: 3 } });
    const fired = evalPreMatch(card("mago-da-varzea"), preCtx({ squad }));
    const deltas = fired[0]!.effect.slotDeltas!;
    expect(Object.keys(deltas)).toHaveLength(9); // 11 - 2 upgraded
    expect(Object.values(deltas).every((d) => d === 3)).toBe(true);
    expect(deltas["CA"]).toBeUndefined();
  });

  it("stays silent when no tier-1 players remain", () => {
    const squad = makeSquad();
    for (const [sid, p] of squad.slots) squad.slots.set(sid, { ...p, costTier: 4 });
    expect(evalPreMatch(card("mago-da-varzea"), preCtx({ squad }))).toHaveLength(0);
  });
});

describe("Lei do Ex (adjusted: country match instead of club match)", () => {
  it("gives +1 to signed players whose nation matches opponent country", () => {
    const squad = makeSquad({
      CA: { id: "ar-batistuta", nation: "Argentina" },
      PD: { id: "br-garrincha", nation: "Brazil" },
    });
    const fired = evalPreMatch(
      card("lei-do-ex"),
      preCtx({
        squad,
        opponent: { ...opponent, country: "Argentina" },
        signedPlayerIds: new Set(["ar-batistuta", "br-garrincha"]),
      }),
    );
    expect(fired[0]!.effect.slotDeltas).toEqual({ CA: 1 });
  });

  it("ignores journeymen and opponents without a country tag", () => {
    expect(
      evalPreMatch(card("lei-do-ex"), preCtx({ opponent: { ...opponent, country: "Brazil" } })),
    ).toHaveLength(0); // journeymen are not signed
    expect(evalPreMatch(card("lei-do-ex"), preCtx())).toHaveLength(0); // no country
  });
});

describe("Paredão", () => {
  it("flags GK defense counting toward midfield", () => {
    const fired = evalPreMatch(card("paredao"), preCtx());
    expect(fired[0]!.effect.gkToMidfield).toBe(true);
  });
});

describe("Volante Raçudo (adjusted: away boost instead of half-time state)", () => {
  it("gives every VOL +2 away, nothing home", () => {
    const away = evalPreMatch(card("volante-racudo"), preCtx({ homeAway: "away" }));
    expect(away[0]!.effect.slotDeltas).toEqual({ VOL: 2 }); // 4-3-3 has one VOL slot
    expect(evalPreMatch(card("volante-racudo"), preCtx({ homeAway: "home" }))).toHaveLength(0);
  });
});

describe("Pé Quente", () => {
  it("gives +2 only when a card was bought this shop", () => {
    const hot = evalPreMatch(card("pe-quente"), preCtx({ boughtCardThisShop: true }));
    expect(hot[0]!.effect.teamDelta).toBe(2);
    expect(evalPreMatch(card("pe-quente"), preCtx({ boughtCardThisShop: false }))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Várzea
// ---------------------------------------------------------------------------

describe("Muralha", () => {
  it("pays +5 coins on clean sheets, regardless of outcome", () => {
    const cs = evalOnResult(card("muralha"), resultCtx({ opponentGoals: 0 }));
    expect(cs[0]!.effect.coinBonus).toBe(5);
    const drawCs = evalOnResult(card("muralha"), resultCtx({ outcome: "draw", userGoals: 0, opponentGoals: 0 }));
    expect(drawCs[0]!.effect.coinBonus).toBe(5);
    expect(evalOnResult(card("muralha"), resultCtx({ opponentGoals: 1 }))).toHaveLength(0);
  });
});

describe("Bicho Pago", () => {
  it("pays +2 coins on wins only", () => {
    const win = evalOnResult(card("bicho-pago"), resultCtx({ outcome: "win" }));
    expect(win[0]!.effect.coinBonus).toBe(2);
    expect(evalOnResult(card("bicho-pago"), resultCtx({ outcome: "draw" }))).toHaveLength(0);
    expect(evalOnResult(card("bicho-pago"), resultCtx({ outcome: "loss" }))).toHaveLength(0);
  });
});

describe("Olheiro", () => {
  it("grants a free first reroll on shop enter", () => {
    const fired = evalOnShopEnter(card("olheiro"));
    expect(fired[0]!.effect.freeReroll).toBe(true);
  });
});

describe("Gol de Placa", () => {
  it("pays +2 coins on the first user goal only", () => {
    const first = evalOnGoal(card("gol-de-placa"), goalCtx({ goalIndexForSide: 0 }));
    expect(first[0]!.effect.coinBonus).toBe(2);
    expect(evalOnGoal(card("gol-de-placa"), goalCtx({ goalIndexForSide: 1 }))).toHaveLength(0);
    expect(evalOnGoal(card("gol-de-placa"), goalCtx({ side: "opponent" }))).toHaveLength(0);
  });
});

describe("Zagueiro Artilheiro", () => {
  it("boosts defender scorer weight pre-match", () => {
    const pre = evalPreMatch(card("zagueiro-artilheiro"), preCtx());
    expect(pre[0]!.effect.defenderScorerWeight).toBe(3);
  });

  it("doubles points for defender goals only", () => {
    const zag = evalOnGoal(
      card("zagueiro-artilheiro"),
      goalCtx({ scorerSlotId: "ZAG1", scorerPosition: "ZAG" }),
    );
    expect(zag[0]!.effect.pointsMult).toBe(2);
    const lat = evalOnGoal(card("zagueiro-artilheiro"), goalCtx({ scorerSlotId: "LD", scorerPosition: "LD" }));
    expect(lat[0]!.effect.pointsMult).toBe(2); // laterais são defensores
    expect(evalOnGoal(card("zagueiro-artilheiro"), goalCtx({ scorerPosition: "CA" }))).toHaveLength(0);
  });
});

describe("Maluquice", () => {
  it("enables dual club rolls on shop enter", () => {
    const fired = evalOnShopEnter(card("maluquice"));
    expect(fired[0]!.effect.dualRoll).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Lendárias
// ---------------------------------------------------------------------------

describe("Camisa Pesada", () => {
  it("multiplies score by 1.5 in elimination stages only", () => {
    const ko = evalScoreMults(card("camisa-pesada"), scoreCtx({ stage: makeStage({ elimination: true }) }));
    expect(ko[0]!.mult).toBe(1.5);
    expect(evalScoreMults(card("camisa-pesada"), scoreCtx())).toHaveLength(0);
  });
});

describe("Dia de São Jorge", () => {
  it("multiplies every match score by 1.25", () => {
    const fired = evalScoreMults(card("dia-de-sao-jorge"), scoreCtx());
    expect(fired[0]!.mult).toBe(1.25);
    const ko = evalScoreMults(card("dia-de-sao-jorge"), scoreCtx({ stage: makeStage({ elimination: true }) }));
    expect(ko[0]!.mult).toBe(1.25);
  });
});

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

describe("hook aggregation", () => {
  it("collects one contribution per firing card, skipping silent ones", () => {
    const cards = [getCard("caldeirao"), getCard("doutor-altitude"), getCard("mistica-da-taca")];
    const fired = evalPreMatch(cards, preCtx({ homeAway: "home", stage: makeStage({ elimination: true }) }));
    expect(fired.map((f) => f.card.id)).toEqual(["caldeirao", "mistica-da-taca"]);
  });

  it("stacks multiple scoreMults independently", () => {
    const cards = [getCard("camisa-pesada"), getCard("dia-de-sao-jorge")];
    const mults = evalScoreMults(cards, scoreCtx({ stage: makeStage({ elimination: true }) }));
    expect(mults.map((m) => m.mult)).toEqual([1.5, 1.25]);
  });
});
