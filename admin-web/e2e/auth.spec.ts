import { test, expect } from "@playwright/test";
import { ADMIN, login, logout } from "./helpers";

test.describe("authentication", () => {
  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test("wrong password shows an error and stays on the login page", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(ADMIN.username);
    await page.getByLabel("Password").fill("definitely-wrong");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText(/no active account|invalid credentials/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("valid login reaches the dashboard; protected pages work; logout locks them again", async ({ page }) => {
    await login(page, ADMIN.username, ADMIN.password);
    await expect(page.getByRole("heading", { name: /live dashboard/i })).toBeVisible();

    // A protected page renders real content through the SSR proxy path.
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Users", exact: true })).toBeVisible();
    await expect(page.getByText(ADMIN.username).first()).toBeVisible();

    // After logout, the same page must bounce to /login (proxy.ts).
    await logout(page);
    await page.goto("/users");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated visitors are redirected off protected pages, but public pages stay open", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);

    for (const path of ["/signup", "/forgot-password", "/set-password"]) {
      await page.goto(path);
      await expect(page, `${path} must not require a session`).not.toHaveURL(/\/login/);
    }
  });
});
