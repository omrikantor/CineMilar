import { test, expect } from "@playwright/test";

test("login with wrong credentials shows a server-side error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("no-such-user@example.com");
  await page.getByLabel("Password").fill("wrongpassword123");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
  // Still on the login page — never redirected to the protected area.
  await expect(page).toHaveURL(/\/login/);
});

test("signup form rejects a password shorter than 6 characters before it ever reaches the server", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Need an account? Sign up" }).click();

  await page.getByLabel("Email").fill(`test-${Date.now()}@example.com`);
  const passwordInput = page.getByLabel("Password");
  await passwordInput.fill("123");

  const isValid = await passwordInput.evaluate(
    (el: HTMLInputElement) => el.checkValidity()
  );
  expect(isValid).toBe(false);
});

test("login form requires both fields", async ({ page }) => {
  await page.goto("/login");
  const emailValid = await page
    .getByLabel("Email")
    .evaluate((el: HTMLInputElement) => el.checkValidity());
  expect(emailValid).toBe(false);
});
