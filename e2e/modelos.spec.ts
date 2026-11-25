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
    await page
      .getByRole("combobox", { name: "Setor", exact: true })
      .selectOption({ label: "Varejo" });
    // O Varejo só tem mensagem própria no WhatsApp 2.
    await expect(page.getByRole("tab", { name: /^WhatsApp 2/ })).toContainText("do setor");
    await expect(page.getByRole("tab", { name: /^LinkedIn 1/ })).toContainText("padrão");
    await expect(page.getByText("sem mensagem do setor: usa o modelo padrão")).toBeVisible();
    await page.getByRole("tab", { name: /^WhatsApp 2/ }).click();
    await expect(page.getByLabel("Modelo WhatsApp 2")).toContainText("Cadência do varejo");
    await expect(page.getByText("VAR4")).toBeVisible();
  });

  test("Varejo com Patrocinador Executivo usa a mensagem da persona e o padrão nas outras etapas", async ({
    page,
  }) => {
    await page.goto("/modelos");
    await page
      .getByRole("combobox", { name: "Setor", exact: true })
      .selectOption({ label: "Varejo" });
    await page
      .getByRole("combobox", { name: "Persona" })
      .selectOption({ label: "Patrocinador Executivo" });
    const whatsapp2 = page.getByRole("tab", { name: /^WhatsApp 2/ });
    await expect(whatsapp2).toContainText("do setor");
    await whatsapp2.click();
    await expect(page.getByLabel("Modelo WhatsApp 2")).toContainText("Conversa de patrocinador");
    await expect(page.getByText("VAR4PE", { exact: true })).toBeVisible();
    await expect(page.getByText("Varejo · Patrocinador Executivo")).toBeVisible();
    await expect(page.getByLabel("Pré-visualização WhatsApp 2")).toContainText(
      "Conversa de patrocinador",
    );
    // Etapa sem mensagem do Varejo: modelo padrão.
    const linkedin1 = page.getByRole("tab", { name: /^LinkedIn 1/ });
    await expect(linkedin1).toContainText("padrão");
    await linkedin1.click();
    await expect(page.getByLabel("Modelo LinkedIn 1")).toContainText("Mensagem 1");
    await expect(page.getByText("M1", { exact: true })).toBeVisible();
  });

  test("Indústria com Metalurgia mostra as cinco etapas do subsetor e esconde o subsetor inativo", async ({
    page,
  }) => {
    await page.goto("/modelos");
    await page
      .getByRole("combobox", { name: "Setor", exact: true })
      .selectOption({ label: "Indústria" });
    const subsetor = page.getByRole("combobox", { name: "Subsetor" });
    await expect(subsetor.getByRole("option", { name: "Metalurgia" })).toHaveCount(1);
    await expect(subsetor.getByRole("option", { name: "Química" })).toHaveCount(0);
    await subsetor.selectOption({ label: "Metalurgia" });
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      await expect(tabs.nth(i)).toContainText("própria do subsetor");
      await tabs.nth(i).click();
      await expect(page.getByText(`MET${i + 1}`, { exact: true })).toBeVisible();
    }
    await expect(
      page.getByRole("tabpanel").getByText("Indústria › Metalurgia · qualquer persona"),
    ).toBeVisible();
  });

  test("trocar o setor zera o subsetor e sem setor o subsetor fica desabilitado", async ({
    page,
  }) => {
    await page.goto("/modelos");
    const setor = page.getByRole("combobox", { name: "Setor", exact: true });
    const subsetor = page.getByRole("combobox", { name: "Subsetor" });
    const persona = page.getByRole("combobox", { name: "Persona" });
    await expect(subsetor).toBeDisabled();
    await expect(persona).toBeDisabled();
    // Setor inativo (Saúde) não aparece na lista.
    await expect(setor.getByRole("option", { name: "Saúde", exact: true })).toHaveCount(0);
    await setor.selectOption({ label: "Indústria" });
    await expect(subsetor).toBeEnabled();
    await expect(persona).toBeEnabled();
    await subsetor.selectOption({ label: "Metalurgia" });
    await expect(page.getByRole("tab", { name: /^LinkedIn 1/ })).toContainText(
      "própria do subsetor",
    );
    await setor.selectOption({ label: "Varejo" });
    // Varejo não tem subsetor: o select volta a "Sem subsetor" e fica desabilitado.
    await expect(subsetor).toBeDisabled();
    await expect(subsetor).toHaveValue("");
    await expect(page.getByRole("tab", { name: /^LinkedIn 1/ })).toContainText("padrão");
    await setor.selectOption({ label: "Indústria" });
    await expect(subsetor).toHaveValue("");
    await expect(page.getByRole("tab", { name: /^LinkedIn 1/ })).toContainText("padrão");
    await setor.selectOption({ label: "Modelo padrão da equipe" });
    await expect(subsetor).toBeDisabled();
  });
});
