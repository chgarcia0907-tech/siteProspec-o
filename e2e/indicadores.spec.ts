import { expect, test } from "./helpers";

// Hoje é 12/11/2026 (quinta). Na semana de 09 a 15/11 ninguém enviou mensagem; a única AT
// registrada é a do João (Hunter Dois, depois do WhatsApp 1). Bruno, Diego e Karen estão atrasados.
test.describe("Painel · Indicadores", () => {
  test("abre na semana atual com os números da equipe", async ({ page }) => {
    await page.goto("/painel");
    await expect(page.getByRole("tab", { name: "Indicadores" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const tile = (name: string) => page.getByRole("group", { name, exact: true });
    await expect(tile("ATs marcadas")).toContainText("1");
    await expect(tile("ATs marcadas")).toContainText("antes: 2");
    await expect(tile("Mensagens enviadas")).toContainText("antes: 8");
    await expect(tile("Envios atrasados agora")).toContainText("3");
    await expect(tile("Hunters parados (2+ dias úteis)")).toContainText("2");
    await expect(page.getByText("Hunter Dois: sem envio há 6 dias úteis")).toBeVisible();
    await expect(page.getByText("09/11/2026 a 15/11/2026 · comparado com")).toBeVisible();
  });

  test("lista os atrasados do hunter e a etapa que gerou a AT", async ({ page }) => {
    await page.goto("/painel");
    await page.getByRole("button", { name: "Hunter Dois" }).click();
    const late = page.getByRole("row", { name: /^Karen Luz/ });
    await expect(late).toContainText("WhatsApp 1");
    await expect(late).toContainText("5 d úteis");
    const origem = page.getByRole("region", { name: "Etapa que gerou a AT" });
    await expect(origem.locator("li", { hasText: "WhatsApp 1" })).toContainText("(100%)");
  });

  test("filtros de intervalo e de grupo recalculam os números", async ({ page }) => {
    await page.goto("/painel");
    const tile = (name: string) => page.getByRole("group", { name, exact: true });
    await page.getByRole("button", { name: "Semana passada" }).click();
    await expect(page.getByText("02/11/2026 a 08/11/2026 · comparado com")).toBeVisible();
    await expect(tile("Mensagens enviadas")).toContainText("8");
    await expect(tile("ATs marcadas")).toContainText("2");
    // Squad Azul tem só o Hunter Um: 4 envios dele na semana passada.
    await page
      .getByRole("combobox", { name: "Grupo", exact: true })
      .selectOption({ label: "Squad Azul" });
    await expect(tile("Mensagens enviadas")).toContainText("4");
    await expect(page.getByRole("button", { name: "Hunter Dois" })).toHaveCount(0);
  });
});
