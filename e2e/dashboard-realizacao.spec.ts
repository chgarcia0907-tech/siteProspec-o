import { expect, mutations, test } from "./helpers";

// Hoje é 12/11/2026. ATs do Ciclo Nov nos dados simulados: Sigma (no-show em 09/11), Ômega
// (realizada em 11/11, card 94307 com 6 dias na AT agendada) e Alfa (remarcada para 17/11).
test.describe("Dashboard: Realização e avanço", () => {
  test("mostra totais, situação por semana, horários, antecedência e tempo por etapa", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.getByRole("tab", { name: "Realização e avanço" }).click();
    await expect(page).toHaveURL(/\/dashboard\?aba=realizacao$/);
    await expect(
      page.getByRole("heading", { name: "As ATs marcadas acontecem e avançam?" }),
    ).toBeVisible();

    const totais = page.getByRole("definition").filter({ hasText: "33,3% (1 de 3)" });
    await expect(totais).toHaveCount(2);
    await expect(page.getByLabel(/^Situação das ATs por semana:/)).toHaveAttribute(
      "aria-label",
      /S02: 1 realizadas, 1 no-show.*S03: 0 realizadas, 0 no-show, 0 canceladas, 0 sem desfecho, 1 agendadas, 1 remarcadas/,
    );

    // Alfa: o horário original (sexta, 10h) foi remarcado.
    const horarios = page.getByRole("region", { name: "No-show e remarcação por horário" });
    await expect(
      horarios.getByTitle("sexta, 10h: 0 no-show e 1 remarcação(ões) em 1 horário(s)"),
    ).toBeVisible();

    const antecedencia = page.getByRole("region", { name: "Antecedência × % realizada" });
    await expect(antecedencia).toContainText("6 a 10 dias");

    const tempo = page.getByRole("region", { name: "Tempo por etapa × meta" });
    const agendada = tempo.getByRole("row", { name: /AT Diag\. Agendada/ });
    await expect(agendada).toContainText("7 d");
    await expect(agendada).toContainText("6 d");
    await expect(agendada).toContainText("100% (1 de 1)");
    await expect(tempo.getByRole("row", { name: /AT Diag\. Realizada/ })).toContainText("1");

    await expect(page.getByRole("region", { name: "Funil por setor alocado" })).toContainText(
      "Sem alocação",
    );
    await expect(page.getByText("Nenhum card perdido no ciclo.")).toBeVisible();
  });

  test("edita as metas de tempo por etapa com validação", async ({ page }) => {
    await page.goto("/dashboard?aba=realizacao");
    await page.getByRole("button", { name: "Editar metas" }).click();
    const dialog = page.getByRole("dialog", { name: "Metas de tempo por etapa" });
    await expect(dialog.getByLabel("Negociação")).toHaveValue("4");

    await dialog.getByLabel("Negociação").fill("0");
    await dialog.getByRole("button", { name: "Salvar metas" }).click();
    await expect(dialog.getByRole("alert")).toHaveText(
      'A meta de "Negociação" deve ser de 1 a 365 dias.',
    );
    expect(await mutations()).toEqual([]);

    await dialog.getByLabel("Negociação").fill("6");
    await dialog.getByRole("button", { name: "Salvar metas" }).click();
    await expect(dialog).toBeHidden();
    const [m] = await mutations();
    expect(m).toMatchObject({ method: "POST", table: "dashboard_tempo_etapas" });
    expect(JSON.parse(m!.body)).toContainEqual({ stage_id: 35, meta_dias: 6 });
  });
});
