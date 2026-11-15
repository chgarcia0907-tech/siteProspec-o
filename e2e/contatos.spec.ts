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
});
