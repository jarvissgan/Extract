import { expect, test, type Page } from "@playwright/test";

// Runs in the "mobile" Playwright project (phone-sized, touch). Guards the rules in mobile.md:
// no sideways scrolling, bottom navigation, big enough tap targets, inputs that don't zoom on iOS.

const devLogin = async (page: Page, email: string) => {
  await page.goto("/dev-login?returnTo=/setup");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Sign in" }).click();
};

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });

// how far the page can scroll sideways (should be 0)
// buttons whose label doesn't fit (cut off), e.g. ["Add agai"]
const clippedButtonText = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("button, button *")]
      .filter((e) => (e as HTMLElement).offsetParent && e.scrollWidth > e.clientWidth + 1)
      .map((e) => e.textContent?.trim())
      .filter(Boolean)
  );

const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("no page scrolls sideways on a phone, in any appearance", async ({ page }) => {
  await page.goto("/");
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

  await devLogin(page, "alice@extract.local");
  await expect(page).toHaveURL(/\/home\//);

  for (const appearance of ["Dark", "Light", "A mode"]) {
    await page.locator(`[aria-label="${appearance}"]`).first().click();
    for (const tab of ["Home", "Transactions", "Reports", "Savings"]) {
      await nav(page).getByRole("link", { name: tab }).click();
      await page.waitForLoadState("networkidle");
      expect(await horizontalOverflow(page), `${tab} in ${appearance}`).toBeLessThanOrEqual(0);
    }
  }

  // the tab bar stays pinned to the bottom of the screen, and the end of a long page
  // can be scrolled fully above it
  await nav(page).getByRole("link", { name: "Reports" }).click();
  const lastLine = page.getByText("The current month is included");
  await expect(lastLine).toBeVisible();
  const viewportHeight = page.viewportSize()!.height;
  for (const y of [0, 600, 100_000]) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    const bar = (await nav(page).boundingBox())!;
    expect(Math.round(bar.y + bar.height), `tab bar at scroll ${y}`).toBeGreaterThanOrEqual(viewportHeight - 1);
  }
  const bar = (await nav(page).boundingBox())!;
  const text = (await lastLine.boundingBox())!;
  expect(text.y + text.height, "last line clears the tab bar").toBeLessThanOrEqual(bar.y);

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  expect(await horizontalOverflow(page), "Settings").toBeLessThanOrEqual(0);

  await nav(page).getByRole("link", { name: "Transactions" }).click();
  await page.locator('[data-testid="transaction-item"]').first().click();
  await expect(page.getByRole("heading", { name: "Transaction details" })).toBeVisible();
  expect(await horizontalOverflow(page), "Transaction details").toBeLessThanOrEqual(0);
  expect(await clippedButtonText(page), "button text cut off on Transaction details").toEqual([]);
});

test("bottom navigation, full-screen add, and a list instead of a table", async ({ page }) => {
  await devLogin(page, `phone-${Date.now()}@e2e.local`);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/home\//);

  // tap targets in the bottom bar are at least 44px tall
  const links = nav(page).getByRole("link");
  await expect(links).toHaveCount(4);
  for (const box of await Promise.all((await links.all()).map((l) => l.boundingBox()))) {
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }

  await nav(page).getByRole("button", { name: "Add transaction" }).click();
  const dialog = page.getByRole("dialog", { name: "Add transaction" });
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox!.width).toBeGreaterThanOrEqual(page.viewportSize()!.width - 1); // full screen

  // 16px+ text so iOS doesn't zoom into the field
  const fontSize = await dialog.getByRole("textbox", { name: "Name" }).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(16);

  await dialog.getByRole("textbox", { name: "Name" }).fill("Kaya toast");
  await dialog.getByLabel("Amount").fill("3.5");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog).toBeHidden();

  await nav(page).getByRole("link", { name: "Transactions" }).click();
  await expect(page.locator("table")).toHaveCount(0);
  await expect(page.locator('[data-testid="transaction-item"]', { hasText: "Kaya toast" })).toBeVisible();

  // account menu has Settings and Log out
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByRole("menuitem", { name: "Log out" })).toBeVisible();
});
