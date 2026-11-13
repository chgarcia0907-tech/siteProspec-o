import { expect, mutations, test, TODAY } from "./helpers";

test.describe("Envios de hoje", () => {
  test("monta uma fila por etapa, com atrasados destacados", async ({ page }) => {
    await page.goto("/hoje");
    const tab = (name: string) => page.getByRole("tab", { name: new RegExp(`^${name}`) });
    await expect(tab("LinkedIn 1")).toHaveText(/LinkedIn 1\s*2/);
    await expect(tab("WhatsApp 1")).toHaveText(/WhatsApp 1\s*1/);
    await expect(tab("LinkedIn 2")).toHaveText(/LinkedIn 2\s*1/);
    await expect(tab("WhatsApp 2")).toHaveText(/WhatsApp 2\s*2/);
    await expect(tab("LinkedIn 3")).toHaveText(/LinkedIn 3\s*2/);

    await tab("WhatsApp 1").click();
    await expect(page.getByText("Bruno Lima")).toBeVisible();
    await expect(page.getByText("Atrasado — previsto 06/11/2026")).toBeVisible();
  });

  test("marcar como enviado grava a data e a situação", async ({ page }) => {
    await page.goto("/hoje");
    await page.getByRole("tab", { name: /^WhatsApp 1/ }).click();
    await page.getByRole("button", { name: "Marcar como enviado" }).click();
    await expect(page.getByText("WhatsApp 1 registrada para Bruno Lima")).toBeVisible();
    const [m] = await mutations();
    expect(m).toMatchObject({ method: "PATCH", table: "contacts" });
    expect(JSON.parse(m!.body)).toEqual({ sent2_at: TODAY, status: "em_cadencia" });
  });

  test("copia a mensagem do modelo com os dados do lead", async ({ page }) => {
    await page.goto("/hoje");
    await page.getByRole("tab", { name: /^WhatsApp 1/ }).click();
    await page.getByRole("button", { name: "Copiar mensagem" }).click();
    await expect(page.getByText("Mensagem copiada")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "Olá, Bruno! Mensagem 2 no Beta.",
    );
  });

  test("lead sem empresa pede a empresa antes de copiar", async ({ page }) => {
    await page.goto("/hoje");
    await page.getByRole("button", { name: "Copiar mensagem" }).first().click();
    await expect(page.getByText("Preencha a empresa deste lead").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Salvar empresa" })).toBeVisible();
    expect(await mutations()).toEqual([]);
  });

  test("avançar no funil marca a AT com data e registro", async ({ page }) => {
    await page.goto("/hoje");
    await page.getByRole("tab", { name: /^WhatsApp 1/ }).click();
    await page.getByRole("button", { name: "Avançar no funil" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Marcar AT marcada" }).click();
    await expect(page.getByText("Funil atualizado")).toBeVisible();
    const body = JSON.parse((await mutations())[0]!.body);
    expect(body.at_marcada_em).toBe(TODAY);
    expect(body.at_registrado_em).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
