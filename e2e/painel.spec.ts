import { expect, mutations, seed, test } from "./helpers";

test.describe("Painel do administrador", () => {
  test("lista hunters e contatos de cada um", async ({ page }) => {
    await page.goto("/painel");
    await page.getByRole("tab", { name: "Hunters" }).click();
    await expect(page.getByText("Hunters · 11 contatos no total")).toBeVisible();
    await page.getByRole("button", { name: /Hunter Um/ }).click();
    await expect(
      page.getByText("hunter1@example.com · 8 contatos · 3 ATs · 1 descartados"),
    ).toBeVisible();
  });

  test("ação destrutiva exige digitar a palavra de confirmação", async ({ page }) => {
    await page.goto("/painel");
    await page.getByRole("tab", { name: "Hunters" }).click();
    await page.getByRole("button", { name: /Hunter Um/ }).click();
    await page.getByRole("button", { name: "Limpar todos deste hunter" }).click();
    const dialog = page.getByRole("alertdialog");
    const confirmar = dialog.getByRole("button", { name: "Excluir" });
    await expect(confirmar).toBeDisabled();
    await dialog.getByRole("textbox").fill("excluir");
    await expect(confirmar).toBeEnabled();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    expect(await mutations()).toEqual([]);
  });

  test("excluir um contato apaga só ele", async ({ page }) => {
    await page.goto("/painel");
    await page.getByRole("tab", { name: "Hunters" }).click();
    await page.getByRole("button", { name: /Hunter Um/ }).click();
    await page
      .getByRole("row", { name: /Ana Souza/ })
      .getByRole("button", { name: "Excluir" })
      .click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Excluir" }).click();
    await expect.poll(async () => (await mutations()).length).toBe(1);
    expect((await mutations())[0]).toMatchObject({ method: "DELETE", table: "contacts" });
    expect((await mutations())[0]!.query).toContain("dddddddd-0000-4000-8000-000000000001");
  });

  test("períodos mostram grupos e membros sem grupo", async ({ page }) => {
    await page.goto("/painel");
    await page.getByRole("tab", { name: "Períodos e grupos" }).click();
    await expect(page.getByText("1 membro aguardando alocação em grupo")).toBeVisible();
    await expect(page.getByRole("row", { name: /Hunter Um/ })).toContainText("Squad Azul");
    await expect(page.getByRole("row", { name: /Hunter Dois/ })).toContainText("Sem grupo");
  });

  test("no celular todas as abas ficam ao alcance do toque", async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto("/painel");
    await page.getByRole("tab", { name: "Busca geral" }).click();
    await expect(
      page.getByPlaceholder("Nome ou empresa (opcional com filtro de data)"),
    ).toBeVisible();
  });

  test("a tabela de contatos do hunter pagina e as ações destrutivas ficam na zona de risco", async ({
    page,
  }) => {
    await seed(60);
    await page.goto("/painel?aba=hunters");
    await page.getByRole("button", { name: /Hunter Um/ }).click();
    await expect(page.getByText("1–50 de 68 contatos")).toBeVisible();
    await expect(page.locator("main tbody tr")).toHaveCount(50);
    await page.getByRole("button", { name: "Próxima" }).click();
    await expect(page.locator("main tbody tr")).toHaveCount(18);
    const risco = page.getByRole("region", { name: "Zona de risco" });
    await expect(risco.getByRole("button", { name: "Limpar todos deste hunter" })).toBeVisible();
    // Com contatos, a conta não pode ser excluída: o botão fica travado e a tela explica.
    await expect(risco.getByRole("button", { name: "Excluir hunter" })).toBeDisabled();
    await expect(risco).toContainText("transfira ou exclua os 68 contatos dele antes");
  });
  test("auditoria de conexões mostra o que o hunter não importou", async ({ page }) => {
    const colado = [
      ["Ana Souza", "Diretora de Operações na Alfa", "3 de novembro de 2026"],
      ["Bruno Lima", "CTO na Beta", "2 de novembro de 2026"],
      ["Carla Maria Dias", "Gerente de TI", "10 de novembro de 2026"],
      ["Nova Pessoa", "Sócia na Ômega", "10 de novembro de 2026"],
      ["Velha Conhecida", "Analista", "1 de setembro de 2026"],
    ]
      .flatMap(([nome, headline, data]) => [
        `Foto do perfil de ${nome}`,
        nome!,
        headline!,
        `Conexão feita em ${data}`,
      ])
      .join("\n");
    await page.goto("/painel?aba=auditoria");
    await page
      .getByLabel("Hunter", { exact: true })
      .selectOption({ label: "Hunter Um (8 contatos)" });
    await page.getByLabel("Texto copiado da página de conexões do LinkedIn").fill(colado);

    await expect(page.getByRole("group", { name: "Conexões coladas" })).toContainText("5");
    await expect(page.getByRole("group", { name: "Importadas", exact: true })).toContainText("3");
    await expect(page.getByRole("group", { name: "Não importadas" })).toContainText(
      "a mais antiga é de 01/09/2026",
    );
    await expect(
      page.getByText("1 conexão dos últimos 30 dias ainda não foi importada por Hunter Um"),
    ).toBeVisible();

    // A lista abre nas não importadas, a mais recente primeiro.
    const linhas = page.locator("main tbody").last().locator("tr");
    await expect(linhas).toHaveCount(2);
    await expect(linhas.nth(0)).toContainText("Nova Pessoa");
    await expect(linhas.nth(1)).toContainText("Velha Conhecida");

    // Headline mudada e nome editado ainda contam como importados.
    await page.getByRole("button", { name: "Importadas (3)" }).click();
    await expect(page.getByRole("row", { name: /Bruno Lima/ })).toContainText("headline mudou");
    await expect(page.getByRole("row", { name: /Carla Maria Dias/ })).toContainText(
      "nome parecido: cadastrada como “Carla Dias”",
    );

    await page.getByRole("button", { name: "Copiar lista de não importadas" }).click();
    const copiado = await page.evaluate(() => navigator.clipboard.readText());
    expect(copiado).toContain("Hunter Um (2):");
    expect(copiado).toContain("- Nova Pessoa (conexão em 10/11/2026)");
    expect(await mutations()).toEqual([]);
  });
});
