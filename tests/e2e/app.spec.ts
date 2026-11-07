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
  await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue(name);
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
  await dialog.getByRole("textbox", { name: "Name" }).fill("Gym membership");
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
  await dialog.getByRole("textbox", { name: "Name" }).fill("Dog food");
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

  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByRole("menuitem", { name: "CSV file" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "t.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByText("3 transactions ready to import.")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(3);

  await page.getByLabel("Search transactions").fill("train");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Train, return" })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const file = await (await download).path();
  const { readFile } = await import("node:fs/promises");
  const exported = await readFile(file, "utf8");
  expect(exported.split("\n")[0]).toBe("date,name,amount,type,category,note");
  expect(exported).toContain('"Train, return",3.20,expense,Transport,commute');
});

test("bad CSV rows are reported and nothing is imported", async ({ page }) => {
  await devLogin(page, uniqueEmail("badcsv"));
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByText("Transactions", { exact: true }).click();

  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByRole("menuitem", { name: "CSV file" }).click();
  const csv = "date,name,amount\nnot a date,Coffee,4\n2026-01-01,Tea,abc";
  await page.locator('input[type="file"]').setInputFiles({ name: "bad.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByText(/Line 2: can't read the date/)).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Import", exact: true })).toBeDisabled();
});

test("another user's sqid in the URL redirects to your own account", async ({ page }) => {
  await devLogin(page, "alice@extract.local");
  await expect(page).toHaveURL(/\/home\/(\w+)/);
  const own = page.url().split("/home/")[1];

  await page.goto("/home/NotMine123");
  await expect(page).toHaveURL(new RegExp(`/home/${own}`));
});

const signUp = async (page: Page, name: string, budget?: string) => {
  await devLogin(page, uniqueEmail(name));
  if (budget) await page.getByLabel("Monthly budget").fill(budget);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/home\/\w+/);
};

const addTransaction = async (page: Page, name: string, amount: string, type: "Expense" | "Income" = "Expense") => {
  await page.getByRole("button", { name: "Add transaction" }).click();
  const dialog = page.getByRole("dialog", { name: "Add transaction" });
  if (type === "Income") await dialog.getByText("Income", { exact: true }).click();
  await dialog.getByRole("textbox", { name: "Name" }).fill(name);
  await dialog.getByLabel("Amount").fill(amount);
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog).toBeHidden();
};

