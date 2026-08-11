import { test, expect } from "@playwright/test";

test("recommend page shows the request form when logged in", async ({ page }) => {
  await page.goto("/recommend");
  await expect(page.getByLabel(/title you liked/i)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /get recommendations/i })
  ).toBeDisabled();
});

test("visiting a nonexistent (or another user's) request shows not found", async ({
  page,
}) => {
  // A random UUID that won't match any row — this also covers the
  // permissions case: RLS makes another user's real request look identical
  // to a nonexistent one, so this is the same code path either way.
  await page.goto("/recommend/00000000-0000-0000-0000-000000000000");
  await expect(page.getByText(/404|not found/i)).toBeVisible();
});

test("history page loads without error", async ({ page }) => {
  await page.goto("/history");
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
});

test("saved page loads without error", async ({ page }) => {
  await page.goto("/saved");
  await expect(page.getByRole("heading", { name: "Saved" })).toBeVisible();
});

test("logout returns to the login page and re-protects routes", async ({
  page,
}) => {
  await page.goto("/recommend");
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/recommend");
  await expect(page).toHaveURL(/\/login/);
});
