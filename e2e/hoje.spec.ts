import { expect, MOCK, mutations, seedHackathon, test, TODAY } from "./helpers";

test.describe("Envios de hoje", () => {
  test("monta uma fila por etapa, com atrasados destacados", async ({ page }) => {
    await page.goto("/hoje");
    const tab = (name: string) => page.getByRole("tab", { name: new RegExp(`^${name}`) });
    await expect(tab("LinkedIn 1")).toHaveText(/LinkedIn 1\s*2/);
    await expect(tab("WhatsApp 1")).toHaveText(/WhatsApp 1\s*1/);
    // Bruno atrasou o WhatsApp 1: as etapas seguintes só aparecem depois desse envio.
    await expect(tab("LinkedIn 2")).toHaveText(/LinkedIn 2\s*0/);
    await expect(tab("WhatsApp 2")).toHaveText(/WhatsApp 2\s*1/);
    await expect(tab("LinkedIn 3")).toHaveText(/LinkedIn 3\s*0/);

    await tab("WhatsApp 1").click();
    await expect(page.getByText("Bruno Lima")).toBeVisible();
    await expect(page.getByText("Atrasado · previsto 06/11")).toBeVisible();
  });

  test("edita o contato pelo cartão e marca quem não tem WhatsApp", async ({ page }) => {
    await page.goto("/hoje");
    await page.getByRole("tab", { name: /^WhatsApp 1/ }).click();
    await page.getByRole("button", { name: "Editar Bruno Lima" }).click();
    const dialog = page.getByRole("dialog", { name: "Bruno Lima" });
    await dialog.getByRole("checkbox", { name: "Sem WhatsApp" }).click();
    await expect.poll(async () => (await mutations()).length).toBe(1);
    expect(JSON.parse((await mutations())[0]!.body)).toMatchObject({ sem_whatsapp: true });
    await dialog.getByRole("button", { name: "Close" }).click();
    // Sai das filas de WhatsApp e não aparece mais como pendência.
    await expect(page.getByText("Bruno Lima")).toHaveCount(0);
    await expect(page.getByRole("tab", { name: /^WhatsApp 1/ })).toHaveText(/WhatsApp 1\s*0/);
  });

  test("contatos do Hackathon saem das filas e podem ser exibidos", async ({ page }) => {
    await seedHackathon();
    await page.goto("/hoje");
    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    await expect(nav.getByRole("link", { name: /Envios de hoje/ })).toContainText("4");
    const linkedin1 = page.getByRole("tab", { name: /^LinkedIn 1/ });
    await expect(linkedin1).toHaveText(/LinkedIn 1\s*2/);
    await expect(page.getByText("Hugo Hacka")).toHaveCount(0);
    await expect(page.getByText("1 contato do Hackathon está fora das filas.")).toBeVisible();

    await page.getByRole("button", { name: "Mostrar contatos do Hackathon" }).click();
    await expect(page.getByText("Mostrando também 1 contato do Hackathon.")).toBeVisible();
    await expect(linkedin1).toHaveText(/LinkedIn 1\s*3/);
    await expect(page.getByText("Hugo Hacka")).toBeVisible();
    await expect(
      page.getByRole("article", { name: "Hugo Hacka" }).getByText("Hackathon"),
    ).toBeVisible();

    await page.getByRole("button", { name: "Ocultar contatos do Hackathon" }).click();
    await expect(linkedin1).toHaveText(/LinkedIn 1\s*2/);
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

  test("o cartão mostra a persona sugerida pelo cargo e a mensagem da persona", async ({
    page,
  }) => {
    await page.goto("/hoje");
    await page.getByRole("tab", { name: /^WhatsApp 2/ }).click();
    const card = page.getByRole("article", { name: "Diego Rocha" });
    await expect(card.getByText("Patrocinador Executivo")).toBeVisible();
    await expect(card.getByText("sugerida", { exact: true })).toBeVisible();
    // Setor da empresa, código com a origem do modelo e a persona usada.
    await expect(card.getByText("Varejo", { exact: true })).toBeVisible();
    const codigo = card.getByText("VAR4PE", { exact: true });
    await expect(codigo).toHaveAttribute("title", "Varejo · Patrocinador Executivo");
    await card.getByRole("button", { name: "Copiar mensagem" }).click();
    await expect(page.getByText("Mensagem copiada")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "Oi, Diego! Conversa de patrocinador na Delta.",
    );
  });

  test("o código do modelo padrão diz a origem no title", async ({ page }) => {
    await page.goto("/hoje");
    await page.getByRole("tab", { name: /^WhatsApp 1/ }).click();
    const card = page.getByRole("article", { name: "Bruno Lima" });
    await expect(card.getByText("M2", { exact: true })).toHaveAttribute(
      "title",
      "Modelo padrão da equipe",
    );
    await expect(card.getByText("Owner da Tecnologia")).toBeVisible();
  });

  test("empresa com subsetor mostra setor › subsetor e a cadência do subsetor", async ({
    page,
  }) => {
    await page.goto("/hoje");
    const card = page.getByRole("article", { name: "Carla Dias" });
    await expect(card.getByText("Indústria › Metalurgia", { exact: true })).toBeVisible();
    await expect(card.getByText("MET1", { exact: true })).toHaveAttribute(
      "title",
      "Indústria › Metalurgia · qualquer persona",
    );
    await expect(card.getByText("cadência do setor")).toBeVisible();
    await card.getByRole("button", { name: "Copiar mensagem" }).click();
    await expect(page.getByText("Mensagem copiada")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "Olá, Carla! Metalurgia 1 na Ômicron.",
    );
  });

  test("persona sugerida aparece com selo e escolher uma persona grava no contato", async ({
    page,
  }) => {
    await page.goto("/hoje");
    const card = page.getByRole("article", { name: "Ana Souza" });
    await card.getByRole("button", { name: "Completar dados" }).click();
    const persona = card.getByRole("combobox", { name: "Persona" });
    await expect(persona).toHaveValue("");
    await expect(persona.locator("option").first()).toHaveText("Sugerida: Patrocinador Executivo");
    // Um selo na meta-linha do cartão e outro ao lado do seletor.
    await expect(card.getByText("sugerida", { exact: true })).toHaveCount(2);
    expect(await mutations()).toEqual([]);

    await persona.selectOption({ label: "Owner da Tecnologia" });
    await expect.poll(async () => (await mutations()).length).toBe(1);
    const [m] = await mutations();
    expect(m).toMatchObject({ method: "PATCH", table: "contacts" });
    expect(JSON.parse(m!.body)).toEqual({ persona: "owner_tecnologia" });
  });

  test("escolher a persona sugerida na lista também grava (confirma a sugestão)", async ({
    page,
  }) => {
    await page.goto("/hoje");
    const card = page.getByRole("article", { name: "Ana Souza" });
    await card.getByRole("button", { name: "Completar dados" }).click();
    await card
      .getByRole("combobox", { name: "Persona" })
      .selectOption({ label: "Patrocinador Executivo" });
    await expect.poll(async () => (await mutations()).length).toBe(1);
    const [m] = await mutations();
    expect(JSON.parse(m!.body)).toEqual({ persona: "patrocinador_executivo" });
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

  test("a barra de progresso conta o envio e a fila vazia mostra Fila em dia", async ({ page }) => {
    await page.goto("/hoje");
    const barra = page.getByRole("region", { name: "Progresso do dia" });
    await expect(barra).toContainText(/\d+ de \d+ envios feitos/);
    const texto = (await barra.getByText(/envios feitos/).textContent()) ?? "";
    const [, feitos, total] = /(\d+) de (\d+)/.exec(texto)!;
    await page.getByRole("tab", { name: /^WhatsApp 1/ }).click();
    await page.getByRole("button", { name: "Marcar como enviado" }).click();
    await expect(barra).toContainText(`${Number(feitos) + 1} de ${total} envios feitos`);
    await expect(page.getByText("Fila em dia")).toBeVisible();
    await expect(page.getByText("Nada na fila de WhatsApp 1 para esta data.")).toBeVisible();
  });

  test("os campos do lead ficam recolhidos até faltar dado para a mensagem", async ({ page }) => {
    await page.goto("/hoje");
    const cartao = page.getByRole("article", { name: "Ana Souza" });
    await expect(cartao.getByText(/A mensagem usa empresa, área e cargo/)).toBeVisible();
    await expect(cartao.getByLabel("Cargo na empresa")).toHaveCount(0);
    await cartao.getByRole("button", { name: "Completar dados" }).click();
    await expect(cartao.getByLabel("Cargo na empresa")).toBeVisible();
    // Lead com todos os dados não mostra a faixa.
    await page.getByRole("tab", { name: /^WhatsApp 1/ }).click();
    await expect(page.getByRole("button", { name: "Completar dados" })).toHaveCount(0);
  });

  test("a aba Retomadas mostra as do dia e registra a retomada", async ({ page }) => {
    await page.goto("/hoje");
    // Só a Elisa: combinada para 10/11 (atrasada); a da Gabi é só em 20/11.
    const aba = page.getByRole("tab", { name: /^Retomadas/ });
    await expect(aba).toContainText("1");
    await aba.click();
    const card = page.getByRole("article", { name: "Retomada de Elisa Prado" });
    await expect(card).toContainText("Retomar: atrasada 2 dias");
    await expect(card).toContainText("Combinado para 10/11/2026");
    await expect(card).toContainText("Pediu para falar depois da auditoria");
    await expect(page.getByRole("article", { name: /Gabi Torres/ })).toHaveCount(0);

    await card.getByRole("button", { name: "Retomei o contato" }).click();
    await expect(page.getByText("Retomada registrada")).toBeVisible();
    const [m] = await mutations();
    expect(m).toMatchObject({ method: "PATCH", table: "contacts" });
    expect(Object.keys(JSON.parse(m!.body))).toEqual(["retomado_em"]);
  });

  test("trocar a data tira a retomada da fila de hoje", async ({ page }) => {
    await page.goto("/hoje");
    await page.getByRole("tab", { name: /^Retomadas/ }).click();
    const card = page.getByRole("article", { name: "Retomada de Elisa Prado" });
    await card.getByRole("button", { name: "Trocar a data" }).click();
    const dialog = page.getByRole("dialog", { name: /Trocar a data da retomada: Elisa Prado/ });
    // Data já passou: o campo começa vazio e o motivo vem preenchido.
    await expect(dialog.getByLabel("Quando retomar o contato?")).toHaveValue("");
    await expect(dialog.getByLabel("O que o prospect disse (opcional)")).toHaveValue(
      "Pediu para falar depois da auditoria",
    );
    await dialog.getByRole("button", { name: "Em 2 semanas" }).click();
    await dialog.getByRole("button", { name: "Trocar a data" }).click();
    await expect(page.getByText("Data da retomada trocada")).toBeVisible();
    const [m] = await mutations();
    expect(JSON.parse(m!.body)).toEqual({
      retomar_em: "2026-11-26",
      retomar_motivo: "Pediu para falar depois da auditoria",
    });
    await expect(card).toHaveCount(0);
    await expect(page.getByText("Nenhuma retomada para hoje")).toBeVisible();
  });

  test("desmarcar tira a retomada da fila", async ({ page }) => {
    await page.goto("/hoje");
    await page.getByRole("tab", { name: /^Retomadas/ }).click();
    const card = page.getByRole("article", { name: "Retomada de Elisa Prado" });
    await card.getByRole("button", { name: "Desmarcar" }).click();
    await expect(page.getByText("Retomada desmarcada")).toBeVisible();
    const [m] = await mutations();
    expect(JSON.parse(m!.body)).toEqual({ retomar_em: null });
    await expect(card).toHaveCount(0);
  });
});
