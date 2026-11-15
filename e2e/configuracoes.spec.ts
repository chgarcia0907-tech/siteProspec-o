import { expect, mutations, test } from "./helpers";

test.describe("Configurações", () => {
  test("remover feriado pede confirmação", async ({ page }) => {
    await page.goto("/configuracoes");
    await page.getByLabel("Senha de administrador").fill("e2e-admin");
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.getByRole("button", { name: "Remover Finados" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Remover o feriado Finados?");
    await dialog.getByRole("button", { name: "Remover" }).click();
    await expect(page.getByText("Feriado removido")).toBeVisible();
    const removed = (await mutations()).filter((m) => m.table === "holidays");
    expect(removed).toMatchObject([{ method: "DELETE" }]);
    expect(removed[0]!.query).toContain("date=eq.2026-11-02");
  });

  test("a área do administrador não edita mais o período da competição", async ({ page }) => {
    await page.goto("/configuracoes");
    await page.getByLabel("Senha de administrador").fill("e2e-admin");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("button", { name: "Excluir contatos" })).toBeVisible();
    await expect(page.getByText("Período da competição")).toHaveCount(0);
  });

  test("salva o nome na plataforma e os intervalos da cadência", async ({ page }) => {
    await page.goto("/configuracoes");
    const nome = page.getByLabel("Nome na plataforma");
    await expect(nome).not.toHaveValue("");
    await nome.fill("Hunter Um Silva");
    await page.getByRole("button", { name: "Salvar" }).first().click();
    await expect(page.getByText("Nome salvo")).toBeVisible();

    await page.locator("#o2").fill("2");
    await page.getByRole("button", { name: "Salvar" }).nth(2).click();
    await expect(page.getByText("Intervalos salvos")).toBeVisible();

    const writes = await mutations();
    const perfil = writes.find((m) => m.table === "profiles");
    expect(JSON.parse(perfil!.body)).toMatchObject({ display_name: "Hunter Um Silva" });
    const intervalos = writes.find((m) => m.table === "settings");
    expect(JSON.parse(intervalos!.body)).toMatchObject({ offset2: 2 });
  });
});
