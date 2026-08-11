import { test, expect } from "@playwright/test";

for (const path of ["/recommend", "/history", "/saved"]) {
  test(`redirects to /login when visiting ${path} while logged out`, async ({
    page,
  }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  });
}

test("home page is publicly accessible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
});
