import { expect, test } from "./helpers";

test.describe("Navegação lateral", () => {
  test("agrupa as telas, mostra os envios do dia e marca a tela ativa", async ({ page }) => {
    await page.goto("/contatos");
    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    for (const grupo of ["Prospecção", "Referência", "Administração"]) {
      await expect(nav.getByText(grupo, { exact: true })).toBeVisible();
    }
    // 2 + 1 + 1 + 2 + 2 nas filas de hoje (as mesmas contagens das abas de Envios de hoje).
    await expect(nav.getByRole("link", { name: /Envios de hoje/ })).toContainText("8");
    await expect(nav.getByRole("link", { name: "Contatos" })).toHaveAttribute(
      "data-status",
      "active",
    );
    await nav.getByRole("link", { name: "Painel Admin" }).click();
    await expect(page).toHaveURL(/\/painel/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Indicadores");
    await page.getByRole("tab", { name: "Competição" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Competição");
  });

  test("sair fica no rodapé da navegação", async ({ page }) => {
    await page.goto("/hoje");
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/auth$/);
  });
});
