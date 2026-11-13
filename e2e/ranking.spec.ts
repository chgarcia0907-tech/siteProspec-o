import { expect, test } from "./helpers";

test.describe("Ranking", () => {
  test("abre no ciclo ativo, com grupo e pontuação", async ({ page }) => {
    await page.goto("/ranking");
    await expect(page.getByText("Período: 27/10/2026 em diante")).toBeVisible();
    const row = page.getByRole("row", { name: /Hunter Um/ }).first();
    await expect(row).toContainText("Squad Azul / Dupla 1");
    await expect(page.getByRole("columnheader", { name: "Aprov. verbais" }).first()).toBeVisible();
  });

  test("período encerrado mostra o placar oficial congelado", async ({ page }) => {
    await page.goto("/ranking");
    await page.locator("main select").first().selectOption({ label: "Hacka Out (encerrado)" });
    await expect(page.getByText("Placar oficial congelado no encerramento")).toBeVisible();
    const row = page.getByRole("row", { name: /Hunter Um/ }).first();
    await expect(row).toContainText("93");
    await expect(row).toContainText("70,1");
  });

  test("regulamento e atividade vêm da configuração", async ({ page }) => {
    await page.goto("/ranking");
    await expect(page.getByText("Um projeto vendido soma 93 pontos.")).toBeVisible();
    const atividade = page.getByRole("row", { name: /Hunter Dois/ }).last();
    await expect(atividade).toContainText("3");
  });
});
