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
