import { expect, test } from "./helpers";

test.describe("Modelos", () => {
  test("mostra o modelo de cada etapa com a pré-visualização ao lado", async ({ page }) => {
    await page.goto("/modelos");
    await expect(page.getByRole("heading", { name: "Modelos", level: 1 })).toBeVisible();
    await expect(page.getByLabel("Modelo LinkedIn 1")).toContainText(
      "Olá, [FIRST NAME]! Mensagem 1 [NA_EMPRESA].",
    );
    await expect(page.getByLabel("Pré-visualização LinkedIn 1")).toContainText(
      "Olá, Mariana! Mensagem 1 na Acme Indústria.",
    );
    await page.getByRole("tab", { name: /^WhatsApp 2/ }).click();
    await expect(page.getByLabel("Modelo WhatsApp 2")).toContainText("Mensagem 4");
  });

  test("na cadência de um setor, marca as etapas próprias e as que usam o padrão", async ({
    page,
  }) => {
    await page.goto("/modelos");
    await page.getByRole("combobox", { name: "Cadência" }).selectOption({ label: "Setor: Varejo" });
    // O Varejo só tem mensagem própria no WhatsApp 2.
    await expect(page.getByRole("tab", { name: /^WhatsApp 2/ })).toContainText("própria");
    await expect(page.getByRole("tab", { name: /^LinkedIn 1/ })).toContainText("padrão");
    await expect(page.getByText("sem mensagem do setor: usa o modelo padrão")).toBeVisible();
    await page.getByRole("tab", { name: /^WhatsApp 2/ }).click();
    await expect(page.getByLabel("Modelo WhatsApp 2")).toContainText("Cadência do varejo");
    await expect(page.getByText("VAR4")).toBeVisible();
  });
});
