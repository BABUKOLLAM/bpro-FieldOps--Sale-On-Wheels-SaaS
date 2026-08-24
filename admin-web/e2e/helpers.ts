import { Page, expect } from "@playwright/test";

export const ADMIN = { username: "e2e-admin@test.local", password: "E2e#Admin#Pass1" };

/** Logs in through the real form and waits for the dashboard. */
export async function login(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function logout(page: Page) {
  // Clear session server-side + client-side regardless of UI state.
  await page.request.post("/api/session/logout");
  await page.context().clearCookies();
}
