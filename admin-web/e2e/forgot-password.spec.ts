import { test, expect } from "@playwright/test";

test.describe("forgot password", () => {
  test("known and unknown accounts get the identical generic response", async ({ page }) => {
    // Identical responses are the anti-enumeration property — a
    // different message for unknown emails would let anyone probe
    // which addresses have accounts.
    for (const identifier of ["e2e-admin@test.local", `nobody-${Date.now()}@test.local`]) {
      await page.goto("/forgot-password");
      await page.getByLabel("Email or username").fill(identifier);
      await page.getByRole("button", { name: /send reset link/i }).click();
      await expect(
        page.getByText(/if that account exists, a password reset link has been sent/i)
      ).toBeVisible();
    }
  });

  test("login page links to it", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /forgot password/i }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.getByRole("heading", { name: /reset your password/i })).toBeVisible();
  });
});
