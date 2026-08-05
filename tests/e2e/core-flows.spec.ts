import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("public experience is clear and accessible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Learn investing by doing." })).toBeVisible();
  await expect(page.getByText(/deterministic practice data/i).first()).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("learning outcomes stack without overlap on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const section = page.getByRole("region", { name: "Winning is clear. Learning is richer." });
  const copy = section.getByRole("heading", { name: "Winning is clear. Learning is richer." }).locator("..");
  const recognitionCard = section.getByText("What teachers can recognize").locator("..");
  const [copyBox, cardBox] = await Promise.all([copy.boundingBox(), recognitionCard.boundingBox()]);

  expect(copyBox).not.toBeNull();
  expect(cardBox).not.toBeNull();
  if (!copyBox || !cardBox) throw new Error("Learning outcomes content did not render");

  expect(copyBox.width).toBeGreaterThan(340);
  expect(cardBox.y).toBeGreaterThanOrEqual(copyBox.y + copyBox.height + 32);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("health is public but market jobs reject anonymous requests", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBe(true);
  await expect(health.json()).resolves.toMatchObject({ status: "ok", database: "ok" });

  const marketJob = await request.post("/api/jobs/market");
  expect(marketJob.status()).toBe(401);
});

test("teacher demo exposes financial and learning evidence separately", async ({ page }) => {
  await page.goto("/teacher/demo");
  await expect(page.getByRole("heading", { name: /Good afternoon, Ms. Rivera/i })).toBeVisible();
  await expect(page.getByText("Class equity")).toBeVisible();
  await expect(page.getByText("Labs completed")).toBeVisible();
  await page.getByRole("link", { name: "Reports" }).click();
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await expect(page.getByText("Financial standings")).toBeVisible();
  await expect(page.getByText("Learning evidence")).toBeVisible();
});

test("student can sign in and submit a simulated order", async ({ page }) => {
  await page.goto("/join");
  await page.getByLabel("Class code").fill("OAK-724");
  await page.getByLabel("Username").fill("AveryFox");
  await page.getByLabel("PIN").fill("2468");
  await page.getByRole("button", { name: "Enter Market Lab" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: /Good afternoon, Avery/i })).toBeVisible();

  await page.goto("/app/trade/AAPL");
  await page.getByLabel("Shares").fill("0.001");
  await page.getByLabel("Why does this decision make sense?").fill("I expect services demand to support Apple, but weaker device sales would change my view.");
  await page.getByRole("button", { name: /Review and submit buy/i }).click();
  await expect(page).toHaveURL(/\/app\/orders\?placed=(filled|queued|open)&symbol=AAPL/);
  await expect(page.getByRole("heading", { name: "Your orders" })).toBeVisible();
});
