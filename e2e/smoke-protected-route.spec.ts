import { test, expect } from "@playwright/test";

/**
 * Smoke test 2: protected /command route redirects unauth users to /auth.
 * Validates that RequireAuth middleware is wired correctly.
 */
test("protected command route redirects to /auth when unauthenticated", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/auth/, { timeout: 10000 });
});
