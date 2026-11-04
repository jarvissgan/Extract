import { expect, test, type Page } from "@playwright/test";

// Signs in through the offline dev login page.
const devLogin = async (page: Page, email: string) => {
  await page.goto("/dev-login?returnTo=/setup");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Sign in" }).click();
};

const uniqueEmail = (name: string) => `${name}-${Date.now()}@e2e.local`;

test("seeded user sees their dashboard and can open a transaction with the keyboard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("button", { name: /Dev \(dev@extract\.local\)/ }).click();

  await expect(page).toHaveURL(/\/home\/\w+/);
  await expect(page.getByRole("heading", { name: "Hello, Dev" })).toBeVisible();
  await expect(page.getByText("Budget remaining")).toBeVisible();
  await expect(page.locator("tbody tr").first()).toBeVisible();

  // keyboard: focus the first transaction link and press Enter
  const firstLink = page.locator("tbody tr a").first();
  const name = await firstLink.innerText();
  await firstLink.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Transaction details" })).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue(name);
});

test("a new user can sign up, add a repeating transaction and see it in their currency", async ({ page }) => {
  await devLogin(page, uniqueEmail("newbie"));

  await expect(page.getByRole("heading", { name: "Finish setting up your account" })).toBeVisible();
  await page.getByRole("textbox", { name: "Currency" }).click();
  await page.getByRole("option", { name: "SGD" }).click();
  await page.getByLabel("Monthly budget").fill("800");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/home\/\w+/);

  await page.getByRole("button", { name: "Add transaction" }).click();
  const dialog = page.getByRole("dialog", { name: "Add transaction" });
  await dialog.getByLabel("Name").fill("Gym membership");
  await dialog.getByLabel("Amount").fill("45");
  await dialog.getByLabel(/Repeat monthly/).check();
  await dialog.getByRole("button", { name: "Add", exact: true }).click();

  await expect(page.getByRole("link", { name: "Gym membership" })).toBeVisible();
  await expect(page.getByText("SGD 45.00").or(page.getByText("S$45.00")).first()).toBeVisible();
  await expect(page.getByText("of SGD 800.00").or(page.getByText("of S$800.00"))).toBeVisible();

  await page.getByText("Settings", { exact: true }).click();
  const recurring = page.getByRole("row", { name: /Gym membership/ });
  await expect(recurring).toBeVisible();
  await expect(recurring.getByRole("switch")).toBeChecked();
});

test("custom categories can be added and used", async ({ page }) => {
  await devLogin(page, uniqueEmail("categories"));
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/home\/\w+/);

  await page.getByText("Settings", { exact: true }).click();
  await page.getByLabel("New category").fill("Pets");
  await page.getByRole("button", { name: "Add", exact: true }).first().click();
  await expect(page.locator(".mantine-Badge-label", { hasText: "Pets" })).toBeVisible();

  await page.getByRole("button", { name: "Add transaction" }).click();
  const dialog = page.getByRole("dialog", { name: "Add transaction" });
  await dialog.getByLabel("Name").fill("Dog food");
  await dialog.getByLabel("Amount").fill("30");
  await dialog.getByRole("textbox", { name: "Category" }).click();
  await page.getByRole("option", { name: "Pets" }).click();
  await dialog.getByRole("button", { name: "Add", exact: true }).click();

  await page.getByText("Transactions", { exact: true }).click();
  await expect(page.getByRole("row", { name: /Dog food/ }).getByText("Pets")).toBeVisible();
});

test("transactions can be searched, exported and imported", async ({ page }) => {
  await devLogin(page, uniqueEmail("csv"));
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/home\/\w+/);
  await page.getByText("Transactions", { exact: true }).click();

  const today = new Date().toISOString().slice(0, 10);
  const csv = [
    "date,name,amount,category,note",
    `${today},Coffee,4.50,Food,`,
    `${today},"Train, return",3.20,transport,commute`,
    `${today},Book,12,,`,
  ].join("\n");

  await page.getByRole("button", { name: "Import CSV" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "t.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByText("3 transactions ready to import.")).toBeVisible();
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(3);

  await page.getByLabel("Search transactions").fill("train");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Train, return" })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const file = await (await download).path();
  const { readFile } = await import("node:fs/promises");
  const exported = await readFile(file, "utf8");
  expect(exported.split("\n")[0]).toBe("date,name,amount,category,note");
  expect(exported).toContain('"Train, return",3.20,Transport,commute');
});

test("bad CSV rows are reported and nothing is imported", async ({ page }) => {
  await devLogin(page, uniqueEmail("badcsv"));
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByText("Transactions", { exact: true }).click();

  await page.getByRole("button", { name: "Import CSV" }).click();
  const csv = "date,name,amount\nnot a date,Coffee,4\n2026-01-01,Tea,abc";
  await page.locator('input[type="file"]').setInputFiles({ name: "bad.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByText(/Line 2: can't read the date/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Import", exact: true })).toBeDisabled();
});

test("another user's sqid in the URL redirects to your own account", async ({ page }) => {
  await devLogin(page, "alice@extract.local");
  await expect(page).toHaveURL(/\/home\/(\w+)/);
  const own = page.url().split("/home/")[1];

  await page.goto("/home/NotMine123");
  await expect(page).toHaveURL(new RegExp(`/home/${own}`));
});
