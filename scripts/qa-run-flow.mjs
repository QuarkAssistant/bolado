/**
 * Bolado run-flow QA (Phase B part 2).
 *
 * Drives a full roguelike run end-to-end with Playwright at 375×812
 * (fresh storage):
 *   home → onboarding (3 panels) → start run → Mercado (roll the dice,
 *   sign if affordable) → pre-match → transmissão (wait 2 beats → Pular)
 *   → receipts → loop until death or 4 stages survived (cap), with a
 *   mid-run reload that must resume the run. Then a desktop 1280×800
 *   render sanity pass.
 *
 * Asserts: no console errors, score/coins change during the run,
 * reload mid-run resumes. Targets:
 *   BOLADO_QA_URL  — deployed target (e.g. https://bolado.pages.dev)
 *   default        — http://127.0.0.1:5180 (local dev server)
 *
 * Quiet on success; exits 1 on first failure.
 */

import { chromium } from "@playwright/test";

const baseUrl = (process.env.BOLADO_QA_URL ?? "http://127.0.0.1:5180").replace(/\/$/, "");
const runUrl = `${baseUrl}/`;
const STAGE_CAP = 4;

function fail(name, message) {
  throw new Error(`${name}: ${message}`);
}

async function assertNoOverflow(page, name) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  if (overflow) fail(name, "horizontal overflow");
}

/** Track console errors / uncaught exceptions for end-of-flow assertion. */
function trackErrors(page, sink) {
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // Resource-load noise (missing favicon on previews etc.) isn't app failure.
    if (/Failed to load resource/.test(text)) return;
    sink.push(text);
  });
  page.on("pageerror", (err) => sink.push(`pageerror: ${err.message}`));
}

// ---------------------------------------------------------------------------
// Screen helpers
// ---------------------------------------------------------------------------

async function readTopBar(page) {
  const score = (await page.locator(".run-scorechip").innerText()).replace(/\D/g, "");
  const coins = (await page.locator(".bld-coin--wallet").innerText()).replace(/\D/g, "");
  return { score: Number(score), coins: Number(coins) };
}

async function dismissOnboarding(page, name) {
  await page.locator('[data-testid="run-onboarding"]').waitFor({ timeout: 10000 });
  for (let i = 0; i < 3; i += 1) {
    await page.locator('[data-testid="run-onboarding-next"]').click();
  }
  if ((await page.locator('[data-testid="run-onboarding"]').count()) > 0) {
    fail(name, "onboarding overlay still visible after 3 panel advances");
  }
}

/** One Mercado visit: roll the dice, sign an affordable player if possible. */
async function workTheMercado(page, name) {
  await page.locator(".bld-shop").waitFor({ timeout: 10000 });

  const dice = page.locator(".bld-dice");
  if ((await dice.count()) === 0) return; // signing window already closed
  await dice.click();

  // Offers deal in after the roll animation
  await page
    .locator(".run-card-row .run-figbtn")
    .first()
    .waitFor({ timeout: 10000 })
    .catch(() => fail(name, "dice rolled but no player offers appeared"));

  const players = page.locator(".bld-shop__section").first().locator(".run-figbtn:not([disabled])");
  const playerCount = await players.count();
  let signed = false;

  for (let i = 0; i < playerCount && !signed; i += 1) {
    await players.nth(i).click();
    const panel = page.locator(".run-panel");
    await panel.waitFor({ timeout: 5000 });

    const okSlots = page.locator(".run-shirtbtn--ok");
    if ((await okSlots.count()) > 0) {
      await okSlots.first().click();
      const hireBtn = panel.locator("button", { hasText: "Contratar" });
      if (await hireBtn.isEnabled()) {
        await hireBtn.click();
        signed = true;
        break;
      }
    }
    await panel.locator("button", { hasText: "Cancelar" }).click();
  }

  if (!signed) {
    // Nothing affordable/compatible — wave the offer through.
    const dismiss = page.locator("button", { hasText: "Dispensar oferta" });
    if ((await dismiss.count()) > 0) await dismiss.click();
  }
}

/** Pre-match → broadcast (2 beats then Pular) → receipts → continue.
 *  Returns "shop" | "death" | "glory". */
async function playMatch(page, name) {
  await page.locator("button", { hasText: "Ir para o jogo" }).click();
  await page.locator(".run-prematch").waitFor({ timeout: 10000 });
  await page.locator("button", { hasText: "Bola rolando" }).click();

  // Transmissão: kickoff beat is immediate; wait for a 2nd beat, then skip.
  await page.locator(".run-broadcast").waitFor({ timeout: 10000 });
  await page
    .locator(".run-broadcast__beats > :nth-child(2)")
    .waitFor({ timeout: 15000 })
    .catch(() => fail(name, "broadcast did not advance past the kickoff beat"));
  await page.locator(".run-broadcast__skip").click();

  // Receipts: verdict strap + both breakdown receipts
  await page.locator(".run-fulltime").waitFor({ timeout: 10000 });
  const receiptCount = await page.locator(".run-receipt").count();
  if (receiptCount !== 2) fail(name, `expected 2 receipts (pontos+moedas), found ${receiptCount}`);
  await assertNoOverflow(page, `${name}:receipts`);

  await page.locator('[data-testid="run-continue"]').click();

  // Where did we land?
  await page
    .locator('.bld-shop, [data-testid="run-death"], [data-testid="run-glory"]')
    .first()
    .waitFor({ timeout: 10000 });
  if ((await page.locator('[data-testid="run-death"]').count()) > 0) return "death";
  if ((await page.locator('[data-testid="run-glory"]').count()) > 0) return "glory";
  return "shop";
}

