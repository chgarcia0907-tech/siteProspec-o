import { expect, MOCK, mutations, test, TODAY } from "./helpers";

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

  test("avançar no funil marca a AT com data, registro e a mensagem que gerou", async ({
    page,
  }) => {
    await page.goto("/hoje");
    await page.getByRole("tab", { name: /^WhatsApp 1/ }).click();
    await page.getByRole("button", { name: "Avançar no funil" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Marcar AT marcada" }).click();
    // Só grava depois que o hunter diz qual mensagem o lead respondeu.
    const origem = page.getByRole("dialog", { name: "Qual mensagem gerou a resposta?" });
    await expect(origem.getByRole("radio")).toHaveCount(2); // LinkedIn 1 (o único enviado) e outro canal
    const salvar = origem.getByRole("button", { name: "Salvar" });
    await expect(salvar).toBeDisabled();
    expect(await mutations()).toEqual([]);
    await origem.getByLabel(/LinkedIn 1/).check();
    await salvar.click();
    await expect(page.getByText("Funil atualizado")).toBeVisible();
    const body = JSON.parse((await mutations())[0]!.body);
    expect(body.at_marcada_em).toBe(TODAY);
    expect(body.at_registrado_em).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.resposta_etapa).toBe(1);
  });

  test("mostra que está carregando em vez de fila vazia", async ({ page }) => {
    let release = () => {};
    const held = new Promise<void>((r) => (release = r));
    await page.route(`${MOCK}/rest/v1/contacts*`, async (route) => {
      await held;
      await route.continue();
    });
    await page.goto("/hoje");
    await expect(page.getByText("Carregando a fila…")).toBeVisible();
    await expect(page.getByText(/Nada na fila/)).toHaveCount(0);
    release();
    await expect(page.getByRole("tab", { name: /^LinkedIn 1/ })).toHaveText(/LinkedIn 1\s*2/);
  });

  test("marcar como enviado trava o botão e grava uma vez só, mesmo com toque duplo", async ({
    page,
  }) => {
    await page.goto("/hoje");
    const tab = page.getByRole("tab", { name: /^WhatsApp 1/ });
    await tab.click();
    const botao = page.getByRole("button", { name: "Marcar como enviado" });
    await botao.dblclick();
    await expect(page.getByText("WhatsApp 1 registrada para Bruno Lima")).toBeVisible();
    await expect(page.getByText("Bruno Lima")).toHaveCount(0);
    await expect(tab).toHaveText(/WhatsApp 1\s*0/);
    const patches = (await mutations()).filter((m) => m.method === "PATCH");
    expect(patches).toHaveLength(1);
  });

  test("se a gravação falhar, o lead volta para a fila", async ({ page }) => {
    await page.route(`${MOCK}/rest/v1/contacts*`, (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({ status: 500, json: { message: "falha simulada" } })
        : route.continue(),
    );
    await page.goto("/hoje");
    await page.getByRole("tab", { name: /^WhatsApp 1/ }).click();
    await page.getByRole("button", { name: "Marcar como enviado" }).click();
    await expect(page.getByText("falha simulada")).toBeVisible();
    await expect(page.getByText("Bruno Lima")).toBeVisible();
    await expect(page.getByRole("button", { name: "Marcar como enviado" })).toBeEnabled();
  });

  test("com movimento reduzido, o cartão sai sem transição", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/hoje");
    await page.getByRole("tab", { name: /^WhatsApp 1/ }).click();
    const cartao = page.locator("[data-slot=queue-card]").first();
    const duracao = await cartao.evaluate((el) =>
      parseFloat(getComputedStyle(el).transitionDuration),
    );
    expect(duracao).toBeLessThan(0.001);
    await page.getByRole("button", { name: "Marcar como enviado" }).click();
    await expect(page.getByText("Bruno Lima")).toHaveCount(0);
  });
});
