/**
 * Tests for dayLock.ts:
 *   - Load returns null for missing/corrupt records
 *   - Save + load round-trips correctly
 *   - isChallengeCompleted reflects saved state
 *   - buildDayRecord produces valid shape
 *   - History list deduplicated + ordered
 *   - Storage failures degrade gracefully (mock localStorage errors)
 *
 * Uses an in-memory localStorage mock (no jsdom required).
 */

import { describe, expect, test, beforeEach, vi } from "vitest";
import {
  loadDayRecord,
  saveDayRecord,
  isChallengeCompleted,
  buildDayRecord,
  loadHistory,
  clearAllStorage,
} from "./dayLock";
import type { DayRecord } from "./dayLock";
import type { PickedSlot, DailyVerdict, DailyMatchResult } from "./types";

// ---------------------------------------------------------------------------
// In-memory localStorage mock (no jsdom required)
// ---------------------------------------------------------------------------

function createLocalStorageMock(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() { return Object.keys(store).length; },
  } as Storage;
}

const mockStorage = createLocalStorageMock();

// Patch globalThis.localStorage before module is used
Object.defineProperty(globalThis, "localStorage", {
  value: mockStorage,
  writable: true,
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockPlayer = {
  id: "mx-hugo",
  displayName: "Hugo Sánchez",
  nation: "Mexico",
  positions: ["CA"],
  eraBand: "80s-90s",
  attack: 93,
  midfield: 55,
  defense: 30,
  costTier: 4 as const,
  bioHook: "O craque do México",
};

const mockPicks: PickedSlot[] = [
  { slotId: "open-1", player: mockPlayer },
];

const mockVerdict: DailyVerdict = {
  points: 72,
  stars: 4,
  pickGrades: [
    { slotId: "open-1", playerId: "mx-hugo", grade: "🟩" },
  ],
};

const mockMatchResult: DailyMatchResult = {
  userGoals: 2,
  opponentGoals: 1,
  outcome: "win",
  goalEvents: [
    { minute: 22, side: "user", scorer: "Hugo Sánchez" },
    { minute: 67, side: "user", scorer: "Hugo Sánchez" },
    { minute: 80, side: "opponent", scorer: "World XI" },
  ],
};

// ---------------------------------------------------------------------------
// Setup: use jsdom's localStorage mock (vitest provides it)
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockStorage.clear();
});

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

