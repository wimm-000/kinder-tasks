import { expect, test } from "@playwright/test";

test("shows the Kinder Tasks value proposition", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Kinder Tasks/);
  await expect(
    page.getByRole("heading", { name: "Aprender a cuidar el dinero empieza en casa." }),
  ).toBeVisible();
  await expect(page.getByText("Bajar el reciclaje")).toBeVisible();
  await expect(page.getByRole("link", { name: "Crear mi familia" })).toBeVisible();
});

test("opens the privacy notice", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Privacidad" }).click();

  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "Aviso de privacidad" })).toBeVisible();
});
