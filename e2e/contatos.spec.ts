import { expect, mutations, seed, test, TODAY } from "./helpers";

test.describe("Contatos", () => {
  test("lista os contatos do hunter e busca sem acento", async ({ page }) => {
    await page.goto("/contatos");
    await expect(page.getByText("8 contatos", { exact: true })).toBeVisible();
    await page.getByPlaceholder("Buscar por nome ou empresa").fill("fabio");
    await expect(page.getByText("1 contato", { exact: true })).toBeVisible();
    await expect(page.locator("main tbody tr")).toHaveCount(1);
  });

  test("ação em lote registra o LinkedIn 1 dos selecionados", async ({ page }) => {
    await page.goto("/contatos");
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
    // A edição detalhada abre pelo botão de editar da linha.
    await page
      .locator("main tbody tr")
      .first()
      .getByRole("button", { name: /^Editar / })
      .click();
    const empresa = page.getByRole("dialog").getByPlaceholder("Empresa");
    await empresa.fill("Nova Empresa");
    await empresa.press("Enter");
    await expect.poll(async () => (await mutations()).length).toBe(1);
    expect(JSON.parse((await mutations())[0]!.body)).toEqual({ company: "Nova Empresa" });
  });

  test("filtra os contatos sem empresa ou sem área", async ({ page }) => {
    await page.goto("/contatos");
    const pend = page.getByRole("combobox", { name: "Pendências" });
    await pend.selectOption({ label: "Sem área" });
    await expect(page.getByText("3 contatos", { exact: true })).toBeVisible();
    await pend.selectOption({ label: "Sem empresa" });
    await expect(page.getByText("1 contato", { exact: true })).toBeVisible();
    await expect(page.locator("main tbody tr").first()).toContainText("Diretora de Operações");
  });

  test("filtra as respostas positivas e negativas", async ({ page }) => {
    await page.goto("/contatos");
    const resposta = page.getByRole("combobox", { name: "Resposta" });
    await resposta.selectOption({ label: "Positivas" });
    await expect(page.getByText("1 contato", { exact: true })).toBeVisible();
    await expect(page.locator("main tbody tr").first()).toContainText("Elisa Prado");
    await resposta.selectOption({ label: "Negativas" });
    await expect(page.getByText("0 contatos", { exact: true })).toBeVisible();
  });

  test("preenche empresa e área vazias a partir do headline", async ({ page }) => {
    await page.goto("/contatos");
    await page.getByRole("button", { name: "Preencher empresa e área (1)" }).click();
    await expect(page.getByText("1 com a empresa tirada do headline")).toBeVisible();
    await page.getByRole("button", { name: "Preencher", exact: true }).click();
    await expect(page.getByText("1 contatos completados")).toBeVisible();
    const [m] = await mutations();
    expect(m).toMatchObject({ method: "PATCH", table: "contacts" });
    expect(m!.query).toMatch(/id=in\./);
    expect(JSON.parse(m!.body)).toEqual({
      company: "Alfa",
      company_gender: "feminino",
      sector: "Operações",
    });
  });

  test("pagina listas grandes e o selecionar todos vale para o filtro inteiro", async ({
    page,
  }) => {
    await seed(60);
    await page.goto("/contatos");
    await expect(page.getByText("68 contatos", { exact: true })).toBeVisible();
    await expect(page.locator("main tbody tr")).toHaveCount(50);
    await expect(page.getByText("1–50 de 68 contatos")).toBeVisible();
    await page.getByRole("button", { name: "Próxima" }).click();
    await expect(page.locator("main tbody tr")).toHaveCount(18);
    await page.getByRole("checkbox", { name: /Selecionar todos os contatos do filtro/ }).click();
    await expect(page.getByText("68 selecionados")).toBeVisible();
  });

  test("descartar em lote pede confirmação", async ({ page }) => {
    await page.goto("/contatos");
    await page.locator("main tbody tr").first().getByRole("checkbox").first().click();
    await page.getByRole("button", { name: "Marcar como descartado" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Descartar 1 contato?");
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    expect(await mutations()).toEqual([]);

    await page.getByRole("button", { name: "Marcar como descartado" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Descartar" }).click();
    await expect(page.getByText("Contato descartado")).toBeVisible();
    const [m] = await mutations();
    expect(m).toMatchObject({ method: "PATCH", table: "contacts" });
    expect(JSON.parse(m!.body)).toEqual({ status: "descartado" });
  });

  test("marcar 'respondeu' pergunta a mensagem e se a resposta foi positiva ou negativa", async ({
    page,
  }) => {
    await page.goto("/contatos");
    await page.getByRole("button", { name: "Editar Bruno Lima" }).click();
    const editor = page.getByRole("dialog", { name: "Bruno Lima" });
    const responder = async () => {
      await editor.getByRole("combobox", { name: "Situação" }).click();
      await page.getByRole("option", { name: "Respondeu" }).click();
    };
    const origem = page.getByRole("dialog", { name: "Qual mensagem gerou a resposta?" });
    // Cancelar não grava a resposta.
    await responder();
    await origem.getByRole("button", { name: "Cancelar" }).click();
    await expect(origem).toBeHidden();
    expect(await mutations()).toEqual([]);
    await responder();
    await origem.getByLabel(/Outro canal/).check();
    // Sem dizer se foi positiva ou negativa, não salva.
    const salvar = origem.getByRole("button", { name: "Salvar" });
    await expect(salvar).toBeDisabled();
    await origem.getByLabel("Negativa").check();
    await salvar.click();
    await expect.poll(async () => (await mutations()).length).toBe(1);
    const [m] = await mutations();
    expect(JSON.parse(m!.body)).toEqual({
      status: "respondeu",
      resposta_etapa: 0,
      resposta_tipo: "negativa",
    });
  });

  test("a situação do contato não oferece 'descartado'", async ({ page }) => {
    await page.goto("/contatos");
    await page.getByRole("button", { name: "Editar Bruno Lima" }).click();
    await page
      .getByRole("dialog", { name: "Bruno Lima" })
      .getByRole("combobox", { name: "Situação" })
      .click();
    await expect(page.getByRole("option", { name: "Respondeu" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Descartado" })).toHaveCount(0);
  });

  test("desfazer uma etapa do funil pede confirmação", async ({ page }) => {
    await page.goto("/contatos");
    await page.getByRole("button", { name: "Editar Fábio Neves" }).click();
    await page
      .getByRole("dialog", { name: "Fábio Neves" })
      .getByRole("button", { name: "Avançar no funil" })
      .click();
    await page.getByRole("button", { name: "Desfazer Lead" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Desfazer Lead?");
    await dialog.getByRole("button", { name: "Desfazer" }).click();
    await expect.poll(async () => (await mutations()).length).toBe(1);
    const [m] = await mutations();
    expect(m).toMatchObject({ method: "PATCH", table: "contacts" });
    expect(JSON.parse(m!.body)).toMatchObject({ lead_em: null });
  });

  test("mostra a cadência em marcadores e o próximo envio, com atraso", async ({ page }) => {
    await page.goto("/contatos");
    const cabecalhos = page.locator("main thead th");
    await expect(cabecalhos).toHaveCount(9);
    const bruno = page.locator("main tbody tr", { hasText: "Bruno Lima" });
    // Bruno enviou o LinkedIn 1; o WhatsApp 1 estava previsto para 06/11 e atrasou.
    await expect(bruno.getByRole("img", { name: /^Cadência:/ })).toHaveAttribute(
      "aria-label",
      /LinkedIn 1 enviada, WhatsApp 1 atrasada, LinkedIn 2 a enviar/,
    );
    await expect(bruno).toContainText("06/11atrasado");
    await expect(bruno).toContainText("WhatsApp 1");
  });

  test("o editor marca uma etapa como enviada", async ({ page }) => {
    await page.goto("/contatos");
    await page.getByRole("button", { name: "Editar Bruno Lima" }).click();
    await page
      .getByRole("dialog", { name: "Bruno Lima" })
      .getByRole("checkbox", { name: "WhatsApp 1 enviada" })
      // click, e não check: o estado vem da atualização otimista, um instante depois do clique.
      .click();
    await expect.poll(async () => (await mutations()).length).toBe(1);
    expect(JSON.parse((await mutations())[0]!.body)).toMatchObject({ sent2_at: TODAY });
    await expect(page.getByRole("checkbox", { name: "WhatsApp 1 enviada" })).toBeChecked();
  });

  test("adiciona um contato com AT marcada por e-mail", async ({ page }) => {
    await page.goto("/contatos");
    await page.getByRole("button", { name: "Adicionar contato" }).click();
    const dialog = page.getByRole("dialog", { name: "Adicionar contato" });
    const registrar = dialog.getByRole("button", { name: "Registrar AT" });
    await expect(registrar).toBeDisabled();
    await dialog.getByLabel("Nome *").fill("bruno lima");
    await expect(dialog.getByRole("alert")).toContainText("Já existe um contato com esse nome");
    await dialog.getByLabel("Nome *").fill("Marina Prado");
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await dialog.getByLabel("Cargo na empresa").fill("Diretora");
    await dialog.getByPlaceholder("Nome da empresa").fill("Zeta");
    await dialog.getByLabel("Data da AT *").fill("2026-11-18");
    await registrar.click();
    await expect(page.getByText("AT registrada para Marina Prado")).toBeVisible();
    const [m] = await mutations();
    expect(m).toMatchObject({ method: "POST", table: "contacts" });
    expect(JSON.parse(m!.body)).toMatchObject({
      name: "Marina Prado",
      company: "Zeta",
      status: "respondeu",
      at_marcada_em: "2026-11-18",
      resposta_etapa: 0,
    });
  });

  test("a linha mostra a persona sugerida pelo cargo, com o motivo no title", async ({ page }) => {
    await page.goto("/contatos");
    const diego = page.locator("main tbody tr", { hasText: "Diego Rocha" });
    const persona = diego.getByRole("combobox", { name: "Persona (sugerida)" });
    await expect(persona.locator("option:checked")).toHaveText("Patrocinador Executivo");
    await expect(persona).toHaveAttribute(
      "title",
      "Sugerida pelo cargo: Patrocinador Executivo. Escolha para confirmar.",
    );
    await expect(persona).toHaveClass(/border-dashed/);
    await expect(persona.locator("option", { hasText: "Owner d" })).toHaveCount(0);
    // A sugestão não se repete na lista aberta: a opção "" fica escondida.
    await expect(persona.locator('option[value=""]')).toHaveAttribute("hidden", "");
  });

  test("trocar a persona na linha grava a escolhida", async ({ page }) => {
    await page.goto("/contatos");
    const diego = page.locator("main tbody tr", { hasText: "Diego Rocha" });
    await diego
      .getByRole("combobox", { name: "Persona (sugerida)" })
      .selectOption({ label: "Tecnologia" });
    await expect.poll(async () => (await mutations()).length).toBe(1);
    expect(JSON.parse((await mutations())[0]!.body)).toEqual({ persona: "owner_tecnologia" });
    expect((await mutations())[0]!.query).toMatch(/id=eq\./);
  });

  test("escolher a persona sugerida na linha dispara a gravação", async ({ page }) => {
    await page.goto("/contatos");
    const diego = page.locator("main tbody tr", { hasText: "Diego Rocha" });
    // A opção "sugerida" tem valor vazio e a persona real é outra opção, com o mesmo rótulo.
    await diego
      .getByRole("combobox", { name: "Persona (sugerida)" })
      .selectOption("patrocinador_executivo");
    await expect.poll(async () => (await mutations()).length).toBe(1);
    expect(JSON.parse((await mutations())[0]!.body)).toEqual({
      persona: "patrocinador_executivo",
    });
  });

  test("contato com persona gravada não aparece como sugerido", async ({ page }) => {
    await page.goto("/contatos");
    const hugo = page.locator("main tbody tr", { hasText: "Hugo Melo" });
    const persona = hugo.getByRole("combobox", { name: "Persona", exact: true });
    await expect(persona).toHaveValue("owner_processo");
    await expect(persona.locator("option:checked")).toHaveText("Processo");
    await expect(persona).toHaveAttribute("title", "Owner do Processo");
    await expect(persona).not.toHaveClass(/border-dashed/);
    await expect(hugo.getByRole("combobox", { name: "Persona (sugerida)" })).toHaveCount(0);
  });

  test("a edição do contato mostra o selo 'sugerida' e grava a persona", async ({ page }) => {
    await page.goto("/contatos");
    await page
      .locator("main tbody tr", { hasText: "Diego Rocha" })
      .getByRole("button", { name: /^Editar / })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("sugerida", { exact: true })).toBeVisible();
    const persona = dialog.getByRole("combobox", { name: "Persona", exact: true });
    await expect(persona.locator("option:checked")).toHaveText("Sugerida: Patrocinador Executivo");
    await persona.selectOption({ label: "Owner da Operação" });
    await expect.poll(async () => (await mutations()).length).toBe(1);
    expect(JSON.parse((await mutations())[0]!.body)).toEqual({ persona: "owner_operacao" });
  });
});
