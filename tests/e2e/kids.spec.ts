import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.context().setExtraHTTPHeaders({
    "x-nf-client-connection-ip": `203.0.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`,
  });
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await page.getByLabel("Correo electrónico").fill("paula.robles@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("FamiliaRobles2026!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Familia Robles" })).toBeVisible();
}

test("hands the browser to a child without retaining adult access", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Perfiles infantiles" }).click();
  await expect(page.getByRole("heading", { name: "Perfiles infantiles" })).toBeVisible();
  await expect(page.getByText("Leo")).toBeVisible();
  await expect(page.getByRole("link", { name: "Volver a la familia" })).toBeVisible();
  await page.getByRole("link", { name: /Leo/ }).click();
  await page.getByRole("link", { name: "Volver a perfiles infantiles" }).click();

  await page.getByLabel("Nombre del dispositivo").fill("Navegador E2E");
  await page.getByRole("button", { name: "Activar el modo infantil aquí" }).click();
  await expect(page).toHaveURL(/\/kids$/);
  await expect(page.getByRole("heading", { name: "¿Quién va a entrar?" })).toBeVisible();

  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\?redirectTo=/);
  await page.goto("/kids");
  await page.getByRole("link", { name: /Leo/ }).click();
  await page.getByLabel("PIN").fill("2468");
  await page.getByRole("button", { name: "Entrar en mi perfil" }).click();
  await expect(page).toHaveURL(/\/kids\/home$/);
  await expect(page.getByRole("heading", { name: /Leo, tu espacio está listo/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cambiar de perfil" })).toBeVisible();
  await page.getByRole("link", { name: "Mi saldo" }).click();
  await expect(page.getByRole("heading", { name: "Mi saldo" })).toBeVisible();
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\?redirectTo=/);
});
