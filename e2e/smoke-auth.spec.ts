import { test, expect } from "@playwright/test";

/**
 * Smoke test 1: anonymous visitor reaches /auth and the form renders.
 * This is the cheapest possible health check — if this fails, deployment is broken.
 */
test("auth page renders for anonymous visitors", async ({ page }) => {
  await page.goto("/auth");
  await expect(page).toHaveURL(/\/auth/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10000 });
});
