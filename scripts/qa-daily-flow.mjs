/**
 * Bolado daily-flow QA (Task 1.7).
 *
 * Drives the full daily loop end-to-end with Playwright:
 *   load → solve the puzzle (budget-aware) → ESCALAR → reveal → Pular →
 *   verdict asserts → Copiar feedback → reload day-lock → desktop pass.
 *
 * Targets, in priority order:
 *   BOLADO_QA_URL  — bolado deployment (app served at /)
 *   default        — http://127.0.0.1:5180/ (local dev server root)
 *
 * Quiet on success; exits 1 on first failure.
 */

import { chromium } from "@playwright/test";

const baseUrl = (process.env.BOLADO_QA_URL ?? "http://127.0.0.1:5180").replace(/\/$/, "");
const pagePath = process.env.BOLADO_QA_PATH ?? "/";
const dailyUrl = `${baseUrl}${pagePath}`;
const isRemoteTarget = !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(baseUrl);

function fail(name, message) {
  throw new Error(`${name}: ${message}`);
}

async function assertNoOverflow(page, name) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) fail(name, "horizontal overflow");
}

// ---------------------------------------------------------------------------
// Puzzle state readers (aria-labels carry the candidate/slot state)
// ---------------------------------------------------------------------------

async function readPuzzleState(page) {
  return page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('[data-testid="bolado-candidate"]')).map((button) => {
      const label = button.getAttribute("aria-label") ?? "";
      const parts = label.split(", ");
      const costMatch = label.match(/(\d+) estrelas?/);
      return {
        name: parts[0] ?? "",
        label,
        positions: (parts[1] ?? "").split("/").filter(Boolean),
        cost: costMatch ? Number(costMatch[1]) : Number.NaN,
        incompatible: label.includes("posição incompatível"),
        unaffordable: label.includes("orçamento insuficiente"),
        placed: label.includes("já escalado"),
      };
    });

    const openSlots = Array.from(document.querySelectorAll("button.bolado-pitch-slot--open")).map((button) => ({
      slotId: button.getAttribute("data-slot-id") ?? "",
      position: button.getAttribute("data-position") ?? "",
      filled: (button.getAttribute("aria-label") ?? "").includes("toque para remover"),
    }));

    const meter = document.querySelector('[role="meter"]');
    const budget = meter ? Number(meter.getAttribute("aria-valuemax")) : 12;

    return { candidates, openSlots, budget };
  });
}

/**
 * Budget-aware assignment: fill scarce slots first, trying cheap candidates
 * first, with backtracking so affordability is guaranteed when a solution exists.
 */
function solveAssignment(openSlots, candidates, budget) {
  const pool = candidates.filter((c) => !c.placed && Number.isFinite(c.cost));
  const compatible = (slot) => pool.filter((c) => c.positions.includes(slot.position));
  const order = [...openSlots].sort((a, b) => compatible(a).length - compatible(b).length);
  const used = new Set();

  function backtrack(index, spent, picks) {
    if (index === order.length) return picks;
    const slot = order[index];
    const options = compatible(slot)
      .filter((c) => !used.has(c.name))
      .sort((a, b) => a.cost - b.cost);
    for (const candidate of options) {
      if (spent + candidate.cost > budget) continue;
      used.add(candidate.name);
      const result = backtrack(index + 1, spent + candidate.cost, [...picks, { slot, candidate }]);
      if (result) return result;
      used.delete(candidate.name);
    }
    return null;
  }

  return backtrack(0, 0, []);
}

