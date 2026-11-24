import { expect, test } from "@playwright/test";

test("role areas redirect anonymous visitors to sign in", async ({ page }) => {
  for (const path of ["/account", "/workspace", "/admin"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
});
test("foundation page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "DECA" })).toBeVisible();
});
