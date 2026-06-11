/**
 * Tests for pickState reducer: state transitions, budget math, move semantics,
 * canConfirm gates, placeableSlotIds highlighting.
 */

import { describe, expect, test } from "vitest";
import {
  createPickState,
  pickReducer,
  remainingBudget,
  canConfirm,
  placeableSlotIds,
  picksAsArray,
  type PickState,
} from "./pickState";
import { getChallengeForNumber } from "./challenges";
import type { NationPlayer, OpenSlot } from "./types";

// ---------------------------------------------------------------------------
// Challenge #1 fixtures
// ---------------------------------------------------------------------------

const ch1 = getChallengeForNumber(1)!;
// Open slots: s-gol(GOL), s-ld(LD), s-mei2(MEI), s-pd(PD), s-pe(PE)

const GOL_SLOT = ch1.openSlots.find((s) => s.position === "GOL")!;
const LD_SLOT = ch1.openSlots.find((s) => s.position === "LD")!;
const MEI_SLOT = ch1.openSlots.find((s) => s.position === "MEI")!;
const PD_SLOT = ch1.openSlots.find((s) => s.position === "PD")!;
const PE_SLOT = ch1.openSlots.find((s) => s.position === "PE")!;

const byId = (id: string) => ch1.candidates.find((c) => c.id === id)!;
const campos = byId("mx-campos");      // GOL, tier-4
const lavolpe = byId("mx-lavolpe");   // GOL, tier-1
const coly = byId("sn-coly");         // LD, tier-3
const parker = byId("za-parker");     // PD/CA, tier-1
const dosAntos = byId("mx-dos-santos"); // PE/CA, tier-2
const tshabalala = byId("za-tshabalala"); // PE/MEI, tier-3
const guardado = byId("mx-guardado"); // MEI/LE, tier-2
const pienaar = byId("za-pienaar");   // MEI/PE, tier-4
const charlton = byId("wc-charlton"); // MEI, tier-5

/** Dispatch helpers: wrap the clunky action shape so tests read cleanly */
function select(state: PickState, candidateId: string): PickState {
  return pickReducer(state, { type: "SELECT_CANDIDATE", candidateId });
}

function place(state: PickState, candidate: NationPlayer, slot: OpenSlot): PickState {
  return pickReducer(state, {
    type: "PLACE",
    candidate,
    slot,
    budget: ch1.budget,
  });
}

function remove(state: PickState, slotId: string): PickState {
  return pickReducer(state, { type: "REMOVE", slotId });
}