describe("loadDayRecord", () => {
  test("returns null for missing challenge", () => {
    expect(loadDayRecord(999)).toBeNull();
  });

  test("returns null for corrupt JSON", () => {
    localStorage.setItem("bolado.day.1", "{not-valid-json}");
    expect(loadDayRecord(1)).toBeNull();
  });

  test("returns null for missing required fields", () => {
    localStorage.setItem("bolado.day.2", JSON.stringify({ foo: "bar" }));
    expect(loadDayRecord(2)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Save + load round-trip
// ---------------------------------------------------------------------------

describe("saveDayRecord + loadDayRecord", () => {
  test("round-trips a day record", () => {
    const record: DayRecord = buildDayRecord(1, mockPicks, mockVerdict, mockMatchResult);
    saveDayRecord(record);

    const loaded = loadDayRecord(1);
    expect(loaded).not.toBeNull();
    expect(loaded!.challengeId).toBe(1);
    expect(loaded!.verdict.points).toBe(72);
    expect(loaded!.verdict.stars).toBe(4);
    expect(loaded!.matchResult.userGoals).toBe(2);
    expect(loaded!.picks).toHaveLength(1);
    expect(loaded!.picks[0]!.player.displayName).toBe("Hugo Sánchez");
  });

  test("different challenges stored independently", () => {
    const r1 = buildDayRecord(1, mockPicks, mockVerdict, mockMatchResult);
    const r2 = buildDayRecord(2, mockPicks, { ...mockVerdict, points: 50, stars: 3 }, mockMatchResult);
    saveDayRecord(r1);
    saveDayRecord(r2);

    expect(loadDayRecord(1)?.verdict.points).toBe(72);
    expect(loadDayRecord(2)?.verdict.points).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// isChallengeCompleted
// ---------------------------------------------------------------------------

describe("isChallengeCompleted", () => {
  test("returns false before save", () => {
    expect(isChallengeCompleted(5)).toBe(false);
  });

  test("returns true after save", () => {
    const record = buildDayRecord(5, mockPicks, mockVerdict, mockMatchResult);
    saveDayRecord(record);
    expect(isChallengeCompleted(5)).toBe(true);
  });

  test("returns false for a different challenge ID", () => {
    const record = buildDayRecord(5, mockPicks, mockVerdict, mockMatchResult);
    saveDayRecord(record);
    expect(isChallengeCompleted(6)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildDayRecord
// ---------------------------------------------------------------------------

describe("buildDayRecord", () => {
  test("produces correct shape", () => {
    const record = buildDayRecord(3, mockPicks, mockVerdict, mockMatchResult);
    expect(record.challengeId).toBe(3);
    expect(record.picks).toBe(mockPicks);
    expect(record.verdict).toBe(mockVerdict);
    expect(record.matchResult).toBe(mockMatchResult);
    expect(typeof record.completedAt).toBe("string");
    expect(new Date(record.completedAt).toISOString()).toBe(record.completedAt);
  });
});

// ---------------------------------------------------------------------------
// History list
// ---------------------------------------------------------------------------

describe("loadHistory", () => {
  test("returns empty array when nothing saved", () => {
    expect(loadHistory()).toEqual([]);
  });

  test("records appear in history after save", () => {
    saveDayRecord(buildDayRecord(1, mockPicks, mockVerdict, mockMatchResult));
    saveDayRecord(buildDayRecord(3, mockPicks, mockVerdict, mockMatchResult));
    const history = loadHistory();
    expect(history).toContain(1);
    expect(history).toContain(3);
  });

  test("most recent comes first", () => {
    saveDayRecord(buildDayRecord(1, mockPicks, mockVerdict, mockMatchResult));
    saveDayRecord(buildDayRecord(2, mockPicks, mockVerdict, mockMatchResult));
    const history = loadHistory();
    expect(history[0]).toBe(2);
    expect(history[1]).toBe(1);
  });

  test("saving same challenge again deduplicates in history", () => {
    saveDayRecord(buildDayRecord(1, mockPicks, mockVerdict, mockMatchResult));
    saveDayRecord(buildDayRecord(2, mockPicks, mockVerdict, mockMatchResult));
    saveDayRecord(buildDayRecord(1, mockPicks, mockVerdict, mockMatchResult)); // re-save #1
    const history = loadHistory();
    const count1 = history.filter((id) => id === 1).length;
    expect(count1).toBe(1); // deduplicated
    expect(history[0]).toBe(1); // moved to front
  });

  test("returns empty array for corrupt history JSON", () => {
    localStorage.setItem("bolado.history", "{bad}");
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// clearAllStorage
// ---------------------------------------------------------------------------

describe("clearAllStorage", () => {
  test("removes all bolado.* keys", () => {
    saveDayRecord(buildDayRecord(1, mockPicks, mockVerdict, mockMatchResult));
    saveDayRecord(buildDayRecord(2, mockPicks, mockVerdict, mockMatchResult));
    clearAllStorage();
    expect(loadDayRecord(1)).toBeNull();
    expect(loadDayRecord(2)).toBeNull();
    expect(loadHistory()).toEqual([]);
  });

  test("leaves non-bolado keys intact", () => {
    localStorage.setItem("other-app-key", "value");
    saveDayRecord(buildDayRecord(1, mockPicks, mockVerdict, mockMatchResult));
    clearAllStorage();
    expect(localStorage.getItem("other-app-key")).toBe("value");
  });
});

// ---------------------------------------------------------------------------
// Graceful degradation: simulate localStorage errors
// ---------------------------------------------------------------------------

describe("storage failures degrade gracefully", () => {
  test("saveDayRecord does not throw when localStorage.setItem throws", () => {
    const origSetItem = mockStorage.setItem.bind(mockStorage);
    mockStorage.setItem = () => { throw new Error("QuotaExceededError"); };
    expect(() => {
      saveDayRecord(buildDayRecord(99, mockPicks, mockVerdict, mockMatchResult));
    }).not.toThrow();
    mockStorage.setItem = origSetItem;
  });

  test("loadDayRecord returns null when localStorage.getItem throws", () => {
    const origGetItem = mockStorage.getItem.bind(mockStorage);
    mockStorage.getItem = () => { throw new Error("SecurityError"); };
    expect(loadDayRecord(99)).toBeNull();
    mockStorage.getItem = origGetItem;
  });

  test("loadHistory returns empty array when localStorage.getItem throws", () => {
    const origGetItem = mockStorage.getItem.bind(mockStorage);
    mockStorage.getItem = () => { throw new Error("SecurityError"); };
    expect(loadHistory()).toEqual([]);
    mockStorage.getItem = origGetItem;
  });
});
