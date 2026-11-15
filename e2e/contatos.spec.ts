import { expect, mutations, seed, test, TODAY } from "./helpers";

test.describe("Contatos", () => {
  test("lista os contatos do hunter e busca sem acento", async ({ page }) => {
    await page.goto("/contatos");
    await expect(page.getByText("8 contatos ·")).toBeVisible();
    await page.getByPlaceholder("Buscar por nome ou empresa").fill("fabio");
    await expect(page.getByText("1 contatos ·")).toBeVisible();
    await expect(page.locator("main tbody tr")).toHaveCount(1);
  });

  test("ação em lote registra o LinkedIn 1 dos selecionados", async ({ page }) => {
    await page.goto("/contatos");
    // a primeira caixa da linha é a seleção; as outras marcam as etapas enviadas
    await page.locator("main tbody tr").first().getByRole("checkbox").first().click();
    await expect(page.getByText("1 selecionados")).toBeVisible();
    await page.getByRole("button", { name: "Enviei LinkedIn 1 hoje para os selecionados" }).click();
    await expect(page.getByText("LinkedIn 1 registrada para 1 contatos")).toBeVisible();
    const [m] = await mutations();
    expect(m!.query).toMatch(/id=in\./);
    expect(JSON.parse(m!.body)).toEqual({
      step1_date: TODAY,
      sent1_at: TODAY,
      status: "em_cadencia",
    });
  });

  test("editar a empresa salva ao sair do campo", async ({ page }) => {
    await page.goto("/contatos");
    const empresa = page.locator("main tbody tr").first().getByPlaceholder("Empresa");
    await empresa.fill("Nova Empresa");
    await empresa.press("Enter");
    await expect.poll(async () => (await mutations()).length).toBe(1);
    expect(JSON.parse((await mutations())[0]!.body)).toEqual({ company: "Nova Empresa" });
  });

  test("filtra os contatos sem empresa ou sem área", async ({ page }) => {
    await page.goto("/contatos");
    const pend = page.getByRole("combobox", { name: "Pendências" });
    await pend.selectOption({ label: "Sem área" });
    await expect(page.getByText("3 contatos ·")).toBeVisible();
    await pend.selectOption({ label: "Sem empresa" });
    await expect(page.getByText("1 contatos ·")).toBeVisible();
    await expect(page.locator("main tbody tr").first()).toContainText("Diretora de Operações");
  });

  test("preenche empresa e área vazias a partir do headline", async ({ page }) => {
    await page.goto("/contatos");
    await page.getByRole("button", { name: "Preencher empresa e área (1)" }).click();
    await expect(page.getByText("1 com a empresa tirada do headline")).toBeVisible();
    await page.getByRole("button", { name: "Preencher", exact: true }).click();
    await expect(page.getByText("1 contatos completados")).toBeVisible();
    const [m] = await mutations();
    expect(m).toMatchObject({ method: "PATCH", table: "contacts" });
    expect(m!.query).toMatch(/id=in\./);
    expect(JSON.parse(m!.body)).toEqual({
      company: "Alfa",
      company_gender: "feminino",
      sector: "Operações",
    });
  });

  test("pagina listas grandes e o selecionar todos vale para o filtro inteiro", async ({
    page,
  }) => {
    await seed(60);
    await page.goto("/contatos");
    await expect(page.getByText("68 contatos ·")).toBeVisible();
    await expect(page.locator("main tbody tr")).toHaveCount(50);
    await expect(page.getByText("1–50 de 68 contatos")).toBeVisible();
    await page.getByRole("button", { name: "Próxima" }).click();
    await expect(page.locator("main tbody tr")).toHaveCount(18);
    await page.getByRole("checkbox", { name: /Selecionar todos os contatos do filtro/ }).click();
    await expect(page.getByText("68 selecionados")).toBeVisible();
  });

  test("descartar em lote pede confirmação", async ({ page }) => {
    await page.goto("/contatos");
    await page.locator("main tbody tr").first().getByRole("checkbox").first().click();
    await page.getByRole("button", { name: "Marcar como descartado" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Descartar 1 contato?");
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    expect(await mutations()).toEqual([]);

    await page.getByRole("button", { name: "Marcar como descartado" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Descartar" }).click();
    await expect(page.getByText("Contato descartado")).toBeVisible();
    const [m] = await mutations();
    expect(m).toMatchObject({ method: "PATCH", table: "contacts" });
    expect(JSON.parse(m!.body)).toEqual({ status: "descartado" });
  });

  test("marcar 'respondeu' pergunta qual mensagem gerou a resposta", async ({ page }) => {
    await page.goto("/contatos");
    const row = page
      .locator("main tbody tr")
      .filter({ has: page.locator('input[value="Bruno Lima"]') });
    const responder = async () => {
      await row.getByRole("combobox").filter({ hasText: "Em cadência" }).click();
      await page.getByRole("option", { name: "Respondeu" }).click();
    };
    const origem = page.getByRole("dialog", { name: "Qual mensagem gerou a resposta?" });
    // Cancelar não grava a resposta.
    await responder();
    await origem.getByRole("button", { name: "Cancelar" }).click();
    await expect(origem).toBeHidden();
    expect(await mutations()).toEqual([]);
    await responder();
    await origem.getByLabel(/Outro canal/).check();
    await origem.getByRole("button", { name: "Salvar" }).click();
    await expect.poll(async () => (await mutations()).length).toBe(1);
    const [m] = await mutations();
    expect(JSON.parse(m!.body)).toEqual({ status: "respondeu", resposta_etapa: 0 });
  });

  test("desfazer uma etapa do funil pede confirmação", async ({ page }) => {
    await page.goto("/contatos");
    // O nome fica num campo editável, então a linha é achada pelo valor do campo.
    const row = page
      .locator("main tbody tr")
      .filter({ has: page.locator('input[value="Fábio Neves"]') });
    await row.getByRole("button", { name: "Avançar no funil" }).click();
    await page.getByRole("button", { name: "Desfazer Lead" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Desfazer Lead?");
    await dialog.getByRole("button", { name: "Desfazer" }).click();
    await expect.poll(async () => (await mutations()).length).toBe(1);
    const [m] = await mutations();
    expect(m).toMatchObject({ method: "PATCH", table: "contacts" });
    expect(JSON.parse(m!.body)).toMatchObject({ lead_em: null });
  });
});
