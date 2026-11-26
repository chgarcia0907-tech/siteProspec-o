import { expect, test } from "./helpers";

// Hoje é 12/11/2026 (quinta), semana da S02. A Visão geral é a aba padrão da Dashboard.
test.describe("Dashboard: Visão geral", () => {
  test("abre por padrão com o cartão central, os alertas e os gráficos", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("tab", { name: "Visão geral" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      page.getByRole("heading", { name: "Estamos no ritmo para bater a meta do ciclo?" }),
    ).toBeVisible();
    const central = page.getByRole("region", { name: "ATs que avançaram" });
    await expect(central).toContainText("esta semana (S02)");
    await expect(central).toContainText("No ciclo:");
    await expect(page.getByText(/^Alertas \(\d+\)$/)).toBeVisible();
    await expect(page.getByText("O que explica o resultado")).toBeVisible();
    await expect(page.getByText("ATs marcadas por safra de origem")).toBeVisible();
    await expect(page.getByText("Funil do ciclo")).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("o Ver de um alerta leva à aba indicada", async ({ page }) => {
    await page.goto("/dashboard");
    const ver = page.getByRole("button", { name: /^Ver: / }).first();
    await expect(ver).toBeVisible();
    await ver.click();
    await expect(page).toHaveURL(/aba=(hunters|semanas|conciliacao)/);
  });

  test("os Indicadores continuam numa aba própria", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("tab", { name: "Indicadores" }).click();
    await expect(page).toHaveURL(/\/dashboard\?aba=indicadores$/);
    await expect(page.getByRole("group", { name: "ATs marcadas", exact: true })).toBeVisible();
  });
});
