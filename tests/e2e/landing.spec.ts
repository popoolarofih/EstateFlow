import { expect, test } from "@playwright/test";

test("landing page renders the offer, validates the pilot form and has no horizontal overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Every visitor verified.");
  await expect(page.getByRole("link", { name: "Book a pilot walkthrough" })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await page.locator("#pilot").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Book a pilot walkthrough" }).click();
  await expect(page.getByText("Enter your full name.")).toBeVisible();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
});

test("unknown routes show the branded 404 with a way back", async ({ page }) => {
  const response = await page.goto("/this-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This page is not on the guest list" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to the homepage" })).toBeVisible();
});

test("signed out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/admin/overview");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin%2Foverview/);
});

const hero = "section[aria-labelledby=hero-title]";
const heroVar = (page: import("@playwright/test").Page, name: string) =>
  page.locator(hero).evaluate((element, variable) => (element as HTMLElement).style.getPropertyValue(variable), name);

test("the Morning / Night switch sinks the house into fog, swaps at the deepest point and rises", async ({ page }) => {
  await page.goto("/");
  const morning = page.getByRole("group", { name: "Time of day" }).getByRole("button", { name: /Morning/ });
  const night = page.getByRole("group", { name: "Time of day" }).getByRole("button", { name: /Night/ });
  await expect(night).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => heroVar(page, "--k")).toBe("1.000");

  await morning.click();
  await expect(morning).toHaveAttribute("aria-pressed", "true");
  // The house layer moves down during the sink, then returns to rest.
  await expect.poll(async () => parseFloat(await heroVar(page, "--sink")), { timeout: 2000, intervals: [20] }).toBeGreaterThan(20);
  await expect.poll(() => heroVar(page, "--k"), { timeout: 3000 }).toBe("0.000");
  await expect.poll(() => heroVar(page, "--sink")).toBe("0.0px");
  await expect(page.getByAltText(/morning light/)).toBeVisible();
  await expect(page.getByAltText(/at dusk/)).toBeHidden();
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("switches time of day instantly without moving the house", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Morning/ }).click();
    await expect.poll(() => heroVar(page, "--k"), { timeout: 500 }).toBe("0.000");
    expect(await heroVar(page, "--sink")).toBe("0.0px");
    await expect(page.getByAltText(/morning light/)).toBeVisible();
  });
});
