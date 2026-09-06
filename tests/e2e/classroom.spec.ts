import { randomBytes, randomUUID, createHash } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";
import { test as base, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { ClassroomState, PricePack } from "../../src/lib/classroom/model";
import { fixtureState, fixturePack } from "../fixtures/classroom";

loadEnvConfig(process.cwd());
const connectionString = (process.env.DATABASE_URL ?? "").replace(/([?&])sslmode=(?:prefer|require|verify-ca)(?=&|$)/, "$1sslmode=verify-full");
const pool = new Pool({ connectionString, max: 2 });
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
type Fixture = { state: ClassroomState; gameId: string; portfolioId: string; sessionToken: string; newPack: PricePack };
const test = base.extend<{ fixture: Fixture }>({
  fixture: async ({}, provide) => {
    const gameId = randomUUID(), studentId = randomUUID(), portfolioId = randomUUID(), deviceId = randomUUID();
    const token = randomBytes(32).toString("hex"), sessionToken = randomBytes(32).toString("hex");
    const { rows: assets } = await pool.query("select id from instruments where symbol = 'AAPL' limit 1");
    if (!assets[0]) throw new Error("Seed the market catalog before running classroom integration tests.");
    const state = fixtureState();
    state.deviceId = deviceId; state.studentId = studentId; state.token = token;
    state.pack.id = randomUUID(); state.pack.deviceId = deviceId; state.pack.assets.AAPL.instrumentId = assets[0].id;
    state.pack.fetchedAt = new Date(Date.now() - 60_000).toISOString();
    state.packs = { [state.pack.id]: state.pack };
    const newPack = fixturePack("120.000000", randomUUID());
    newPack.deviceId = deviceId; newPack.fetchedAt = new Date(Date.now() + 1000).toISOString(); newPack.assets.AAPL.instrumentId = assets[0].id;
    await pool.query("insert into games(id,name,join_code,status,starts_at,ends_at) values($1,'Automated offline verification',$2,'active','2026-01-01','2099-01-01')", [gameId, `T-${gameId.slice(0, 8)}`]);
    try {
      await pool.query("insert into students(id,game_id,username,display_name,pin_hash) values($1,$2,'TestFox','Test Fox','test-not-a-login')", [studentId, gameId]);
      await pool.query("insert into portfolios(id,game_id,student_id,cash_balance) values($1,$2,$3,100000)", [portfolioId, gameId, studentId]);
      await pool.query("insert into student_sessions(student_id,token_hash,expires_at) values($1,$2,now() + interval '1 hour')", [studentId, hash(sessionToken)]);
      await pool.query("insert into classroom_devices(id,portfolio_id,token_hash,label,portfolio_version) values($1,$2,$3,'Test Fire',1)", [deviceId, portfolioId, hash(token)]);
      for (const pack of [state.pack, newPack]) await pool.query("insert into classroom_price_packs(id,device_id,payload) values($1,$2,$3)", [pack.id, deviceId, JSON.stringify(pack)]);
      await provide({ state, gameId, portfolioId, sessionToken, newPack });
    } finally {
      // Only this test's UUID-owned records; never reset the shared demo/class.
      await pool.query("delete from cash_ledger where portfolio_id=$1", [portfolioId]);
      await pool.query("delete from fills where portfolio_id=$1", [portfolioId]);
      await pool.query("delete from audit_events where game_id=$1", [gameId]);
      await pool.query("delete from games where id=$1", [gameId]);
    }
  },
});
test.afterAll(async () => { await pool.end(); });

test("classroom reopens offline, buys/sells immediately, retries lost response once, and adopts refreshed prices", async ({ page, context, fixture, browser }) => {
  test.setTimeout(120_000);
  // Deterministic provider/setup fixture. Uploads use the REAL API and database;
  // immutable price packs above are server-owned test records.
  await page.route("**/api/classroom/setup", (route) => route.fulfill({ json: fixture.state }));
  await page.route("**/api/classroom/prices", (route) => route.fulfill({ json: fixture.state.pack }));
  await page.goto("/classroom");
  await expect(page.getByText("✓ App downloaded for offline use")).toBeVisible();
  await page.getByLabel("Tablet label").fill("Fire 01");
  await page.getByRole("button", { name: "Prepare this device" }).click();
  await expect(page.getByText("Ready for offline use", { exact: true })).toBeVisible();
  await expect(page.getByText("All trades backed up", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sync & refresh now" })).toBeEnabled();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId("cash")).toHaveText("$100,000.00");
  await page.getByRole("button", { name: "Discover & trade", exact: true }).click();
  await page.getByLabel("Shares", { exact: true }).fill("10");
  await page.getByLabel("Why does this decision make sense?").fill("I expect customers to keep buying phones.");
  await page.getByRole("button", { name: "Buy now at saved price" }).click();
  await expect(page.getByRole("status")).toContainText("Bought 10 AAPL at $100.00");
  await page.getByRole("button", { name: "Portfolio", exact: true }).click();
  await expect(page.getByTestId("cash")).toHaveText("$99,000.00");
  await expect(page.getByTestId("shares-AAPL")).toHaveText("10");
  // Close the tab and reopen from its bookmark while completely offline.
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto("/classroom");
  await expect(reopened.getByTestId("cash")).toHaveText("$99,000.00");
  await reopened.getByRole("button", { name: "Trade AAPL", exact: true }).click();
  await reopened.getByLabel("Sell", { exact: true }).check();
  await reopened.getByLabel("Shares", { exact: true }).fill("4");
  await reopened.getByLabel("Why does this decision make sense?").fill("I want some cash available for another investment.");
  await reopened.getByRole("button", { name: "Sell now at saved price" }).click();
  await expect(reopened.getByRole("status")).toContainText("Sold 4 AAPL at $100.00");
  await expect(reopened.getByText("2 trades saved on tablet", { exact: true })).toBeVisible();
  await reopened.route("**/api/classroom/prices", (route) => route.fulfill({ json: fixture.newPack }));
  // Server commits then the browser loses its response. Retry must not double-fill.
  let dropped = false;
  await reopened.route("**/api/classroom/sync", async (route) => {
    if (!dropped && route.request().postDataJSON().trades.length) {
      dropped = true;
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      await route.abort("connectionfailed");
    } else await route.continue();
  });
  await context.setOffline(false);
  await reopened.getByRole("button", { name: "Sync & refresh now" }).click();
  await expect.poll(async () => (await pool.query("select count(*)::int n from fills where portfolio_id=$1", [fixture.portfolioId])).rows[0].n).toBe(2);
  await expect(reopened.getByRole("button", { name: "Sync & refresh now" })).toBeEnabled();
  await reopened.getByRole("button", { name: "Sync & refresh now" }).click();
  await expect(reopened.getByText("All trades backed up", { exact: true })).toBeVisible();
  await reopened.getByRole("button", { name: "Portfolio", exact: true }).click();
  await expect(reopened.getByTestId("cash")).toHaveText("$99,400.00");
  await expect(reopened.getByTestId("equity")).toHaveText("$100,120.00");
  await reopened.getByRole("button", { name: "Trade AAPL", exact: true }).click();
  await reopened.getByLabel("Buy", { exact: true }).check();
  await reopened.getByLabel("Shares", { exact: true }).fill("1");
  await reopened.getByLabel("Why does this decision make sense?").fill("I have reviewed the updated price and still want to invest.");
  await reopened.getByRole("button", { name: "Buy now at saved price" }).click();
  await expect(reopened.getByRole("status")).toContainText("Bought 1 AAPL at $120.00");
  await expect(reopened.getByText("All trades backed up", { exact: true })).toBeVisible();
  const { rows: fills } = await pool.query("select price from fills where portfolio_id=$1 order by created_at", [fixture.portfolioId]);
  expect(fills.map((f) => Number(f.price))).toEqual([100, 100, 120]);
  const { rows: balances } = await pool.query("select cash_balance from portfolios where id=$1", [fixture.portfolioId]);
  expect(Number(balances[0].cash_balance)).toBe(99280);
  await reopened.getByRole("button", { name: "Portfolio", exact: true }).click();
  expect((await new AxeBuilder({ page: reopened }).analyze()).violations).toEqual([]);
  expect(await reopened.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await reopened.screenshot({ path: `test-results/classroom-${test.info().project.name}.png`, fullPage: true });
  await reopened.getByRole("button", { name: "Device & help", exact: true }).click();
  const downloadPromise = reopened.waitForEvent("download");
  await reopened.getByRole("button", { name: "Download backup", exact: true }).click();
  const backupPath = await (await downloadPromise).path();
  await reopened.close();
  const replacement = await browser.newContext();
  try {
    await replacement.route("**/api/classroom/prices", (route) => route.fulfill({ json: fixture.newPack }));
    const restored = await replacement.newPage();
    restored.on("dialog", (dialog) => dialog.accept());
    await restored.goto(new URL("/classroom", test.info().project.use.baseURL!).toString());
    await restored.getByLabel("Restore a teacher-held backup").setInputFiles(backupPath!);
    await expect(restored.getByTestId("cash")).toHaveText("$99,280.00");
    await expect(restored.getByText("All trades backed up", { exact: true })).toBeVisible();
    await restored.getByRole("button", { name: "History", exact: true }).click();
    await expect(restored.locator("tbody tr")).toHaveCount(3);
  } finally { await replacement.close(); }
});

test("sync rejects forged/foreign prices and sequence gaps, isolates devices, and serializes duplicate submissions", async ({ request, fixture }) => {
  const { state } = fixture;
  const headers = { Authorization: `Bearer ${state.token}` };
  const trade = { id: randomUUID(), sequence: 1, packId: state.pack.id, symbol: "AAPL", side: "buy", quantity: "1", rationale: "I expect customer demand to stay strong.", confidence: 3, executedAt: new Date().toISOString() };
  expect((await request.post("/api/classroom/sync", { data: { deviceId: state.deviceId, trades: [trade] } })).status()).toBe(401);
  expect((await request.post("/api/classroom/sync", { headers, data: { deviceId: randomUUID(), trades: [trade] } })).status()).toBe(401);
  expect((await request.post("/api/classroom/sync", { headers, data: { deviceId: state.deviceId, trades: [{ ...trade, packId: randomUUID() }] } })).status()).toBe(409);
  expect((await request.post("/api/classroom/sync", { headers, data: { deviceId: state.deviceId, trades: [{ ...trade, sequence: 2 }] } })).status()).toBe(409);
  const responses = await Promise.all([1, 2, 3].map(() => request.post("/api/classroom/sync", { headers, data: { deviceId: state.deviceId, trades: [trade] } })));
  expect(responses.map((r) => r.status())).toEqual([200, 200, 200]);
  expect((await pool.query("select count(*)::int n from fills where portfolio_id=$1", [fixture.portfolioId])).rows[0].n).toBe(1);
  expect((await request.post("/api/classroom/sync", { headers, data: { deviceId: state.deviceId, trades: [{ ...trade, quantity: "2" }] } })).status()).toBe(409);
  // No student cookie is needed: the assigned device continues beyond session expiry.
  expect((await request.post("/api/classroom/sync", { headers, data: { deviceId: state.deviceId, trades: [] } })).status()).toBe(200);
  expect((await request.post("/api/classroom/release", { headers, data: { deviceId: state.deviceId, lastSequence: 0 } })).status()).toBe(409);
  expect((await request.post("/api/classroom/release", { headers, data: { deviceId: state.deviceId, lastSequence: 1 } })).status()).toBe(200);
  expect((await request.post("/api/classroom/release", { headers, data: { deviceId: state.deviceId, lastSequence: 1 } })).status()).toBe(200);
  expect((await request.post("/api/classroom/sync", { headers, data: { deviceId: state.deviceId, trades: [] } })).status()).toBe(401);
});

test("setup requires a student, prevents a second device, and downloads real current provider prices", async ({ request, context, fixture, baseURL }) => {
  test.setTimeout(120_000);
  const identity = { deviceId: randomUUID(), token: randomBytes(32).toString("hex"), label: "Different tablet" };
  expect((await request.post("/api/classroom/setup", { data: identity })).status()).toBe(401);
  await context.addCookies([{ name: "market_lab_student", value: fixture.sessionToken, url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
  expect((await context.request.post("/api/classroom/setup", { data: identity })).status()).toBe(409);
  const own = await context.request.post("/api/classroom/setup", { data: { deviceId: fixture.state.deviceId, token: fixture.state.token, label: "Test Fire" } });
  expect(own.status(), await own.text()).toBe(200);
  const data = await own.json();
  expect(Object.keys(data.pack.assets).length).toBeGreaterThanOrEqual(12);
  expect(Number(data.pack.assets.AAPL.price)).toBeGreaterThan(0);
  expect(data.studentId).toBe(fixture.state.studentId);
});

test("corporate actions reconcile once after offline trades and protect prices until balances are updated", async ({ request, fixture }) => {
  test.setTimeout(120_000);
  // Unique instrument keeps the corporate-action fixture out of every other
  // portfolio, including the shared demonstration and real classroom records.
  const instrumentId = randomUUID(), splitId = randomUUID(), dividendId = randomUUID();
  const symbol = `T${instrumentId.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
  await pool.query("insert into instruments(id,symbol,name,exchange,base_price) values($1,$2,'Test action fixture','TEST',100)", [instrumentId, symbol]);
  const pack = structuredClone(fixture.state.pack);
  pack.id = randomUUID(); pack.assets = { [symbol]: { ...pack.assets.AAPL, symbol, instrumentId } };
  await pool.query("insert into classroom_price_packs(id,device_id,payload) values($1,$2,$3)", [pack.id, pack.deviceId, JSON.stringify(pack)]);
  const headers = { Authorization: `Bearer ${fixture.state.token}` };
  try {
    await pool.query("insert into corporate_actions(id,instrument_id,action_type,provider_event_id,effective_at,split_numerator,split_denominator) values($1,$2,'split',$3,now()-interval '1 second',2,1)", [splitId, instrumentId, `fixture-${splitId}`]);
    await pool.query("insert into corporate_actions(id,instrument_id,action_type,provider_event_id,effective_at,cash_amount_per_share) values($1,$2,'cash_dividend',$3,now()-interval '0.5 second',1)", [dividendId, instrumentId, `fixture-${dividendId}`]);
    // Ensure action dates fall after the assigned device's start.
    await pool.query("update classroom_devices set created_at=now()-interval '1 day' where id=$1", [pack.deviceId]);
    const trade = { id: randomUUID(), sequence: 1, packId: pack.id, symbol, side: "buy", quantity: "10", rationale: "Test the original quote before a split.", confidence: 3, executedAt: new Date().toISOString() };
    const synced = await request.post("/api/classroom/sync", { headers, data: { deviceId: pack.deviceId, trades: [trade] } });
    expect(synced.status(), await synced.text()).toBe(200);
    expect((await synced.json()).adjustmentsPending).toBe(true);
    // This test symbol has no provider quote: reconciliation commits exactly
    // once but cannot issue a new pack. The client must keep its recovery hold.
    await request.post("/api/classroom/reconcile", { headers, data: { deviceId: pack.deviceId, lastSequence: 1 } });
    await request.post("/api/classroom/reconcile", { headers, data: { deviceId: pack.deviceId, lastSequence: 1 } });
    const { rows } = await pool.query("select p.cash_balance, x.quantity,x.average_cost from portfolios p join positions x on x.portfolio_id=p.id where p.id=$1 and x.instrument_id=$2", [fixture.portfolioId, instrumentId]);
    expect(Number(rows[0].quantity)).toBe(20);
    expect(Number(rows[0].average_cost)).toBe(50);
    expect(Number(rows[0].cash_balance)).toBe(99020);
    expect((await pool.query("select count(*)::int n from corporate_action_applications where portfolio_id=$1", [fixture.portfolioId])).rows[0].n).toBe(2);
  } finally {
    await pool.query("delete from corporate_actions where id=any($1::uuid[])", [[splitId, dividendId]]);
    // Instrument is deleted after its referencing receipts/fills/positions.
    await pool.query("delete from cash_ledger where portfolio_id=$1", [fixture.portfolioId]);
    await pool.query("delete from fills where portfolio_id=$1", [fixture.portfolioId]);
    await pool.query("delete from orders where portfolio_id=$1", [fixture.portfolioId]);
    await pool.query("delete from positions where portfolio_id=$1 and instrument_id=$2", [fixture.portfolioId, instrumentId]);
    await pool.query("delete from instruments where id=$1", [instrumentId]);
  }
});

test("12 assigned tablets upload concurrently without mixing portfolios or duplicating retries", async ({ request, fixture }) => {
  test.setTimeout(120_000);
  const extras: string[] = [];
  const devices = [{ portfolioId: fixture.portfolioId, state: fixture.state }];
  try {
    for (let index = 2; index <= 12; index++) {
      const portfolioId = randomUUID(), studentId = randomUUID(), deviceId = randomUUID();
      const state = structuredClone(fixture.state);
      state.deviceId = deviceId; state.studentId = studentId; state.token = randomBytes(32).toString("hex"); state.pack.deviceId = deviceId; state.pack.id = randomUUID();
      await pool.query("insert into students(id,game_id,username,display_name,pin_hash) values($1,$2,$3,$3,'test-not-a-login')", [studentId, fixture.gameId, `Test${index}`]);
      await pool.query("insert into portfolios(id,game_id,student_id,cash_balance) values($1,$2,$3,100000)", [portfolioId, fixture.gameId, studentId]);
      extras.push(portfolioId);
      await pool.query("insert into classroom_devices(id,portfolio_id,token_hash,label,portfolio_version) values($1,$2,$3,$4,1)", [deviceId, portfolioId, hash(state.token), `Fire ${index}`]);
      await pool.query("insert into classroom_price_packs(id,device_id,payload) values($1,$2,$3)", [state.pack.id, deviceId, JSON.stringify(state.pack)]);
      devices.push({ portfolioId, state });
    }
    await Promise.all(devices.map(async ({ portfolioId, state }, index) => {
      const trade = { id: randomUUID(), sequence: 1, packId: state.pack.id, symbol: "AAPL", side: "buy", quantity: String(index + 1), rationale: "A distinct trade on each classroom tablet.", confidence: 3, executedAt: new Date().toISOString() };
      const options = { headers: { Authorization: `Bearer ${state.token}` }, data: { deviceId: state.deviceId, trades: [trade] } };
      const response = await request.post("/api/classroom/sync", options);
      expect(response.status(), await response.text()).toBe(200);
      expect((await request.post("/api/classroom/sync", options)).status()).toBe(200);
      const result = await pool.query("select cash_balance from portfolios where id=$1", [portfolioId]);
      expect(Number(result.rows[0].cash_balance)).toBe(100000 - (index + 1) * 100);
      expect((await pool.query("select count(*)::int n from fills where portfolio_id=$1", [portfolioId])).rows[0].n).toBe(1);
    }));
  } finally {
    for (const portfolioId of extras) {
      await pool.query("delete from cash_ledger where portfolio_id=$1", [portfolioId]);
      await pool.query("delete from fills where portfolio_id=$1", [portfolioId]);
    }
  }
});