// ---------------------------------------------------------------------------
// Mobile full-run flow
// ---------------------------------------------------------------------------

async function runMobileFlow(browser) {
  const name = "mobile-run";
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  trackErrors(page, consoleErrors);

  // 1. Home + onboarding (fresh storage shows it unprompted)
  await page.goto(runUrl, { waitUntil: "networkidle" });
  const title = await page.title();
  if (!/bolado/i.test(title)) fail(name, `page title missing Bolado brand: "${title}"`);
  await dismissOnboarding(page, `${name}:onboarding`);
  await page.locator('[data-testid="run-start"]').waitFor({ timeout: 5000 });
  await assertNoOverflow(page, `${name}:home`);

  // 2. Start the run → first Mercado
  await page.locator('[data-testid="run-start"]').click();
  await page.locator(".bld-shop").waitFor({ timeout: 10000 });
  const start = await readTopBar(page);
  await assertNoOverflow(page, `${name}:mercado`);

  // 3. Play stages until death/glory or the cap
  let outcome = "shop";
  let stagesPlayed = 0;
  let reloadTested = false;

  while (outcome === "shop" && stagesPlayed < STAGE_CAP) {
    await workTheMercado(page, `${name}:mercado-${stagesPlayed}`);
    outcome = await playMatch(page, `${name}:match-${stagesPlayed}`);
    stagesPlayed += 1;

    // 4. Mid-run reload must resume the run (not the home screen)
    if (outcome === "shop" && !reloadTested) {
      const stageLabel = (await page.locator(".bld-shop__header .bld-label").innerText()).trim();
      await page.reload({ waitUntil: "networkidle" });
      await page
        .locator(".bld-shop")
        .waitFor({ timeout: 10000 })
        .catch(() => fail(name, "reload mid-run did not resume to the Mercado"));
      const resumedLabel = (await page.locator(".bld-shop__header .bld-label").innerText()).trim();
      if (resumedLabel !== stageLabel) {
        fail(name, `reload changed the stage: "${stageLabel}" → "${resumedLabel}"`);
      }
      const resumed = await readTopBar(page);
      if (Number.isNaN(resumed.score) || Number.isNaN(resumed.coins)) {
        fail(name, "run HUD unreadable after reload");
      }
      reloadTested = true;
    }
  }

  if (stagesPlayed === 0) fail(name, "no stage was ever played");
  if (!reloadTested && outcome === "shop") fail(name, "mid-run reload was never exercised");

  // 5. Score/coins must have moved during the run (signings, payouts, points)
  if (outcome === "shop") {
    const end = await readTopBar(page);
    if (end.score === start.score && end.coins === start.coins) {
      fail(name, `score/coins never changed (score ${start.score}, coins ${start.coins})`);
    }
  } else {
    // Death/glory framing: score line + restart visible
    const screenSel = outcome === "death" ? '[data-testid="run-death"]' : '[data-testid="run-glory"]';
    if (!(await page.locator(`${screenSel} .bld-screen__scoreline`).isVisible())) {
      fail(name, `${outcome} screen missing the run score line`);
    }
    if (!(await page.locator('[data-testid="run-restart"]').isVisible())) {
      fail(name, `${outcome} screen missing BORA DE NOVO`);
    }
  }

  // 6. Zero console errors across the whole flow
  if (consoleErrors.length > 0) {
    fail(name, `console errors:\n  ${consoleErrors.join("\n  ")}`);
  }

  await page.screenshot({ path: "/tmp/bolado-run-mobile.png", fullPage: true });
  await context.close();
  return { stagesPlayed, outcome };
}

// ---------------------------------------------------------------------------
// Desktop render sanity (1280×800, fresh storage)
// ---------------------------------------------------------------------------

async function runDesktopPass(browser) {
  const name = "desktop-run";
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const consoleErrors = [];
  trackErrors(page, consoleErrors);

  await page.goto(runUrl, { waitUntil: "networkidle" });
  await dismissOnboarding(page, `${name}:onboarding`);
  await page.locator('[data-testid="run-start"]').waitFor({ timeout: 10000 });
  await assertNoOverflow(page, name);
  await page.locator('[data-testid="run-start"]').click();
  await page.locator(".bld-shop").waitFor({ timeout: 10000 });
  await assertNoOverflow(page, `${name}:mercado`);
  if (consoleErrors.length > 0) fail(name, `console errors:\n  ${consoleErrors.join("\n  ")}`);

  await page.screenshot({ path: "/tmp/bolado-run-desktop.png", fullPage: true });
  await context.close();
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const browser = await chromium.launch({ headless: true });
try {
  let summary;
  try {
    summary = await runMobileFlow(browser);
    await runDesktopPass(browser);
  } catch (err) {
    if (err?.message?.includes("ERR_CONNECTION_REFUSED") || err?.message?.includes("net::ERR_")) {
      console.error(
        "QA target not reachable. Start a server (npx vite --host 127.0.0.1 --port 5180) or set BOLADO_QA_URL.",
      );
    }
    throw err;
  }
  console.log(`qa:run OK (${runUrl}) — ${summary.stagesPlayed} stage(s), ended at ${summary.outcome}`);
} finally {
  await browser.close();
}
