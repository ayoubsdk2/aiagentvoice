import { test, expect } from "@playwright/test";

/**
 * Smoke test 3: trust + status pages render publicly without auth.
 * These are public-facing compliance pages that must always be reachable.
 */
test("trust page renders publicly", async ({ page }) => {
  await page.goto("/trust");
  await expect(page).toHaveURL(/\/trust/);
  await expect(page.locator("body")).toContainText(/trust|compliance|security/i, { timeout: 10000 });
});

test("status page renders publicly", async ({ page }) => {
  await page.goto("/status");
  await expect(page).toHaveURL(/\/status/);
  await expect(page.locator("body")).toContainText(/status|operational|health/i, { timeout: 10000 });
});
