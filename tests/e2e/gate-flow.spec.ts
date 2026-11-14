import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "EstateFlow!2026";

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Types a code on the on screen keypad once the verifier has hydrated. */
async function enterCode(page: Page, code: string) {
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  for (const digit of code) await page.getByRole("button", { name: digit, exact: true }).click();
}

async function signOut(page: Page) {
  await page.context().clearCookies();
  await page.evaluate(() => indexedDB.databases().then((dbs) => dbs.forEach((db) => db.name && indexedDB.deleteDatabase(db.name))));
}

test("a resident issues a pass and the guard admits the visitor exactly once", async ({ page }) => {
  await signIn(page, "resident@akobo_gardens.test");
  await expect(page).toHaveURL(/\/resident$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Adaeze");

  await page.getByRole("link", { name: "Invite a guest" }).click();
  const dialog = page.getByRole("dialog", { name: "Create a visitor pass" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Visitor name").fill("Chinedu Eze");
  await dialog.getByRole("button", { name: "Create pass" }).click();

  const issued = page.getByRole("dialog", { name: /Pass ready for Chinedu Eze/ });
  await expect(issued).toBeVisible();
  const code = (await issued.getByLabel(/Gate code/).textContent())?.trim() ?? "";
  expect(code).toMatch(/^\d{6}$/);
  await issued.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Chinedu Eze").first()).toBeVisible();

  await signOut(page);
  await signIn(page, "guard@akobo_gardens.test");
  await expect(page).toHaveURL(/\/guard\/verify$/);
  await enterCode(page, code);
  await expect(page.getByRole("alert").filter({ hasText: "Allow entry" })).toBeVisible();
  await expect(page.getByText("Unit 14B")).toBeVisible();

  await page.getByRole("button", { name: "Next visitor" }).click();
  await enterCode(page, code);
  await expect(page.getByRole("alert").filter({ hasText: "Pass already used" })).toBeVisible();
});

test("a guard from another estate cannot use the code", async ({ page }) => {
  await signIn(page, "guard@lekki_palms.test");
  await expect(page).toHaveURL(/\/guard\/verify$/);
  await enterCode(page, "000000");
  await expect(page.getByRole("alert").filter({ hasText: "Do not allow" })).toBeVisible();
});
