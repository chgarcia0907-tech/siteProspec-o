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
});
