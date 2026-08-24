import { test, expect } from "@playwright/test";
import { ADMIN, login, logout } from "./helpers";

/**
 * The full onboarding lifecycle, end to end through the real UI — the
 * flow that shipped broken in three different places before this test
 * existed (proxy 204 handling, PUBLIC_PATHS, the un-rebuilt-image
 * deploys): visitor requests access -> admin approves (no password
 * involved) -> the one-time link identifies its account -> the new
 * user sets their own password -> logs in with it -> the link is dead.
 */
test("request access -> approve -> set own password -> sign in", async ({ page }) => {
  // Unique per run: the DB is recreated per suite boot, but retries and
  // local re-runs against a still-warm stack must not collide.
  const stamp = Date.now();
  const email = `e2e-agent-${stamp}@test.local`;

  // 1. Visitor submits the public request-access form.
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Ee Agent");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Phone").fill("9000000099");
  await page.getByLabel("Requesting role").selectOption({ index: 1 });
  await page.getByRole("button", { name: /request access/i }).click();
  await expect(page.getByText(/request received/i)).toBeVisible();

  // 2. Admin approves it — no temporary password anywhere.
  await login(page, ADMIN.username, ADMIN.password);
  await page.goto("/signup-requests");
  // The card is the div containing both this request's email and its
  // action buttons — filtering on the email alone also matches the
  // inner text divs that don't hold the buttons.
  const requestCard = page
    .locator("div")
    .filter({ hasText: email })
    .filter({ has: page.getByRole("button", { name: /approve/i }) })
    .last();
  await requestCard.getByRole("button", { name: /approve/i }).click();
  await requestCard.getByRole("button", { name: /confirm & create account/i }).click();

  // 3. The one-time set-password link is surfaced to the admin.
  const linkInput = page.locator(`input[value*="/set-password?uid="]`);
  await expect(linkInput).toBeVisible();
  const setPasswordUrl = await linkInput.inputValue();
  await logout(page);

  // 4. The link identifies whose account it is before asking anything.
  await page.goto(setPasswordUrl);
  await expect(page.getByText(email)).toBeVisible();

  // 5. New user sets their own password. Deliberately shares NO
  // substring with the email — Django's UserAttributeSimilarityValidator
  // (correctly) rejects a password that overlaps the username, and the
  // email carries the run's timestamp, so the password must not.
  const newPassword = "Zbq7!vronmax-Ppl";
  await page.getByLabel("New password").fill(newPassword);
  await page.getByLabel("Confirm password").fill(newPassword);
  await page.getByRole("button", { name: "Set password" }).click();
  await expect(page.getByText(/password has been set/i)).toBeVisible();

  // 6. ...and signs in with it.
  await login(page, email, newPassword);
  await logout(page);

  // 7. The link is single-use: revisiting it must refuse, not offer the form.
  await page.goto(setPasswordUrl);
  await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
});
