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
