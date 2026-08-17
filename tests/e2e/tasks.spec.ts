import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await page.getByLabel("Correo electrónico").fill("paula.robles@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("FamiliaRobles2026!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Familia Robles" })).toBeVisible();
}

test("submits and approves a task reward exactly once", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.context().setExtraHTTPHeaders({
    "x-nf-client-connection-ip": `203.2.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`,
  });
  await signIn(page);
  const familyUrl = page.url();
  let title = `Ordenar libros ${testInfo.project.name} ${Date.now()}`;

  await page.getByRole("link", { name: "Tareas", exact: true }).click();
  await page.getByRole("link", { name: "Nueva tarea" }).click();
  await expect(page.getByRole("link", { name: "Volver a tareas" })).toBeVisible();
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Tipo de tarea").selectOption("open");
  await page.getByLabel("Recompensa").fill("0,50");
  await page.getByLabel(/Leo/).check();
  await page.getByRole("button", { name: "Guardar tarea" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page
    .locator("article")
    .filter({ hasText: title })
    .getByRole("link", { name: "Editar tarea" })
    .click();
  title = `${title} editada`;
  await page.getByLabel("Título").fill(title);
  await page.getByRole("button", { name: "Guardar tarea" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  await page.goto(familyUrl);
  await page.getByRole("link", { name: "Perfiles infantiles" }).click();
  await page.getByLabel("Nombre del dispositivo").fill(`Tareas ${testInfo.project.name}`);
  await page.getByRole("button", { name: "Activar el modo infantil aquí" }).click();
  await expect(page).toHaveURL(/\/kids$/);
  await expect(page.getByRole("heading", { name: "¿Quién va a entrar?" })).toBeVisible();
  await page.getByRole("link", { name: /Leo/ }).click();
  await expect(page).toHaveURL(/\/kids\/unlock\//);
  await page.getByLabel("PIN").fill("2468");
  await page.getByRole("button", { name: "Entrar en mi perfil" }).click();
  await page.getByRole("link", { name: "Mis tareas" }).click();
  const task = page.locator("article").filter({ hasText: title });
  await task.getByRole("button", { name: "Marcar como terminada" }).click();
  await expect(page.getByRole("status")).toContainText("Tarea enviada");

  await page.goto("/kids/home");
  await page.getByRole("button", { name: "Salir del modo infantil" }).click();
  await signIn(page);
  await page.getByRole("link", { name: "Solicitudes pendientes", exact: true }).click();
  const request = page.locator("article").filter({ hasText: title });
  await request.getByRole("button", { name: "Aprobar y recompensar" }).click();
  await expect(request).not.toBeVisible();

  await page.goto(familyUrl);
  await page.getByRole("link", { name: "Perfiles infantiles" }).click();
  await page.getByRole("link", { name: /Leo/ }).click();
  await page.getByRole("link", { name: "Saldo e historial" }).click();
  await expect(page.getByRole("heading", { name: "Recompensa por tarea" }).first()).toBeVisible();

  await page.goto(familyUrl);
  await page.getByRole("link", { name: "Tareas", exact: true }).click();
  await page
    .locator("article")
    .filter({ hasText: title })
    .getByRole("link", { name: "Editar tarea" })
    .click();
  await page.getByRole("button", { name: "Eliminar tarea" }).click();
  await expect(page.getByRole("heading", { name: title })).not.toBeVisible();
});
