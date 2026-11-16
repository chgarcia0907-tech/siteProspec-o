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
});
