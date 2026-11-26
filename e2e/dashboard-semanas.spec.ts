import { expect, mutations, test } from "./helpers";

const P1 = "aaaaaaaa-0000-4000-8000-000000000001";
const SAFRA_S01 = "16161616-0000-4000-8000-000000000001";
const SAFRA_S02 = "16161616-0000-4000-8000-000000000002";
const SAFRA_S03 = "16161616-0000-4000-8000-000000000003";
const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const SETOR_VAREJO = "12121212-0000-4000-8000-000000000001";
const SETOR_INDUSTRIA = "12121212-0000-4000-8000-000000000003";
const SUBSETOR_METALURGIA = "12121212-0000-4000-8000-000000000004";

// Hoje é 12/11/2026 (quinta). O Ciclo Nov (ativo) tem a S01 (02/11, sem alocação), a S02
// (09/11, a semana de hoje) e a S03 (16/11). Maturação de 3 semanas.
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

    await page.getByRole("tab", { name: "Visão geral" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("cria a próxima safra já preenchida e valida a segunda-feira", async ({ page }) => {
    await page.goto("/dashboard?aba=semanas");
    await page.getByRole("button", { name: "Nova safra" }).click();
    const dialog = page.getByRole("dialog", { name: "Nova safra" });
    await expect(dialog.getByLabel("Número")).toHaveValue("4");
    await expect(dialog.getByLabel("Início (segunda)")).toHaveValue("2026-11-23");
    await expect(dialog.getByLabel("Fim")).toHaveValue("2026-11-27");

    await dialog.getByLabel("Início (segunda)").fill("2026-11-24");
    await dialog.getByLabel("Fim").fill("2026-11-27");
    await dialog.getByRole("button", { name: "Criar safra" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("A safra começa numa segunda-feira.");
    expect(await mutations()).toEqual([]);

    await dialog.getByLabel("Início (segunda)").fill("2026-11-23");
    // Padrão: cadência na semana seguinte; aqui, prospecção e cadência na mesma semana.
    await expect(dialog.getByLabel("Cadência")).toHaveValue("1");
    await dialog.getByLabel("Cadência").selectOption({ label: "Na mesma semana da prospecção" });
    await dialog.getByRole("button", { name: "Criar safra" }).click();
    await expect(page.getByText("S04 criada")).toBeVisible();
    const [m] = await mutations();
    expect(m).toMatchObject({ method: "POST", table: "safras" });
    expect(JSON.parse(m!.body)).toEqual({
      numero: 4,
      inicio: "2026-11-23",
      fim: "2026-11-27",
      usa_alocacao: true,
      cadencia_em: "2026-11-23",
      period_id: P1,
    });
  });

  test("gera as semanas que faltam com prévia", async ({ page }) => {
    await page.goto("/dashboard?aba=semanas");
    await page.getByRole("button", { name: "Gerar semanas" }).click();
    const dialog = page.getByRole("dialog", { name: "Gerar semanas do Ciclo Nov" });
    await expect(dialog.getByLabel("A partir de")).toHaveValue("2026-11-23");
    await expect(dialog.getByLabel("Até")).toHaveValue("2026-11-30");
    await expect(dialog).toContainText("Vai criar 2 safras: S04 (23/11/2026) a S05 (30/11/2026).");
    await dialog.getByRole("button", { name: "Gerar semanas" }).click();
    await expect(page.getByText("2 safras criadas")).toBeVisible();
    const [m] = await mutations();
    expect(m).toMatchObject({ method: "POST", table: "safras" });
    expect(JSON.parse(m!.body).map((s: { numero: number; inicio: string }) => s.inicio)).toEqual([
      "2026-11-23",
      "2026-11-30",
    ]);
  });

  test("gera semanas com uma pausa (provas) e a cadência na próxima semana gerada", async ({
    page,
  }) => {
    await page.goto("/dashboard?aba=semanas");
    await page.getByRole("button", { name: "Gerar semanas" }).click();
    const dialog = page.getByRole("dialog", { name: "Gerar semanas do Ciclo Nov" });
    await dialog.getByLabel("Até").fill("2026-12-07");
    await dialog.getByRole("checkbox", { name: "Gerar a semana de 30/11" }).uncheck();
    await dialog
      .getByRole("checkbox", { name: "Prospecção e cadência na mesma semana em 23/11" })
      .check();
    await expect(dialog.getByRole("row", { name: /^30\/11/ })).toContainText("Pausa (sem safra)");
    await expect(dialog.getByRole("row", { name: /^23\/11/ })).toContainText(
      "S04 · cadência na mesma semana",
    );
    await expect(dialog.getByRole("row", { name: /^07\/12/ })).toContainText(
      "S05 · cadência em 14/12",
    );
    await dialog.getByRole("button", { name: "Gerar semanas" }).click();
    await expect(page.getByText("2 safras criadas")).toBeVisible();
    const [m] = await mutations();
    expect(JSON.parse(m!.body)).toEqual([
      expect.objectContaining({ numero: 4, inicio: "2026-11-23", cadencia_em: "2026-11-23" }),
      expect.objectContaining({ numero: 5, inicio: "2026-12-07", cadencia_em: "2026-12-14" }),
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
    await page.getByRole("button", { name: "Excluir S03" }).click();
    const confirmar = page.getByRole("alertdialog");
    await expect(confirmar).toContainText("Excluir a S03 do Ciclo Nov?");
    await confirmar.getByRole("button", { name: "Excluir safra" }).click();
    await expect(page.getByText("S03 excluída")).toBeVisible();
    const [m] = await mutations();
    expect(m).toMatchObject({ method: "DELETE", table: "safras" });
    expect(m!.query).toContain(SAFRA_S03);
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

  test("na semana em andamento só dá para trocar o setor, valendo a partir de hoje", async ({
    page,
  }) => {
    await page.goto("/dashboard?aba=semanas");
    const sec = page.getByRole("region", { name: "Alocação da semana" });
    await expect(sec.getByLabel("Safra", { exact: true })).toHaveValue(SAFRA_S02);
    await expect(sec).toContainText("Safra em andamento: só a troca de setor");
    const tabela = sec.getByRole("table", { name: /Alocação da S02/ });
    const um = tabela.getByRole("row", { name: /Hunter Um/ });
    await expect(um).toContainText("Varejo");
    await expect(um).toContainText("D1");
    await expect(um).toContainText("10");
    await expect(um).toContainText("40");
    await expect(tabela.getByRole("row", { name: /Hunter Dois/ })).toContainText("Não alocado");
    await expect(sec.getByRole("button", { name: "Alocar hunter" })).toHaveCount(0);
    await expect(sec.getByRole("button", { name: /Editar alocação/ })).toHaveCount(0);

    await um.getByRole("button", { name: "Trocar setor de Hunter Um" }).click();
    const dialog = page.getByRole("dialog", { name: "Trocar setor de Hunter Um" });
    await expect(dialog.getByLabel("A partir de")).toHaveValue("2026-11-12");
    await dialog.getByRole("button", { name: "Trocar setor" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Escolha um setor diferente do atual.");
    await dialog
      .getByRole("combobox", { name: "Setor alocado" })
      .selectOption(`${SETOR_INDUSTRIA}:${SUBSETOR_METALURGIA}`);
    await dialog.getByRole("button", { name: "Trocar setor" }).click();
    await expect(page.getByText("Hunter Um alocado")).toBeVisible();
    const [m] = await mutations();
    expect(m).toMatchObject({ method: "POST", table: "alocacoes" });
    expect(JSON.parse(m!.body)).toEqual({
      user_id: U1,
      sector_id: SETOR_INDUSTRIA,
      subsector_id: SUBSETOR_METALURGIA,
      dupla: "D1",
      meta_empresas: 10,
      meta_contatos: 40,
      motivo_meta_zero: null,
      vigente_desde: "2026-11-12",
      safra_id: SAFRA_S02,
      created_by: U1,
    });
  });

  test("antes do início da safra aloca, exige motivo da meta zero e copia a anterior", async ({
    page,
  }) => {
    await page.goto("/dashboard?aba=semanas");
    const sec = page.getByRole("region", { name: "Alocação da semana" });
    await sec.getByLabel("Safra", { exact: true }).selectOption(SAFRA_S03);
    await expect(sec).toContainText("Editável até o início da safra.");

    await sec.getByRole("button", { name: "Alocar Hunter Dois" }).click();
    const dialog = page.getByRole("dialog", { name: "Alocar hunter" });
    await expect(dialog.getByLabel("Hunter")).toHaveValue(U2);
    await dialog.getByRole("combobox", { name: "Setor alocado" }).selectOption(SETOR_VAREJO);
    await dialog.getByLabel("Dupla (opcional)").fill("D2");
    await dialog.getByRole("button", { name: "Alocar" }).click();
    await expect(dialog.getByRole("alert")).toContainText("informe o motivo");
    await dialog.getByLabel("Motivo da semana sem prospecção").fill("Semana de provas");
    await dialog.getByRole("button", { name: "Alocar" }).click();
    await expect(page.getByText("Hunter Dois alocado")).toBeVisible();
    let [m] = await mutations();
    expect(m).toMatchObject({ method: "POST", table: "alocacoes" });
    expect(JSON.parse(m!.body)).toMatchObject({
      user_id: U2,
      sector_id: SETOR_VAREJO,
      dupla: "D2",
      meta_empresas: 0,
      meta_contatos: 0,
      motivo_meta_zero: "Semana de provas",
      vigente_desde: "2026-11-16",
      safra_id: SAFRA_S03,
    });

    await sec.getByRole("button", { name: "Copiar da S02" }).click();
    await expect(page.getByText("1 alocação copiada")).toBeVisible();
    m = (await mutations())[1];
    expect(m).toMatchObject({ method: "POST", table: "alocacoes" });
    expect(JSON.parse(m!.body)).toEqual([
      expect.objectContaining({
        user_id: U1,
        sector_id: SETOR_VAREJO,
        dupla: "D1",
        vigente_desde: "2026-11-16",
        safra_id: SAFRA_S03,
      }),
    ]);
  });

  test("safra sem alocação explica como ligar", async ({ page }) => {
    await page.goto("/dashboard?aba=semanas");
    const sec = page.getByRole("region", { name: "Alocação da semana" });
    await sec
      .getByLabel("Safra", { exact: true })
      .selectOption({ label: "S01 · 02/11 a 06/11 (sem alocação)" });
    await expect(sec).toContainText("A S01 não usa alocação.");
  });
});
