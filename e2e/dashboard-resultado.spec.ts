import { expect, mutations, seedResultado, test } from "./helpers";

// Com o preparo, a S01 está madura e a AT realizada da Ômega (contato da Delta, 51 a 200
// funcionários) virou venda de R$ 45.000 no mesmo dia.
test.describe("Dashboard: Resultado e ciclos", () => {
  test("mostra conversão, pipeline, valor por AT, ciclos e higiene", async ({ page }) => {
    await seedResultado();
    await page.goto("/dashboard");
    await page.getByRole("tab", { name: "Resultado e ciclos" }).click();
    await expect(page).toHaveURL(/\/dashboard\?aba=resultado$/);
    await expect(
      page.getByRole("heading", { name: "Quanto a prospecção vira de negócio?" }),
    ).toBeVisible();

    const conversao = page.getByLabel("Conversão até a venda");
    await expect(conversao).toContainText("Vendas1100% (1 de 1)");
    await expect(conversao).toContainText("Ticket médioR$ 45.000");

    const pipeline = page.getByRole("region", { name: "Pipeline do ciclo" });
    await expect(pipeline).toContainText("Ganhos: 1 · R$ 45.000");
    await expect(pipeline).toContainText("Perdidos: 0");

    const porte = page.getByRole("region", { name: "Valor por AT realizada por porte" });
    await expect(porte.getByRole("row", { name: /51 a 200 funcionários/ })).toContainText(
      "R$ 45.000",
    );
    const ciclos = page.getByRole("region", { name: "Ciclos da plataforma" });
    await expect(ciclos.getByRole("row", { name: /Ciclo Nov/ })).toContainText("a hoje");

    const higiene = page.getByRole("region", { name: "Higiene dos dados" });
    await expect(higiene).toContainText("Ganhos com valor");
    await expect(higiene).toContainText("(abaixo do esperado)");
  });

  test("a aba Semanas mostra as curvas e aplica a maturação sugerida", async ({ page }) => {
    await seedResultado();
    await page.goto("/dashboard?aba=semanas");
    await expect(page.getByRole("region", { name: "Curvas de safra" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Mapa safra × semana" })).toContainText("S01");
    const dist = page.getByRole("region", { name: "Dias do cadastro à primeira AT" });
    await expect(dist).toContainText("Maturação sugerida: 1 semana (atual: 0)");

    await dist.getByRole("button", { name: "Usar 1 semana" }).click();
    await page.getByRole("button", { name: "Usar sugestão" }).click();
    await expect(page.getByText("Maturação atualizada")).toBeVisible();
    const [m] = await mutations();
    expect(m).toMatchObject({ method: "POST", table: "dashboard_parametros" });
    expect(JSON.parse(m!.body)).toMatchObject({ id: true, maturacao_semanas: 1 });
  });

  test("a aba Semanas mostra o abastecimento e os Indicadores avisam que são a visão antiga", async ({
    page,
  }) => {
    await page.goto("/dashboard?aba=semanas");
    await expect(
      page.getByRole("region", { name: "Abastecimento e qualidade dos dados" }),
    ).toContainText("Aguardando início");
    await page.getByRole("tab", { name: "Indicadores" }).click();
    await expect(page.getByRole("note")).toContainText("Visão antiga.");
  });
});
