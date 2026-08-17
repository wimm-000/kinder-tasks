import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, ip: string) {
  await page.context().setExtraHTTPHeaders({ "x-nf-client-connection-ip": ip });
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await page.getByLabel("Correo electrónico").fill("paula.robles@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("FamiliaRobles2026!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Familia Robles" })).toBeVisible();
}

test("records an immutable adjustment and rejects an overdraw", async ({ page }, testInfo) => {
  await signIn(
    page,
    `203.1.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`,
  );
  await page.getByRole("link", { name: "Perfiles infantiles" }).click();
  await page.getByRole("link", { name: /Leo/ }).click();
  await page.getByRole("link", { name: "Saldo e historial" }).click();
  await expect(page.getByRole("heading", { name: /Saldo e historial/ })).toBeVisible();
  await page.getByRole("link", { name: "Añadir ajuste" }).click();
  await expect(page.getByRole("link", { name: "Volver al saldo e historial" })).toBeVisible();
  await page.getByLabel("Importe").fill("1,00");
  const reason = `Ajuste ${testInfo.project.name} ${Date.now()}`;
  await page.getByLabel("Motivo").fill(reason);
  await page.getByRole("button", { name: "Guardar ajuste" }).click();
  await expect(page.getByText(reason)).toBeVisible();
  await page.getByRole("link", { name: "Registrar retirada" }).click();
  await page.getByLabel("Importe").fill("999999");
  await page.getByLabel("Motivo").fill("Retirada imposible");
  await page.getByRole("button", { name: "Guardar retirada" }).click();
  await expect(page.getByRole("alert")).toContainText("saldo disponible no es suficiente");
});