function reset(state: PickState): PickState {
  return pickReducer(state, { type: "RESET" });
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe("createPickState", () => {
  test("starts with no picks, no selection, zero spent", () => {
    const state = createPickState(ch1);
    expect(state.picks.size).toBe(0);
    expect(state.budgetSpent).toBe(0);
    expect(state.selectedCandidateId).toBeNull();
  });

  test("remainingBudget equals challenge budget at start", () => {
    const state = createPickState(ch1);
    expect(remainingBudget(state, ch1)).toBe(12);
  });

  test("canConfirm is false when no picks", () => {
    const state = createPickState(ch1);
    expect(canConfirm(state)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SELECT_CANDIDATE
// ---------------------------------------------------------------------------

describe("SELECT_CANDIDATE", () => {
  test("selects a candidate", () => {
    const state = select(createPickState(ch1), campos.id);
    expect(state.selectedCandidateId).toBe(campos.id);
  });

  test("deselects (toggle) when same candidate selected again", () => {
    const s1 = select(createPickState(ch1), campos.id);
    const s2 = select(s1, campos.id);
    expect(s2.selectedCandidateId).toBeNull();
  });

  test("switches to a different candidate", () => {
    const s1 = select(createPickState(ch1), campos.id);
    const s2 = select(s1, lavolpe.id);
    expect(s2.selectedCandidateId).toBe(lavolpe.id);
  });

  test("selecting does NOT change picks or budget", () => {
    const state = select(createPickState(ch1), campos.id);
    expect(state.picks.size).toBe(0);
    expect(state.budgetSpent).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// PLACE: basic placement
// ---------------------------------------------------------------------------

describe("PLACE: basic placement", () => {
  test("places candidate in an empty compatible slot", () => {
    const s0 = createPickState(ch1);
    const s1 = place(s0, lavolpe, GOL_SLOT);
    expect(s1.picks.get(GOL_SLOT.slotId)).toBe(lavolpe);
    expect(s1.budgetSpent).toBe(1);
    expect(s1.selectedCandidateId).toBeNull();
  });

  test("deselects candidate after placement", () => {
    const s0 = select(createPickState(ch1), lavolpe.id);
    const s1 = place(s0, lavolpe, GOL_SLOT);
    expect(s1.selectedCandidateId).toBeNull();
  });

  test("PLACE on incompatible slot is a no-op (canFill fails)", () => {
    const s0 = select(createPickState(ch1), coly.id);
    const s1 = place(s0, coly, GOL_SLOT); // coly is LD only
    expect(s1.picks.size).toBe(0);
    expect(s1.selectedCandidateId).toBe(coly.id); // still selected
  });

  test("PLACE blocks when cost exceeds remaining budget", () => {
    // Build a state where remaining = 1 star
    // campos(4)+coly(3)+parker(1)+pienaar(4)=12; remaining=0
    let state = createPickState(ch1);
    state = place(state, campos, GOL_SLOT);
    state = place(state, coly, LD_SLOT);
    state = place(state, parker, PD_SLOT);
    state = place(state, pienaar, MEI_SLOT);
    expect(state.budgetSpent).toBe(12);
    expect(remainingBudget(state, ch1)).toBe(0);

    // dosAntos(2) in PE → net cost = 2, remaining = 0 → blocked
    state = place(state, dosAntos, PE_SLOT);
    expect(state.picks.get(PE_SLOT.slotId)).toBeUndefined();
    expect(state.budgetSpent).toBe(12);
    expect(state.picks.size).toBe(4); // still only 4 picks
  });

  test("exactly spending all 12 stars is allowed", () => {
    let state = createPickState(ch1);
    // campos(4)+coly(3)+parker(1)+guardado(2)+dosAntos(2) = 12
    state = place(state, campos, GOL_SLOT);
    state = place(state, coly, LD_SLOT);
    state = place(state, parker, PD_SLOT);
    state = place(state, guardado, MEI_SLOT);
    state = place(state, dosAntos, PE_SLOT);
    expect(state.budgetSpent).toBe(12);
    expect(remainingBudget(state, ch1)).toBe(0);
    expect(canConfirm(state)).toBe(true);
  });

  test("attempting to spend 13+ stars is blocked", () => {
    let state = createPickState(ch1);
    // campos(4)+coly(3)+parker(1)+pienaar(4) = 12
    state = place(state, campos, GOL_SLOT);
    state = place(state, coly, LD_SLOT);
    state = place(state, parker, PD_SLOT);
    state = place(state, pienaar, MEI_SLOT);
    expect(state.budgetSpent).toBe(12);
    // dosAntos(2) in PE → net = 2 > remaining(0) → blocked
    state = place(state, dosAntos, PE_SLOT);
    expect(state.picks.get(PE_SLOT.slotId)).toBeUndefined();
    expect(state.budgetSpent).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// PLACE: replace and refund
// ---------------------------------------------------------------------------

describe("PLACE: replacing an existing pick", () => {
  test("replaces occupant, refunds cost, places new player", () => {
    let state = createPickState(ch1);
    state = place(state, campos, GOL_SLOT); // campos tier-4
    expect(state.budgetSpent).toBe(4);

    state = place(state, lavolpe, GOL_SLOT); // replace with lavolpe tier-1
    expect(state.picks.get(GOL_SLOT.slotId)).toBe(lavolpe);
    expect(state.budgetSpent).toBe(1); // refund 4, spend 1
  });

  test("replacing with a more expensive player increments budget correctly", () => {
    let state = createPickState(ch1);
    state = place(state, lavolpe, GOL_SLOT); // tier-1
    expect(state.budgetSpent).toBe(1);
    state = place(state, campos, GOL_SLOT); // replace with tier-4
    expect(state.picks.get(GOL_SLOT.slotId)).toBe(campos);
    expect(state.budgetSpent).toBe(4);
  });

  test("move semantics: placing a player already in another slot clears the original", () => {
    // tshabalala covers both MEI and PE
    let state = createPickState(ch1);
    state = place(state, tshabalala, MEI_SLOT);
    expect(state.picks.get(MEI_SLOT.slotId)).toBe(tshabalala);
    expect(state.budgetSpent).toBe(3);

    // Move tshabalala from MEI to PE
    state = place(state, tshabalala, PE_SLOT);
    expect(state.picks.get(PE_SLOT.slotId)).toBe(tshabalala);
    expect(state.picks.get(MEI_SLOT.slotId)).toBeUndefined(); // cleared
    expect(state.budgetSpent).toBe(3); // net zero: same player, same cost
  });

  test("replacement is blocked when it would overspend even after refund", () => {
    let state = createPickState(ch1);
    // Spend 11: coly(3)+parker(1)+tshabalala(3)+pienaar(4)=11; GOL empty
    state = place(state, coly, LD_SLOT);
    state = place(state, parker, PD_SLOT);
    state = place(state, tshabalala, MEI_SLOT);
    state = place(state, pienaar, PE_SLOT);
    state = place(state, lavolpe, GOL_SLOT); // +1 = 12 total
    expect(state.budgetSpent).toBe(12);

    // Try replacing lavolpe(1) with campos(4): net = 4−1 = +3, remaining=0 → blocked
    state = place(state, campos, GOL_SLOT);
    expect(state.picks.get(GOL_SLOT.slotId)).toBe(lavolpe);
    expect(state.budgetSpent).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// REMOVE
// ---------------------------------------------------------------------------

describe("REMOVE", () => {
  test("removes a picked player and refunds cost", () => {
    let state = createPickState(ch1);
    state = place(state, campos, GOL_SLOT);
    expect(state.budgetSpent).toBe(4);

    state = remove(state, GOL_SLOT.slotId);
    expect(state.picks.get(GOL_SLOT.slotId)).toBeUndefined();
    expect(state.budgetSpent).toBe(0);
  });

  test("REMOVE on empty slot is a no-op (returns same reference)", () => {
    const state = createPickState(ch1);
    const next = remove(state, GOL_SLOT.slotId);
    expect(next).toBe(state);
  });

  test("REMOVE does not change selectedCandidateId", () => {
    let state = createPickState(ch1);
    state = place(state, campos, GOL_SLOT);
    state = select(state, coly.id);
    state = remove(state, GOL_SLOT.slotId);
    expect(state.selectedCandidateId).toBe(coly.id);
  });
});

// ---------------------------------------------------------------------------
// RESET
// ---------------------------------------------------------------------------

describe("RESET", () => {
  test("clears all picks, resets budget and selection", () => {
    let state = createPickState(ch1);
    state = place(state, campos, GOL_SLOT);
    state = select(state, coly.id);
    state = reset(state);
    expect(state.picks.size).toBe(0);
    expect(state.budgetSpent).toBe(0);
    expect(state.selectedCandidateId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// canConfirm
// ---------------------------------------------------------------------------

describe("canConfirm", () => {
  function fillAllSlots(): PickState {
    let state = createPickState(ch1);
    // lavolpe(1)+coly(3)+parker(1)+guardado(2)+dosAntos(2) = 9 → within budget
    state = place(state, lavolpe, GOL_SLOT);
    state = place(state, coly, LD_SLOT);
    state = place(state, parker, PD_SLOT);
    state = place(state, guardado, MEI_SLOT);
    state = place(state, dosAntos, PE_SLOT);
    return state;
  }

  test("canConfirm is true when all 5 open slots are filled", () => {
    const state = fillAllSlots();
    expect(state.picks.size).toBe(5);
    expect(canConfirm(state)).toBe(true);
  });

  test("canConfirm is false with only 4 picks", () => {
    let state = createPickState(ch1);
    state = place(state, lavolpe, GOL_SLOT);
    state = place(state, coly, LD_SLOT);
    state = place(state, parker, PD_SLOT);
    state = place(state, guardado, MEI_SLOT);
    expect(canConfirm(state)).toBe(false);
  });

  test("canConfirm becomes false after removing a pick", () => {
    let state = fillAllSlots();
    expect(canConfirm(state)).toBe(true);
    state = remove(state, GOL_SLOT.slotId);
    expect(canConfirm(state)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// remainingBudget
// ---------------------------------------------------------------------------

describe("remainingBudget", () => {
  test("decreases when picks are placed", () => {
    let state = createPickState(ch1);
    state = place(state, campos, GOL_SLOT); // tier-4
    expect(remainingBudget(state, ch1)).toBe(8); // 12-4
  });

  test("increases when a pick is removed", () => {
    let state = createPickState(ch1);
    state = place(state, campos, GOL_SLOT);
    state = remove(state, GOL_SLOT.slotId);
    expect(remainingBudget(state, ch1)).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// placeableSlotIds
// ---------------------------------------------------------------------------

describe("placeableSlotIds", () => {
  test("returns slot ids that candidate can fill (compatible + affordable)", () => {
    const state = createPickState(ch1);
    // tshabalala covers MEI and PE
    const ids = placeableSlotIds(state, tshabalala, ch1);
    expect(ids).toContain(MEI_SLOT.slotId);
    expect(ids).toContain(PE_SLOT.slotId);
    expect(ids).not.toContain(GOL_SLOT.slotId);
    expect(ids).not.toContain(LD_SLOT.slotId);
  });

  test("includes an occupied slot (replacement is always valid if affordable)", () => {
    let state = createPickState(ch1);
    state = place(state, guardado, MEI_SLOT);

    // tshabalala covers MEI (occupied by guardado) and PE (empty)
    const ids = placeableSlotIds(state, tshabalala, ch1);
    expect(ids).toContain(MEI_SLOT.slotId); // replace guardado
    expect(ids).toContain(PE_SLOT.slotId);  // fill empty
  });

  test("includes slot the candidate already occupies (for visual highlight / move)", () => {
    let state = createPickState(ch1);
    state = place(state, lavolpe, GOL_SLOT);
    const ids = placeableSlotIds(state, lavolpe, ch1);
    expect(ids).toContain(GOL_SLOT.slotId);
  });

  test("excludes slots unaffordable even accounting for refunds", () => {
    let state = createPickState(ch1);
    // Spend 11: coly(3)+parker(1)+tshabalala(3)+pienaar(4)=11; GOL empty
    state = place(state, coly, LD_SLOT);
    state = place(state, parker, PD_SLOT);
    state = place(state, tshabalala, MEI_SLOT);
    state = place(state, pienaar, PE_SLOT);
    expect(state.budgetSpent).toBe(11);

    // campos costs 4 → 11+4=15 > 12 → no placeable slots
    const ids = placeableSlotIds(state, campos, ch1);
    expect(ids).toHaveLength(0);

    // lavolpe costs 1 → 11+1=12 → GOL is placeable
    const ids2 = placeableSlotIds(state, lavolpe, ch1);
    expect(ids2).toContain(GOL_SLOT.slotId);
  });

  test("move: candidate already in a slot is 'free' to move anywhere compatible", () => {
    let state = createPickState(ch1);
    // Place tshabalala in MEI
    state = place(state, tshabalala, MEI_SLOT);
    expect(state.budgetSpent).toBe(3);

    // When re-selected, moving tshabalala doesn't cost extra (candidateRefund = 3)
    // Both MEI and PE should be placeable
    const ids = placeableSlotIds(state, tshabalala, ch1);
    expect(ids).toContain(MEI_SLOT.slotId);
    expect(ids).toContain(PE_SLOT.slotId);
  });
});

// ---------------------------------------------------------------------------
// picksAsArray
// ---------------------------------------------------------------------------

describe("picksAsArray", () => {
  test("converts Map to PickedSlot array", () => {
    let state = createPickState(ch1);
    state = place(state, lavolpe, GOL_SLOT);
    const arr = picksAsArray(state);
    expect(arr).toHaveLength(1);
    expect(arr[0]!.slotId).toBe(GOL_SLOT.slotId);
    expect(arr[0]!.player).toBe(lavolpe);
  });

  test("empty state returns empty array", () => {
    expect(picksAsArray(createPickState(ch1))).toHaveLength(0);
  });
});
