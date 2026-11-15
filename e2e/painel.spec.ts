import { expect, mutations, test } from "./helpers";

test.describe("Painel do administrador", () => {
  test("lista hunters e contatos de cada um", async ({ page }) => {
    await page.goto("/painel");
    await expect(page.getByText("Hunters · 11 contatos no total")).toBeVisible();
    await page.getByRole("button", { name: /Hunter Um/ }).click();
    await expect(
      page.getByText("hunter1@example.com · 8 contatos · 3 ATs · 1 descartados"),
    ).toBeVisible();
  });

  test("ação destrutiva exige digitar a palavra de confirmação", async ({ page }) => {
    await page.goto("/painel");
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
});