test("income shows on the dashboard, with net and budget alerts, and in reports", async ({ page }) => {
  await signUp(page, "income", "100");
  await addTransaction(page, "Salary", "3000", "Income");
  await addTransaction(page, "Groceries", "90");

  await expect(page.getByText("+$3,000.00").first()).toBeVisible();
  await expect(page.getByText("Net +$2,910.00")).toBeVisible();
  await expect(page.getByText("Close to your budget")).toBeVisible();

  await addTransaction(page, "Dinner", "20");
  await expect(page.getByText("Over budget")).toBeVisible();

  await page.getByText("Reports", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await expect(page.getByText("$2,890.00")).toBeVisible();
  await expect(page.getByText("96% of income")).toBeVisible();
});

test("rules categorize new transactions and bulk actions update many at once", async ({ page }) => {
  await signUp(page, "rules");
  await page.getByText("Settings", { exact: true }).click();
  const ruleForm = page.locator("form", { has: page.getByLabel("Name contains") });
  await ruleForm.getByLabel("Name contains").fill("grab");
  await ruleForm.getByRole("textbox", { name: "Category" }).click();
  await page.getByRole("option", { name: "Transport" }).click();
  await page.getByRole("button", { name: "Add rule" }).click();
  await expect(page.getByRole("row", { name: /grab/ })).toBeVisible();

  await addTransaction(page, "GRAB to office", "12");
  await addTransaction(page, "Lunch", "8");
  await page.getByText("Transactions", { exact: true }).click();
  await expect(page.getByRole("row", { name: /GRAB to office/ }).getByText("Transport")).toBeVisible();

  await page.getByRole("checkbox", { name: "Select all" }).check();
  await expect(page.getByText("2 selected")).toBeVisible();
  await page.getByRole("textbox", { name: "Move to category" }).click();
  await page.getByRole("option", { name: "Food" }).click();
  await expect(page.locator("tbody").getByText("Food")).toHaveCount(2);

  await page.getByRole("checkbox", { name: "Select Lunch" }).check();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
});

test("a savings goal fills up and celebrates with confetti when reached", async ({ page }) => {
  await signUp(page, "saver");
  await page.getByText("Savings", { exact: true }).click();
  await expect(page.getByText("Start your first savings goal")).toBeVisible();

  await page.getByRole("button", { name: "New goal" }).click();
  const goalDialog = page.getByRole("dialog", { name: "New savings goal" });
  await goalDialog.getByLabel("What are you saving for?").fill("Concert tickets");
  await goalDialog.getByLabel("Target").fill("200");
  await goalDialog.getByRole("button", { name: "Icon 🎁" }).click();
  await goalDialog.getByRole("button", { name: "Create goal" }).click();

  const card = page.getByLabel("Savings goal Concert tickets");
  await expect(card.getByText("0%")).toBeVisible();

  await card.getByRole("button", { name: "Add money" }).click();
  let dialog = page.getByRole("dialog", { name: /Concert tickets/ });
  await dialog.getByLabel("Amount").fill("150");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(card.getByText("75%")).toBeVisible();

  await card.getByRole("button", { name: "Add money" }).click();
  dialog = page.getByRole("dialog", { name: /Concert tickets/ });
  await dialog.getByRole("button", { name: /Fill the rest/ }).click();
  await dialog.getByRole("button", { name: "Add", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Goal reached!" })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1); // the confetti
  await page.getByRole("button", { name: "Yay!" }).click();
  await expect(card.getByText(/Reached/)).toBeVisible();

  // can't take out more than is saved
  await card.getByRole("button", { name: "Take out" }).click();
  dialog = page.getByRole("dialog", { name: /Concert tickets/ });
  await dialog.getByLabel("Amount").fill("500");
  await dialog.getByRole("button", { name: "Take out", exact: true }).click();
  await expect(dialog.getByText("You can't take out more than you've saved.")).toBeVisible();
});

test("A mode switches to butter yellow and pink and is remembered", async ({ page }) => {
  await page.goto("/");
  await page.locator('[aria-label="A mode"]').first().click();
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "a");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 248, 219)");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "a");

  await page.locator('[aria-label="Dark"]').first().click();
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "dark");
});

test("quick add saves from one line, reuses past amounts, and can be undone", async ({ page }) => {
  await signUp(page, "quick");
  const bar = page.getByLabel("Quick add");

  await bar.fill("coffee 4.50");
  await expect(page.getByText("Enter to add:")).toBeVisible();
  await bar.press("Enter");
  await expect(page.getByRole("link", { name: "coffee" })).toHaveCount(1);
  await expect(bar).toHaveValue("");

  // a name used before reuses its amount
  await bar.fill("Coffee");
  await expect(page.getByText("same as last time")).toBeVisible();
  await bar.press("Enter");
  await expect(page.getByRole("link", { name: "coffee" })).toHaveCount(2);

  await bar.fill("+500 bonus");
  await bar.press("Enter");
  await expect(page.getByText("+$500.00").first()).toBeVisible();

  await bar.fill("lunch 12 #fo");
  await expect(page.locator("form").getByText("Food").or(page.getByText("FOOD")).first()).toBeVisible();
  await bar.press("Enter");
  await expect(page.getByRole("row", { name: /lunch/ }).getByText("Food")).toBeVisible();

  await bar.fill("taxi 9 #nonsense");
  await expect(page.getByText("No category called #nonsense")).toBeVisible();
  await bar.fill("taxi");
  await bar.press("Enter");
  await expect(page.getByText("Add an amount, e.g. coffee 4.50")).toBeVisible();

  // undo the last add
  await bar.fill("mistake 99");
  await bar.press("Enter");
  await expect(page.getByRole("link", { name: "mistake" })).toBeVisible();
  await page.locator(".mantine-Notification-root", { hasText: "Added mistake" }).getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("link", { name: "mistake" })).toHaveCount(0);
});