async function completePuzzle(page, name) {
  const { candidates, openSlots, budget } = await readPuzzleState(page);
  if (openSlots.length !== 5) fail(name, `expected 5 open slots, found ${openSlots.length}`);
  if (candidates.length < 5) fail(name, `expected candidate lista, found ${candidates.length} rows`);

  const assignment = solveAssignment(openSlots, candidates, budget);
  if (!assignment) fail(name, "no affordable position-compatible assignment found");

  for (const { slot, candidate } of assignment) {
    const escaped = candidate.name.replace(/"/g, '\\"');
    await page.locator(`[data-testid="bolado-candidate"][aria-label^="${escaped},"]`).first().click();
    await page.locator(`button[data-slot-id="${slot.slotId}"]`).click();
    // aria-label flips to "toque para remover" once the pick lands
    await page
      .locator(`button[data-slot-id="${slot.slotId}"][aria-label*="toque para remover"]`)
      .waitFor({ timeout: 5000 })
      .catch(() => fail(name, `placement did not land: ${candidate.name} → ${slot.slotId} (${slot.position})`));
  }

  const counter = await page.locator(".bolado-lista-count").innerText();
  if (counter.trim() !== "5/5") fail(name, `expected 5/5 picks, lista shows "${counter.trim()}"`);
}

// ---------------------------------------------------------------------------
// Mobile flow (375×812, fresh storage)
// ---------------------------------------------------------------------------

async function runMobileFlow(browser) {
  const name = "mobile-daily";
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => undefined);
  const page = await context.newPage();

  // 1. Load: BOLADO brand + challenge header
  await page.goto(dailyUrl, { waitUntil: "networkidle" });
  const title = await page.title();
  if (!/bolado/i.test(title)) fail(name, `page title missing Bolado brand: "${title}"`);
  await page.locator(".bolado-pick-screen").waitFor({ timeout: 10000 });
  const challengeNumber = (await page.locator(".bolado-pick-number").innerText()).trim();
  if (!/^#\d+$/.test(challengeNumber)) fail(name, `challenge number missing, got "${challengeNumber}"`);
  const theme = (await page.locator(".bolado-pick-theme").innerText()).trim();
  if (!theme) fail(name, "challenge theme text missing");
  await assertNoOverflow(page, `${name}:load`);

  // 2. Solve the puzzle programmatically
  await completePuzzle(page, `${name}:puzzle`);

  // 3. ESCALAR enabled → tap
  const confirm = page.locator('[data-testid="bolado-confirm-btn"]');
  if (await confirm.isDisabled()) fail(name, "ESCALAR still disabled after 5 picks");
  await confirm.click();

  // 4. Reveal: scoreboard visible → Pular
  await page.locator(".bolado-scoreboard").waitFor({ timeout: 10000 });
  await page.locator(".bolado-reveal-skip-btn").click();

  // 5. Verdict asserts
  await page.locator(".bolado-verdict-screen").waitFor({ timeout: 10000 });
  await page.locator(".bolado-verdict-actions").waitFor({ timeout: 15000 }); // staggered reveal
  if (!(await page.locator(".bolado-verdict-score").isVisible())) fail(name, "verdict score line not visible");
  if (!(await page.locator(".bolado-verdict-stars").isVisible())) fail(name, "verdict stars not visible");
  const gradeCount = await page.locator(".bolado-verdict-grade-item").count();
  if (gradeCount !== 5) fail(name, `expected 5 pick-grade entries, found ${gradeCount}`);
  if (!(await page.locator(".bolado-verdict-share-btn").isVisible())) fail(name, "share button not visible");
  if (!(await page.locator(".bolado-verdict-copy-btn").isVisible())) fail(name, "copy button not visible");

  // 6. Copiar → "Copiado" feedback (clipboard permissions can be flaky on
  //    remote/headless targets — degrade to a warning there)
  await page.locator(".bolado-verdict-copy-btn").click();
  try {
    await page.locator(".bolado-verdict-copy-btn", { hasText: /Copiado/ }).waitFor({ timeout: 4000 });
  } catch {
    if (isRemoteTarget) {
      console.warn(`${name}: WARN — "Copiado" feedback not observed against remote target (clipboard permission)`);
    } else {
      fail(name, '"Copiado" feedback did not appear after Copiar');
    }
  }

  // 7. Reload → verdict shows directly (day lock)
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".bolado-verdict-screen").waitFor({ timeout: 10000 });
  if ((await page.locator(".bolado-pick-screen").count()) > 0) fail(name, "day lock broken: pick screen visible after reload");

  await page.screenshot({ path: "/tmp/bolado-daily-mobile.png", fullPage: true });
  await context.close();
}

// ---------------------------------------------------------------------------
// Desktop quick pass (1280×800, fresh storage)
// ---------------------------------------------------------------------------

async function runDesktopPass(browser) {
  const name = "desktop-daily";
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  await page.goto(dailyUrl, { waitUntil: "networkidle" });
  await page.locator(".bolado-pick-screen").waitFor({ timeout: 10000 });
  await assertNoOverflow(page, name);

  await page.screenshot({ path: "/tmp/bolado-daily-desktop.png", fullPage: true });
  await context.close();
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const browser = await chromium.launch({ headless: true });
try {
  try {
    await runMobileFlow(browser);
    await runDesktopPass(browser);
  } catch (err) {
    if (err?.message?.includes("ERR_CONNECTION_REFUSED") || err?.message?.includes("net::ERR_")) {
      console.error(
        "QA target not reachable. Start a server (npx vite --host 127.0.0.1 --port 5180) or set BOLADO_QA_URL.",
      );
    }
    throw err;
  }
  console.log(`qa:daily OK (${dailyUrl})`);
} finally {
  await browser.close();
}
