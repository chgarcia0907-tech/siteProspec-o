import { expect, test } from "./helpers";

test.describe("Navegação lateral", () => {
  test("agrupa as telas, mostra os envios do dia e marca a tela ativa", async ({ page }) => {
    await page.goto("/contatos");
    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    for (const grupo of ["Prospecção", "Referência", "Administração"]) {
      await expect(nav.getByText(grupo, { exact: true })).toBeVisible();
    }
    // Leads com envio pendente hoje: as filas somam 8 itens, mas são 4 leads (atrasados aparecem
    // em mais de uma etapa). É a mesma conta da barra de progresso de Envios de hoje.
    await expect(nav.getByRole("link", { name: /Envios de hoje/ })).toContainText("4");
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

  test("o contador bate com a barra de progresso de Envios de hoje", async ({ page }) => {
    await page.goto("/hoje");
    const barra = page.getByRole("region", { name: "Progresso do dia" });
    await expect(barra).toContainText(/\d+ de \d+ envios feitos/);
    const [, feitos, total] = /(\d+) de (\d+)/.exec((await barra.textContent()) ?? "")!;
    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    await expect(nav.getByRole("link", { name: /Envios de hoje/ })).toContainText(
      String(Number(total) - Number(feitos)),
    );
  });

  test("sair fica no rodapé da navegação", async ({ page }) => {
    await page.goto("/hoje");
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/auth$/);
  });
});