test("N opens the add dialog, suggestions fill in amounts, and Add another keeps it open", async ({ page }) => {
  await signUp(page, "keys");
  await page.getByLabel("Quick add").fill("Bubble tea 6.80");
  await page.getByLabel("Quick add").press("Enter");
  await expect(page.getByRole("link", { name: "Bubble tea" })).toBeVisible();

  await page.locator("body").click({ position: { x: 5, y: 300 } });
  await page.keyboard.press("n");
  const dialog = page.getByRole("dialog", { name: "Add transaction" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("textbox", { name: "Name" }).fill("Bub");
  await page.getByRole("option", { name: "Bubble tea" }).click();
  await expect(dialog.getByLabel("Amount")).toHaveValue("$6.80");

  await dialog.getByRole("button", { name: "Add another" }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Name" })).toHaveValue("");
  await dialog.getByRole("textbox", { name: "Name" }).fill("Snack");
  await dialog.getByLabel("Amount").fill("3");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("link", { name: "Bubble tea" })).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Snack" })).toBeVisible();

  // "/" jumps to quick add
  await page.locator("body").click({ position: { x: 5, y: 300 } });
  await page.keyboard.press("/");
  await expect(page.getByLabel("Quick add")).toBeFocused();
});

test("A mode shows Pooh and uses no gradients", async ({ page }) => {
  await signUp(page, "pooh");
  await page.locator('[aria-label="A mode"]').first().click();
  // decorative in the sidebar, so hidden from screen readers
  await expect(page.locator('svg[aria-label="Winnie-the-Pooh"]').first()).toBeVisible();

  const addButton = page.getByRole("button", { name: /Add transaction/ }).first();
  await expect(addButton).toHaveCSS("background-image", "none");
  await expect(page.locator("body")).not.toHaveCSS("background-image", /gradient/);

  await page.getByText("Savings", { exact: true }).click();
  await expect(page.getByText("Start your first savings goal")).toBeVisible();
  await expect(page.getByRole("img", { name: "Winnie-the-Pooh" })).toBeVisible();
});

test("DBS statement PDFs import with transfers unticked, and re-imports are caught as duplicates", async ({ page }) => {
  await signUp(page, "statement");
  await page.getByText("Transactions", { exact: true }).click();
  // the fake statements are from Sep–Oct 2026
  const fixtures = ["tests/fixtures/dbs-card.pdf", "tests/fixtures/dbs-account.pdf"];

  const openImporter = async () => {
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await page.getByRole("menuitem", { name: /DBS\/POSB statement/ }).click();
    const dialog = page.getByRole("dialog", { name: "Import DBS/POSB statements" });
    await dialog.locator('input[type="file"]').setInputFiles(fixtures);
    await expect(dialog.getByTestId("statement-row")).toHaveCount(22);
    return dialog;
  };

  let dialog = await openImporter();
  await expect(dialog.getByText("is read on this device")).toHaveCount(0); // intro hidden once loaded
  // card bill payments (2 + 1 from the account), PayLah! top-up start unticked
  await expect(dialog.getByRole("checkbox", { name: "Import Card bill payment" }).first()).not.toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: "Import Credit card bill payment" })).not.toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: "Import PayLah! top-up" })).not.toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: "Import Salary" })).toBeChecked();
  await expect(dialog.getByText("18 of 22 selected")).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "Category for NTUC FAIRPRICE TAMPINES" })).toHaveValue("food");

  await dialog.getByRole("button", { name: "Import 18 transactions" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Imported 18 transactions.")).toBeVisible();

  await page.goto(page.url().split("?")[0] + "?month=2026-10");
  await expect(page.getByRole("link", { name: "Salary" })).toBeVisible();
  await expect(page.getByRole("link", { name: "PayLah! top-up" })).toHaveCount(0);

  // importing the same statements again: everything already there starts unticked
  dialog = await openImporter();
  await expect(dialog.getByText("Already in app")).toHaveCount(18);
  await expect(dialog.getByText("0 of 22 selected")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Import 0 transactions" })).toBeDisabled();
});

test("an expired login offers to log in again instead of a dead end", async ({ page }) => {
  await signUp(page, "expired");
  // the API starts rejecting the session (e.g. Auth0 couldn't renew the token)
  await page.route("**/api/user", (route) => route.fulfill({ status: 401, contentType: "application/json", body: '{"error":"Unauthorized"}' }));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Please log in again" })).toBeVisible();
  await page.getByRole("button", { name: "Log in again" }).click();
  await expect(page).toHaveURL(/\/dev-login\?returnTo=/);
});
