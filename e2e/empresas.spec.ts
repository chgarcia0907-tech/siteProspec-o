import { expect, mutations, test } from "./helpers";

const U1 = "11111111-1111-4111-8111-111111111111";
const SETOR_VAREJO = "12121212-0000-4000-8000-000000000001";

test.describe("Empresas", () => {
  test("lista as empresas por semana, com setor e contatos vinculados", async ({ page }) => {
    await page.goto("/empresas");
    await expect(page.getByText("Semana de 09/11/2026 a 15/11/2026")).toBeVisible();
    await expect(page.getByPlaceholder("Empresa")).toHaveValue("Delta");
    await expect(page.getByText("1 contato", { exact: true })).toBeVisible();
    await expect(page.getByText("cadência do setor incompleta")).toBeVisible();
  });

  test("cadastra várias empresas com o setor e a semana, sem repetir as já cadastradas", async ({
    page,
  }) => {
    await page.goto("/empresas");
    await page.getByLabel("Empresas (uma por linha)").fill("Zeta\ndelta\nÔmega");
    await expect(page.getByText("2 novas · 1 já cadastrada")).toBeVisible();
    // Setor inativo não aparece para o hunter.
    // O primeiro seletor é o do formulário; os seguintes são os das empresas da lista.
    const setor = page.getByRole("combobox", { name: "Setor da empresa" }).first();
    await expect(setor.locator("option", { hasText: "Saúde" })).toHaveCount(0);
    await setor.selectOption({ label: "Varejo" });
    await page.getByRole("button", { name: "Cadastrar" }).click();
    await expect(page.getByText("2 empresas cadastradas")).toBeVisible();

    const [m] = await mutations();
    expect(m).toMatchObject({ method: "POST", table: "companies" });
    const week = "2026-11-09"; // segunda-feira da semana de 12/11/2026
    expect(JSON.parse(m!.body)).toEqual([
      { name: "Zeta", gender: "feminino", sector_id: SETOR_VAREJO, week_start: week, user_id: U1 },
      { name: "Ômega", gender: "feminino", sector_id: SETOR_VAREJO, week_start: week, user_id: U1 },
    ]);
  });

  test("contato vinculado a uma empresa recebe a cadência do setor", async ({ page }) => {
    await page.goto("/hoje");
    await page.getByRole("tab", { name: /^WhatsApp 2/ }).click();
    const card = page
      .locator("div", { hasText: "Diego Rocha" })
      .filter({ has: page.getByRole("button", { name: "Copiar mensagem" }) })
      .last();
    await expect(card.getByText("Varejo", { exact: true })).toBeVisible();
    await expect(card.getByText("VAR4")).toBeVisible();
    await card.getByRole("button", { name: "Copiar mensagem" }).click();
    await expect(page.getByText("Mensagem copiada")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "Oi, Diego! Cadência do varejo na Delta.",
    );
  });

  test("admin escreve a cadência do setor no painel", async ({ page }) => {
    await page.goto("/painel");
    await page.getByRole("tab", { name: "Setores e cadências" }).click();
    await page.getByRole("button", { name: /Varejo/ }).click();
    await page.getByLabel("Código da mensagem LinkedIn 1").fill("VAR1");
    await page
      .getByLabel("Mensagem LinkedIn 1", { exact: true })
      .fill("Olá, [FIRST NAME]! Varejo [NA_EMPRESA].");
    await expect(page.getByText("Olá, Mariana! Varejo na Acme.")).toBeVisible();
    await page.getByRole("button", { name: "Salvar cadência" }).click();
    await expect(page.getByText("Cadência salva")).toBeVisible();

    const m = (await mutations()).find((x) => x.table === "sector_templates");
    expect(m).toMatchObject({ method: "POST" });
    const rows = JSON.parse(m!.body) as { step: number; code: string; body: string }[];
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({
      sector_id: SETOR_VAREJO,
      step: 1,
      code: "VAR1",
      body: "Olá, [FIRST NAME]! Varejo [NA_EMPRESA].",
    });
    expect(rows[3]).toMatchObject({ step: 4, code: "VAR4" });
  });
});
