import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.context().setExtraHTTPHeaders({ "x-nf-client-connection-ip": "198.51.100.42" });
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await page.getByLabel("Correo electrónico").fill("paula.robles@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("FamiliaRobles2026!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/[0-9a-f-]+$/);
}

test("shows only authorized family members and denies a guessed family", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Miembros" }).click();
  await expect(page.getByRole("heading", { name: "Miembros" })).toBeVisible();
  await expect(page.getByText("Paula Robles")).toBeVisible();

  await page.goto("/app/0198b123-0000-7000-8000-999999999999");
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
});
