import { expect, test, type Page } from "@playwright/test";

async function waitForHydration(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
}

test("protects the adult area and signs in a verified parent", async ({ page }) => {
  await page.context().setExtraHTTPHeaders({ "x-nf-client-connection-ip": "198.51.100.41" });
  await page.context().clearCookies();
  await page.goto("/app");

  await expect(page).toHaveURL(/\/login\?redirectTo=/);
  await waitForHydration(page);
  await page.getByLabel("Correo electrónico").fill("paula.robles@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("FamiliaRobles2026!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();

  await expect(page).toHaveURL(/\/app\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "Familia Robles" })).toBeVisible();
});

test("validates registration without sending invalid data", async ({ page }) => {
  await page.goto("/register");
  await waitForHydration(page);
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();

  await expect(page.getByText("Escribe un nombre de entre 2 y 80 caracteres.")).toBeVisible();
  await expect(page.getByText("Escribe un correo válido.")).toBeVisible();
  await expect(
    page.getByText("Debes aceptar los términos y el aviso de privacidad."),
  ).toBeVisible();
});

test("returns a generic password recovery confirmation", async ({ page }) => {
  await page.goto("/forgot-password");
  await waitForHydration(page);
  await page.getByLabel("Correo electrónico").fill("cuenta-inexistente@example.test");
  await page.getByRole("button", { name: "Enviar enlace" }).click();

  await expect(
    page.getByText("Si existe una cuenta, hemos enviado las instrucciones de recuperación."),
  ).toBeVisible();
});
