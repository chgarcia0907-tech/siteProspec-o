import { expect, mutations, test } from "./helpers";

const P1 = "aaaaaaaa-0000-4000-8000-000000000001";
const SAFRA_S01 = "16161616-0000-4000-8000-000000000001";
const SAFRA_S02 = "16161616-0000-4000-8000-000000000002";

// Hoje é 12/11/2026 (quinta). O Ciclo Nov (ativo) tem a S01 (02/11, sem alocação) e a S02
// (09/11, a semana de hoje). Maturação de 3 semanas.
test.describe("Dashboard › Semanas", () => {
  test("a aba fica na URL e mostra o calendário em escada do ciclo ativo", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("tab", { name: "Semanas" }).click();
    await expect(page).toHaveURL(/\/dashboard\?aba=semanas$/);
    await expect(page.getByLabel("Ciclo", { exact: true })).toHaveValue(P1);

    const cal = page.getByRole("table", { name: /Fase de cada safra do ciclo Ciclo Nov/ });
    const s1 = cal.getByRole("row", { name: /Ciclo Nov-S01/ });
    const s2 = cal.getByRole("row", { name: /Ciclo Nov-S02/ });
    await expect(s1).toContainText("02/11 a 06/11");
    await expect(s1).toContainText("Em cadência");
    await expect(s1).toContainText("Não usa");
    await expect(s2).toContainText("Em prospecção");
    await expect(s2).toContainText("Usa");
    // Colunas de 02/11 até a semana em que a S02 amadurece (07/12); hoje é a semana de 09/11.
    await expect(cal.getByRole("columnheader", { name: /09\/11\s*hoje/ })).toBeVisible();
    await expect(cal.getByRole("columnheader", { name: "07/12" })).toBeVisible();
    await expect(s1.getByTitle(/semana de 07\/12\/2026: Madura \(previsto\)/)).toBeVisible();

    await page.getByRole("tab", { name: "Indicadores" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("cria a próxima safra já preenchida e valida a segunda-feira", async ({ page }) => {
    await page.goto("/dashboard?aba=semanas");
    await page.getByRole("button", { name: "Nova safra" }).click();
    const dialog = page.getByRole("dialog", { name: "Nova safra" });
    await expect(dialog.getByLabel("Número")).toHaveValue("3");
    await expect(dialog.getByLabel("Início (segunda)")).toHaveValue("2026-11-16");
    await expect(dialog.getByLabel("Fim")).toHaveValue("2026-11-20");

    await dialog.getByLabel("Início (segunda)").fill("2026-11-17");
    await dialog.getByLabel("Fim").fill("2026-11-20");
    await dialog.getByRole("button", { name: "Criar safra" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("A safra começa numa segunda-feira.");
    expect(await mutations()).toEqual([]);

    await dialog.getByLabel("Início (segunda)").fill("2026-11-16");
    await dialog.getByRole("button", { name: "Criar safra" }).click();
    await expect(page.getByText("S03 criada")).toBeVisible();
    const [m] = await mutations();
    expect(m).toMatchObject({ method: "POST", table: "safras" });
    expect(JSON.parse(m!.body)).toEqual({
      numero: 3,
      inicio: "2026-11-16",
      fim: "2026-11-20",
      usa_alocacao: true,
      period_id: P1,
    });
  });

  test("gera as semanas que faltam com prévia", async ({ page }) => {
    await page.goto("/dashboard?aba=semanas");
    await page.getByRole("button", { name: "Gerar semanas" }).click();
    const dialog = page.getByRole("dialog", { name: "Gerar semanas do Ciclo Nov" });
    await expect(dialog.getByLabel("A partir de")).toHaveValue("2026-11-16");
    await expect(dialog.getByLabel("Até")).toHaveValue("2026-11-30");
    await expect(dialog).toContainText("Vai criar 3 safras: S03 (16/11/2026) a S05 (30/11/2026).");
    await dialog.getByRole("button", { name: "Gerar semanas" }).click();
    await expect(page.getByText("3 safras criadas")).toBeVisible();
    const [m] = await mutations();
    expect(m).toMatchObject({ method: "POST", table: "safras" });
    expect(JSON.parse(m!.body).map((s: { numero: number; inicio: string }) => s.inicio)).toEqual([
      "2026-11-16",
      "2026-11-23",
      "2026-11-30",
    ]);
  });

  test("edita a safra e avisa quando a semana muda", async ({ page }) => {
    await page.goto("/dashboard?aba=semanas");
    await page.getByRole("button", { name: "Editar S01" }).click();
    const dialog = page.getByRole("dialog", { name: "Editar S01" });
    await dialog.getByLabel("Usa alocação").check();
    await dialog.getByRole("button", { name: "Salvar safra" }).click();
    await expect(page.getByText("S01 salva")).toBeVisible();
    const [m] = await mutations();
    expect(m).toMatchObject({ method: "PATCH", table: "safras" });
    expect(m!.query).toContain(SAFRA_S01);
    expect(JSON.parse(m!.body)).toMatchObject({ usa_alocacao: true, inicio: "2026-11-02" });

    await page.getByRole("button", { name: "Editar S01" }).click();
    const outra = page.getByRole("dialog", { name: "Editar S01" });
    await outra.getByLabel("Início (segunda)").fill("2026-10-26");
    await expect(outra).toContainText("Mudar a semana muda a safra dos contatos");
    await expect(outra.getByRole("button", { name: "Mudar a semana e salvar" })).toBeVisible();
  });

  test("excluir uma safra pede confirmação", async ({ page }) => {
    await page.goto("/dashboard?aba=semanas");
    await page.getByRole("button", { name: "Excluir S02" }).click();
    const confirmar = page.getByRole("alertdialog");
    await expect(confirmar).toContainText("Excluir a S02 do Ciclo Nov?");
    await confirmar.getByRole("button", { name: "Excluir safra" }).click();
    await expect(page.getByText("S02 excluída")).toBeVisible();
    const [m] = await mutations();
    expect(m).toMatchObject({ method: "DELETE", table: "safras" });
    expect(m!.query).toContain(SAFRA_S02);
  });

  test("define as metas do ciclo e mantém o que foi digitado quando há erro", async ({ page }) => {
    await page.goto("/dashboard?aba=semanas");
    const card = page.getByRole("region", { name: "Metas do ciclo Ciclo Nov" });
    await expect(card).toContainText("Sem metas definidas");
    await card.getByRole("button", { name: "Editar metas" }).click();
    const dialog = page.getByRole("dialog", { name: "Metas do ciclo Ciclo Nov" });
    await dialog.getByLabel("ATs que avançaram").fill("1,5");
    await dialog.getByRole("button", { name: "Salvar metas" }).click();
    await expect(dialog.getByRole("alert")).toContainText("ATs que avançaram");
    await expect(dialog.getByLabel("ATs que avançaram")).toHaveValue("1,5");

    await dialog.getByLabel("ATs que avançaram").fill("40");
    await dialog.getByLabel("ATs marcadas").fill("120");
    await dialog.getByRole("button", { name: "Salvar metas" }).click();
    await expect(page.getByText("Metas do ciclo salvas")).toBeVisible();
    const [m] = await mutations();
    expect(m).toMatchObject({ method: "POST", table: "ciclo_metas" });
    expect(JSON.parse(m!.body)).toEqual({
      period_id: P1,
      ats_avancaram: 40,
      ats_marcadas: 120,
      ats_realizadas: null,
      contatos: null,
      vendas: null,
    });
  });

  test("configura os parâmetros da dashboard", async ({ page }) => {
    await page.goto("/dashboard?aba=semanas");
    await page.getByRole("button", { name: "Configurar dashboard" }).click();
    const dialog = page.getByRole("dialog", { name: "Configurar dashboard" });
    await expect(dialog.getByLabel("Janela de maturação")).toHaveValue("3");
    await dialog.getByLabel("Segmento é trocado abaixo de").fill("60");
    await dialog.getByRole("button", { name: "Salvar parâmetros" }).click();
    await expect(dialog.getByRole("alert")).toContainText("trocar o segmento");
    expect(await mutations()).toEqual([]);

    await dialog.getByLabel("Segmento é trocado abaixo de").fill("35");
    await dialog.getByLabel("Janela de maturação").fill("2");
    await dialog.getByRole("button", { name: "Salvar parâmetros" }).click();
    await expect(page.getByText("Parâmetros salvos")).toBeVisible();
    const [m] = await mutations();
    expect(m).toMatchObject({ method: "POST", table: "dashboard_parametros" });
    expect(JSON.parse(m!.body)).toMatchObject({ id: true, maturacao_semanas: 2 });
  });
});
