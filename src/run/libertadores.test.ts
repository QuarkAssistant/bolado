import { describe, expect, it } from "vitest";
import {
  RATING_BANDS,
  findLibertadoresOpponent,
  libertadoresOpponents,
} from "../data/libertadores/opponents";
import { POOL_LABELS } from "../data/libertadores/draftClubs";
import { ALTITUDE_AWAY_DEBUFF, awayDebuff } from "./playRunMatch";
import { applyDecision, startRun } from "./runState";
import {
  GROUP_OPPONENT_COUNT,
  GROUP_QUALIFY_POINTS,
  KNOCKOUT_STAGE_IDS,
  LIBERTADORES_DRAFT_SOURCE,
  buildLibertadoresCompetition,
  libertadoresOpponentMeta,
} from "./libertadores";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEEDS = Array.from({ length: 40 }, (_, i) => `liber-seed-${i}`);

function groupStages(seed: string) {
  return buildLibertadoresCompetition(seed).stages.filter((s) => !s.elimination);
}

function knockoutStages(seed: string) {
  return buildLibertadoresCompetition(seed).stages.filter((s) => s.elimination);
}

// ---------------------------------------------------------------------------
// Bracket determinism
// ---------------------------------------------------------------------------

describe("buildLibertadoresCompetition · determinism", () => {
  it("same seed → byte-identical bracket", () => {
    const a = buildLibertadoresCompetition("alpha");
    const b = buildLibertadoresCompetition("alpha");
    expect(b.stages).toEqual(a.stages);
    expect(b.groupRule).toEqual(a.groupRule);
  });

  it("different seeds → different brackets (at least one pair differs)", () => {
    const baseline = JSON.stringify(buildLibertadoresCompetition("alpha").stages);
    const differs = SEEDS.some(
      (seed) => JSON.stringify(buildLibertadoresCompetition(seed).stages) !== baseline,
    );
    expect(differs).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

describe("buildLibertadoresCompetition · structure", () => {
  it("is 6 group stages then Oitavas → Quartas → Semi → FINAL", () => {
    for (const seed of SEEDS.slice(0, 5)) {
      const comp = buildLibertadoresCompetition(seed);
      expect(comp.id).toBe("libertadores");
      expect(comp.stages).toHaveLength(10);
      expect(comp.stages.slice(0, 6).every((s) => !s.elimination)).toBe(true);
      expect(comp.stages.slice(6).map((s) => s.id)).toEqual([...KNOCKOUT_STAGE_IDS]);
      expect(comp.stages.slice(6).every((s) => s.elimination)).toBe(true);
    }
  });

  it("group rule covers exactly the 6 group stage ids, in play order", () => {
    const comp = buildLibertadoresCompetition("alpha");
    expect(comp.groupRule).toBeDefined();
    expect(comp.groupRule!.stageIds).toEqual(comp.stages.slice(0, 6).map((s) => s.id));
    expect(comp.groupRule!.qualifyPoints).toBe(GROUP_QUALIFY_POINTS);
  });

  it("uses the Libertadores 5-player draft source", () => {
    const comp = buildLibertadoresCompetition("alpha");
    expect(comp.draftSource).toBe(LIBERTADORES_DRAFT_SOURCE);
  });
});

// ---------------------------------------------------------------------------
// Group composition
// ---------------------------------------------------------------------------

describe("buildLibertadoresCompetition · group stage", () => {
  it("3 distinct group-tier opponents, each played home AND away", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const stages = groupStages(seed);
      expect(stages).toHaveLength(6);

      const byName = new Map<string, string[]>();
      for (const stage of stages) {
        const sides = byName.get(stage.opponent.name) ?? [];
        sides.push(stage.homeAway);
        byName.set(stage.opponent.name, sides);
      }
      expect(byName.size).toBe(GROUP_OPPONENT_COUNT);
      for (const sides of byName.values()) {
        expect(sides.sort()).toEqual(["away", "home"]);
      }
    }
  });

  it("every group opponent comes from the group tier rating band", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      for (const stage of groupStages(seed)) {
        const meta = libertadoresOpponentMeta(stage.opponent.name);
        expect(meta?.tier).toBe("group");
        expect(stage.opponent.rating).toBeGreaterThanOrEqual(RATING_BANDS.group.min);
        expect(stage.opponent.rating).toBeLessThanOrEqual(RATING_BANDS.group.max);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Knockout curve
// ---------------------------------------------------------------------------

describe("buildLibertadoresCompetition · knockout", () => {
  it("strength rises monotonically: oitavas < quartas < semi < final", () => {
    for (const seed of SEEDS) {
      const ratings = knockoutStages(seed).map((s) => s.opponent.rating);
      expect(ratings).toHaveLength(4);
      for (let i = 1; i < ratings.length; i += 1) {
        expect(ratings[i]!).toBeGreaterThan(ratings[i - 1]!);
      }
    }
  });

  it("knockouts outrate every group opponent", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const maxGroup = Math.max(...groupStages(seed).map((s) => s.opponent.rating));
      for (const stage of knockoutStages(seed)) {
        expect(stage.opponent.rating).toBeGreaterThan(maxGroup);
      }
    }
  });

  it("oitavas/quartas/semi come from the mata tier, the FINAL from the boss tier", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const [oitavas, quartas, semi, final] = knockoutStages(seed);
      for (const stage of [oitavas!, quartas!, semi!]) {
        expect(libertadoresOpponentMeta(stage.opponent.name)?.tier).toBe("mata");
      }
      expect(libertadoresOpponentMeta(final!.opponent.name)?.tier).toBe("boss");
    }
  });
});

// ---------------------------------------------------------------------------
// Opponent refs resolve + altitude wiring
// ---------------------------------------------------------------------------

describe("buildLibertadoresCompetition · opponent refs", () => {
  it("every stage opponent resolves to a curated LibertadoresOpponent", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      for (const stage of buildLibertadoresCompetition(seed).stages) {
        const meta = libertadoresOpponentMeta(stage.opponent.name);
        expect(meta, `unresolved opponent: ${stage.opponent.name}`).toBeDefined();
        expect(findLibertadoresOpponent(meta!.id)).toBe(meta);
        expect(stage.opponent.rating).toBe(meta!.rating);
        expect(stage.opponent.flavor).toBe(meta!.flavor);
        // country carries the nation-pool tag (Lei do Ex), never the flag emoji
        if (stage.opponent.country !== undefined) {
          expect(stage.opponent.country).toBe(meta!.nationTag);
        }
      }
    }
  });

  it("altitude opponents keep their altitude flag and away debuff", () => {
    const altitudeNames = new Set(
      libertadoresOpponents.filter((o) => o.altitude).map((o) => o.name),
    );
    let checked = 0;
    for (const seed of SEEDS) {
      for (const stage of buildLibertadoresCompetition(seed).stages) {
        if (!altitudeNames.has(stage.opponent.name)) continue;
        expect(stage.opponent.altitude).toBe(true);
        expect(awayDebuff("away", stage.opponent)).toBe(ALTITUDE_AWAY_DEBUFF);
        checked += 1;
      }
    }
    // The scan must actually have exercised an altitude opponent.
    expect(checked).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Dice draft source
// ---------------------------------------------------------------------------

describe("LIBERTADORES_DRAFT_SOURCE", () => {
  it("offers are deterministic per index", () => {
    const a = LIBERTADORES_DRAFT_SOURCE.getOffer(7);
    const b = LIBERTADORES_DRAFT_SOURCE.getOffer(7);
    expect(b).toEqual(a);
  });

  it("every offer is 5 distinct players covering ≥3 positions, with a pt-BR label", () => {
    const labels = new Set(Object.values(POOL_LABELS));
    for (let index = 0; index < Math.min(LIBERTADORES_DRAFT_SOURCE.offerCount, 64); index += 1) {
      const offer = LIBERTADORES_DRAFT_SOURCE.getOffer(index);
      expect(offer.players).toHaveLength(5);
      expect(new Set(offer.players.map((p) => p.id)).size).toBe(5);
      const positions = new Set(offer.players.flatMap((p) => p.positions));
      expect(positions.size).toBeGreaterThanOrEqual(3);
      expect(labels.has(offer.label)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Engine integration
// ---------------------------------------------------------------------------

describe("libertadores · runState integration", () => {
  it("startRun + roll yields a 5-player Libertadores offer", () => {
    const competition = buildLibertadoresCompetition("integ");
    const state = startRun("integ", "libertadores", { competition });
    expect(state.phase).toBe("shop");
    const rolled = applyDecision(state, { type: "roll" });
    expect(rolled.shop!.diceOffers).toHaveLength(1);
    expect(rolled.shop!.diceOffers[0]!.players).toHaveLength(5);
  });
});
