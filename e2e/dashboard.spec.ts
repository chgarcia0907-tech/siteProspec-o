import { expect, mutations, seedHackathon, test } from "./helpers";

const U2 = "22222222-2222-4222-8222-222222222222";
const GOAL_EQUIPE = "14141414-0000-4000-8000-000000000001";

// Hoje é 12/11/2026 (quinta). Na semana de 09 a 15/11 ninguém enviou mensagem; a única AT
// registrada é a do João (Hunter Dois, depois do WhatsApp 1). Bruno, Diego e Karen estão atrasados.
test.describe("Dashboard", () => {
  test("o endereço antigo da aba do painel leva à Dashboard", async ({ page }) => {
    await page.goto("/painel?aba=indicadores");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
  });

  test("o endereço antigo dos Indicadores leva à Dashboard com os filtros", async ({ page }) => {
    await page.goto("/dashboard?intervalo=semana_passada");
    await expect(page).toHaveURL(/\/dashboard\?intervalo=semana_passada$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
  });

  test("abre na semana atual com os números da equipe", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
    const tile = (name: string) => page.getByRole("group", { name, exact: true });
    await expect(tile("ATs marcadas")).toContainText("1");
    await expect(tile("ATs marcadas")).toContainText("antes: 2");
    await expect(tile("Mensagens enviadas")).toContainText("antes: 8");
    await expect(tile("Envios atrasados agora")).toContainText("3");
    await expect(tile("Hunters parados (2+ dias úteis)")).toContainText("2");
    await expect(page.getByText("Hunter Dois: sem envio há 6 dias úteis")).toBeVisible();
    await expect(page.getByText("09/11/2026 a 15/11/2026 · comparado com")).toBeVisible();
  });

  test("card do Hackathon avançado agora não conta nos números do ciclo", async ({ page }) => {
    // Um card do Hackathon (encerrado) ganhou AT hoje: a AT dele não pode entrar no ciclo atual.
    await seedHackathon(true);
    await page.goto("/dashboard");
    const ats = page.getByRole("group", { name: "ATs marcadas", exact: true });
    // Sem o Hackathon o valor é 1 (a AT do João); com a AT do card dele seria 2.
    await expect(ats).toContainText(/ATs marcadas\s*1(?!\d)/);
  });

  test("lista os atrasados do hunter e a etapa que gerou a AT", async ({ page }) => {
    await page.goto("/dashboard");
    await page
      .getByRole("region", { name: "Execução da cadência por hunter" })
      .getByRole("button", { name: "Hunter Dois" })
      .click();
    const late = page.getByRole("row", { name: /^Karen Luz/ });
    await expect(late).toContainText("WhatsApp 1");
    await expect(late).toContainText("5 d úteis");
    // A origem fica na aba "Origem" do Detalhamento.
    await page.getByRole("tab", { name: "Origem" }).click();
    const origem = page.getByRole("region", { name: "Etapa que gerou a AT" });
    await expect(origem.locator("li", { hasText: "WhatsApp 1" })).toContainText("(100%)");
    // A AT do João veio do WhatsApp 1: canal de entrada WhatsApp.
    const canal = page.getByRole("region", { name: "Canal de entrada" });
    await expect(canal.getByRole("row", { name: /^WhatsApp/ })).toContainText("1 (100%)");
    await expect(page.getByRole("region", { name: "Mensagens que geram reunião" })).toBeVisible();
  });

  test("filtros de intervalo e de grupo recalculam os números", async ({ page }) => {
    await page.goto("/dashboard");
    const tile = (name: string) => page.getByRole("group", { name, exact: true });
    await page.getByRole("button", { name: "Semana passada" }).click();
    await expect(page.getByText("02/11/2026 a 08/11/2026 · comparado com")).toBeVisible();
    await expect(tile("Mensagens enviadas")).toContainText("8");
    await expect(tile("ATs marcadas")).toContainText("2");
    // Squad Azul tem só o Hunter Um: 4 envios dele na semana passada.
    await page
      .getByRole("combobox", { name: "Grupo", exact: true })
      .selectOption({ label: "Squad Azul" });
    await expect(tile("Mensagens enviadas")).toContainText("4");
    await expect(page.getByRole("button", { name: "Hunter Dois" })).toHaveCount(0);
  });

  test("respostas e metas com semáforo", async ({ page }) => {
    await page.goto("/dashboard");
    // A AT do João conta como resposta nesta semana; Elisa e Iara responderam na anterior.
    await expect(page.getByRole("group", { name: "Respostas", exact: true })).toContainText(
      "antes: 2",
    );
    // Seg a qui = 4 dias úteis: meta de 5 mensagens/dia vira 20 e 1 AT/semana vira 0,8.
    const metas = page.getByRole("region", { name: "Metas" });
    await expect(metas).toContainText("4 dias úteis do intervalo");
    const um = metas.getByRole("row", { name: /^Hunter Um/ });
    await expect(um).toContainText("0 / 20");
    await expect(um).toContainText("Abaixo");
    // A equipe do ciclo ativo tem 2 membros (Hunter Um e Hunter Dois; "Sem Contatos" não é
    // membro), então a meta da equipe é 2 × 0,8 = 1,6 ATs.
    await expect(metas.getByRole("row", { name: /^Equipe/ })).toContainText("1 / 1,6");
    await expect(
      page.getByText("Hunter Um: abaixo da meta de mensagens: 0 de 20 (0%)"),
    ).toBeVisible();
  });

  test("a lista de alertas mostra os 5 mais urgentes e abre o resto sob demanda", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    const alertas = page.getByRole("region", { name: /^Quem precisa de ajuda/ });
    await expect(alertas.getByRole("listitem")).toHaveCount(5);
    await expect(alertas.getByText(/setor Varejo/)).toHaveCount(0);
    // Entre eles está "setor Indústria: cadência sem mensagem própria", o único falso positivo
    // conhecido: o alerta olha só o setor, não a cadência do subsetor (a Ômicron tem a Carla Dias).
    await alertas.getByRole("button", { name: "Ver todos os 8" }).click();
    await expect(alertas.getByRole("listitem")).toHaveCount(8);
    await expect(alertas.getByText(/setor Varejo/)).toBeVisible();
    await alertas.getByRole("button", { name: "Mostrar só os mais urgentes" }).click();
    await expect(alertas.getByRole("listitem")).toHaveCount(5);
  });

  test("editor de metas grava a meta da equipe e a exceção de um hunter", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Configurar metas" }).click();
    const equipe = page.getByRole("group", { name: "Metas: Equipe (padrão)" });
    const ats = equipe.getByLabel("ATs por semana (Equipe (padrão))");
    await expect(ats).toHaveValue("1");
    await ats.fill("1,5");
    await equipe.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Meta salva")).toBeVisible();
    let [m] = await mutations();
    expect(m).toMatchObject({ method: "PATCH", table: "goals" });
    expect(m!.query).toContain(GOAL_EQUIPE);
    expect(JSON.parse(m!.body)).toEqual({
      envios_dia: 5,
      l1_semana: null,
      ats_semana: 1.5,
      no_prazo_pct: 80,
    });

    await page
      .getByRole("combobox", { name: "Adicionar meta de um hunter" })
      .selectOption({ label: "Hunter Dois" });
    const dois = page.getByRole("group", { name: "Metas: Hunter Dois" });
    await expect(dois.getByLabel("ATs por semana (Hunter Dois)")).toHaveAttribute(
      "placeholder",
      // Herda a meta da equipe que acabou de ser salva (1,5), não a original.
      "herda: 1,5",
    );
    await dois.getByLabel("ATs por semana (Hunter Dois)").fill("2");
    await dois.getByRole("button", { name: "Salvar" }).click();
    await expect.poll(async () => (await mutations()).length).toBe(2);
    m = (await mutations())[1];
    expect(m).toMatchObject({ method: "POST", table: "goals" });
    expect(JSON.parse(m!.body)).toEqual({
      envios_dia: null,
      l1_semana: null,
      ats_semana: 2,
      no_prazo_pct: null,
      user_id: U2,
      group_id: null,
    });
  });

  test("responde primeiro se a equipe está no ritmo e deixa o detalhe em abas", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "A equipe está no ritmo desta semana?" }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: /^Quem precisa de ajuda/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Metas da semana" })).toBeVisible();
    // Cada aba do Detalhamento mostra o seu bloco.
    const abas: [string, string | RegExp][] = [
      ["Execução por hunter", "Execução da cadência por hunter"],
      ["Envios por dia", /^Envios por (dia|semana)/],
      ["Ritmo", "Ritmo entre etapas"],
      ["Funil", "Funil no intervalo"],
      ["Origem", "Canal de entrada"],
      ["Conversão", "Conversão por setor da empresa"],
      ["Tendência", "Tendência das últimas 12 semanas"],
      ["Abastecimento", "Abastecimento e qualidade dos dados"],
    ];
    for (const [aba, bloco] of abas) {
      await page.getByRole("tab", { name: aba, exact: true }).click();
      await expect(page.getByRole("region", { name: bloco })).toBeVisible();
    }
    // Fora da semana atual, a pergunta e as metas deixam de falar em "semana".
    await page.getByRole("button", { name: "Últimos 30 dias" }).click();
    await expect(page.getByRole("heading", { name: "A equipe está no ritmo?" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Metas do intervalo" })).toBeVisible();
  });

  test("a execução por hunter mostra a coluna de conexões", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("tab", { name: "Execução por hunter", exact: true }).click();
    const bloco = page.getByRole("region", { name: "Execução da cadência por hunter" });
    await expect(bloco.getByRole("columnheader", { name: /Conexões/ })).toBeVisible();
    // Um clique ordena pela coluna.
    await bloco.getByRole("button", { name: "Conexões" }).click();
    await expect(bloco.getByRole("button", { name: /Conexões/ })).toContainText("↓");
  });

  test("filtros e aba ficam na url e voltam ao recarregar", async ({ page }) => {
    await page.goto(
      "/dashboard?intervalo=semana_passada&grupo=bbbbbbbb-0000-4000-8000-000000000001",
    );
    await expect(page.getByText("02/11/2026 a 08/11/2026 · comparado com")).toBeVisible();
    const tile = (name: string) => page.getByRole("group", { name, exact: true });
    await expect(tile("Mensagens enviadas")).toContainText("4");
    await expect(page.getByRole("combobox", { name: "Grupo", exact: true })).toHaveValue(
      "bbbbbbbb-0000-4000-8000-000000000001",
    );
    await page.getByRole("button", { name: "Esta semana" }).click();
    await expect(page).not.toHaveURL(/intervalo=/);
    await page.getByRole("button", { name: "Semana passada" }).click();
    await expect(page).toHaveURL(/intervalo=semana_passada/);
    await expect(page).not.toHaveURL(/periodo=/);
    await page.reload();
    await expect(page.getByText("02/11/2026 a 08/11/2026 · comparado com")).toBeVisible();
  });

  test("voltar a todos os grupos tira o grupo da url", async ({ page }) => {
    await page.goto("/dashboard");
    const grupo = page.getByRole("combobox", { name: "Grupo", exact: true });
    await grupo.selectOption({ label: "Squad Azul" });
    await expect(page).toHaveURL(/grupo=bbbbbbbb/);
    await grupo.selectOption({ label: "Todos os grupos" });
    await expect(page).not.toHaveURL(/grupo=/);
  });

  test("a aba do detalhamento fica na url", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("tab", { name: "Funil", exact: true }).click();
    await expect(page).toHaveURL(/detalhe=funil/);
    await page.getByRole("tab", { name: "Execução por hunter", exact: true }).click();
    await expect(page).not.toHaveURL(/detalhe=/);
    await page.goto("/dashboard?detalhe=origem");
    await expect(page.getByRole("region", { name: "Canal de entrada" })).toBeVisible();
  });

  test("trocar a aba com a página rolada não volta ao topo", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("tab", { name: "Funil", exact: true })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.getByRole("tab", { name: "Funil", exact: true }).click();
    await expect(page).toHaveURL(/detalhe=funil/);
    await expect(page.getByRole("region", { name: "Funil no intervalo" })).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  test("url inválida cai no padrão sem erro", async ({ page }) => {
    await page.goto(
      "/dashboard?intervalo=xyz&grupo=nao-e-uuid&de=2026-11-20&ate=2026-11-01&canal=email",
    );
    await expect(page.getByText("09/11/2026 a 15/11/2026 · comparado com")).toBeVisible();
    await expect(page.getByText("Não foi possível carregar os indicadores.")).toHaveCount(0);
  });

  test("a tela padrão não escreve nada na url", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("group", { name: "ATs marcadas", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("o cartão de filtros resume o recorte e limpa os filtros", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("group", { name: "ATs marcadas", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Limpar filtros" })).toHaveCount(0);
    await page.goto("/dashboard?grupo=bbbbbbbb-0000-4000-8000-000000000001");
    const chips = page.getByRole("list", { name: "Filtros aplicados" });
    await expect(chips).toContainText("Esta semana");
    await expect(chips).toContainText("Squad Azul");
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("button", { name: "Limpar filtros" })).toHaveCount(0);
  });

  test("a barra compacta aparece ao rolar e leva de volta aos filtros", async ({ page }) => {
    await page.goto("/dashboard?intervalo=semana_passada");
    const barra = page.getByRole("region", { name: "Filtros ativos" });
    await expect(page.getByText("02/11/2026 a 08/11/2026 · comparado com")).toBeVisible();
    await expect(barra).toBeHidden();
    await page
      .getByRole("region", { name: "Execução da cadência por hunter" })
      .scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(barra).toBeVisible();
    await expect(barra).toContainText("Semana passada");
    await barra.getByRole("button", { name: "Editar filtros" }).click();
    await expect(page.getByRole("button", { name: "Semana passada", exact: true })).toBeFocused();
    await expect(barra).toBeHidden();
  });

  test("Limpar filtros da barra compacta volta ao padrão", async ({ page }) => {
    await page.goto("/dashboard?intervalo=semana_passada");
    await expect(page.getByText("02/11/2026 a 08/11/2026 · comparado com")).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const barra = page.getByRole("region", { name: "Filtros ativos" });
    await barra.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("09/11/2026 a 15/11/2026 · comparado com")).toBeVisible();
  });

  test("o nome do hunter no alerta leva à Execução com o hunter aberto", async ({ page }) => {
    await page.goto("/dashboard?detalhe=funil");
    const alertas = page.getByRole("region", { name: /^Quem precisa de ajuda/ });
    await alertas.getByRole("link", { name: "Hunter Dois" }).first().click();
    await expect(page).toHaveURL(/aberto=22222222-/);
    await expect(page).not.toHaveURL(/detalhe=/);
    const exec = page.getByRole("region", { name: "Execução da cadência por hunter" });
    await expect(exec).toBeInViewport();
    await expect(exec.getByRole("row", { name: /^Karen Luz/ })).toBeVisible();
    const botao = exec.getByRole("button", { name: "Hunter Dois" });
    await expect(botao).toHaveAttribute("aria-expanded", "true");
    await expect(botao).toBeFocused();
    // Voltar desfaz o atalho: a linha recolhe.
    await page.goBack();
    await expect(page).not.toHaveURL(/aberto=/);
    await expect(page.getByRole("tab", { name: "Funil", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("abrir e fechar um hunter pela tabela não rola a página nem põe âncora na url", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    const exec = page.getByRole("region", { name: "Execução da cadência por hunter" });
    await expect(exec).toBeVisible();
    await exec.scrollIntoViewIfNeeded();
    const y = await page.evaluate(() => window.scrollY);
    await exec.getByRole("button", { name: "Hunter Dois" }).click();
    await expect(exec.getByRole("row", { name: /^Karen Luz/ })).toBeVisible();
    await expect(page).toHaveURL(/aberto=22222222-/);
    await expect(page).not.toHaveURL(/#/);
    expect(await page.evaluate(() => window.scrollY)).toBe(y);
    await exec.getByRole("button", { name: "Hunter Dois" }).click();
    await expect(page).not.toHaveURL(/aberto=/);
  });

  test("os KPIs de atrasados e parados levam à Execução ordenada", async ({ page }) => {
    await page.goto("/dashboard");
    const exec = page.getByRole("region", { name: "Execução da cadência por hunter" });
    await page
      .getByRole("group", { name: "Envios atrasados agora", exact: true })
      .getByRole("link", { name: "Ver por hunter" })
      .click();
    await expect(page).toHaveURL(/ordem=late/);
    await expect(exec).toBeInViewport();
    await expect(exec.getByRole("columnheader", { name: /Atrasados/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    await expect(exec.getByRole("button", { name: /Atrasados/ })).toContainText("↓");
    // Hunter Um tem 2 atrasados e Hunter Dois 1: a primeira linha prova a ordenação.
    await expect(exec.locator("tbody tr").first()).toContainText("Hunter Um");
    await exec.getByRole("button", { name: /Atrasados/ }).click();
    await expect(exec.locator("tbody tr").first()).toContainText("Hunter Dois");
    await page
      .getByRole("group", { name: "Hunters parados (2+ dias úteis)", exact: true })
      .getByRole("link", { name: "Ver por hunter" })
      .click();
    await expect(page).toHaveURL(/ordem=idle/);
    await expect(exec.getByRole("button", { name: /Último envio/ })).toContainText("↓");
    // Hunter Dois está parado há 6 dias úteis e Hunter Um há 5.
    await expect(exec.locator("tbody tr").first()).toContainText("Hunter Dois");
    await expect(exec).toBeInViewport();
  });

  test("sem atrasados o KPI não oferece o atalho Ver por hunter", async ({ page }) => {
    await page.goto("/dashboard?hunter=11111111-1111-4111-8111-111111111111&canal=linkedin");
    const kpi = page.getByRole("group", { name: "Envios atrasados agora", exact: true });
    await expect(kpi).toContainText("0");
    await expect(kpi.getByRole("link", { name: "Ver por hunter" })).toHaveCount(0);
  });

  test("a ordenação da Execução fica na url e sobrevive à troca de aba", async ({ page }) => {
    await page.goto("/dashboard");
    const exec = page.getByRole("region", { name: "Execução da cadência por hunter" });
    await exec.getByRole("button", { name: "Atrasados" }).click();
    await expect(page).toHaveURL(/ordem=late/);
    await expect(page).not.toHaveURL(/sentido=/);
    await exec.getByRole("button", { name: /Atrasados/ }).click();
    await expect(page).toHaveURL(/sentido=asc/);
    await page.getByRole("tab", { name: "Funil", exact: true }).click();
    await page.getByRole("tab", { name: "Execução por hunter", exact: true }).click();
    await expect(exec.getByRole("button", { name: /Atrasados/ })).toContainText("↑");
  });

  test("a ordenação com a página rolada não volta ao topo", async ({ page }) => {
    await page.goto("/dashboard");
    const exec = page.getByRole("region", { name: "Execução da cadência por hunter" });
    await exec.scrollIntoViewIfNeeded();
    await exec.getByRole("button", { name: "Atrasados" }).click();
    await expect(page).toHaveURL(/ordem=late/);
    await expect(exec).toBeInViewport();
  });

  test("hunter aberto fora do recorte não quebra a tela", async ({ page }) => {
    await page.goto("/dashboard?aberto=33333333-3333-4333-8333-333333333333");
    const exec = page.getByRole("region", { name: "Execução da cadência por hunter" });
    await expect(exec).toBeVisible();
    await expect(exec.locator('button[aria-expanded="true"]')).toHaveCount(0);
  });

  test("o KPI de ATs mostra a meta da equipe com o mesmo semáforo de Metas", async ({ page }) => {
    await page.goto("/dashboard");
    const ats = page.getByRole("group", { name: "ATs marcadas", exact: true });
    // A equipe tem 1 AT para a meta de 1,6 (2 membros × 0,8): 63% e "Abaixo".
    await expect(ats).toContainText("meta 1,6 · 63%");
    await expect(ats).toContainText("Abaixo");
    const metas = page.getByRole("region", { name: "Metas da semana" });
    const equipe = metas.getByRole("row", { name: /^Equipe/ });
    await expect(equipe).toContainText("1 / 1,6");
    await expect(equipe).toContainText("Abaixo");
  });

  test("sem dia útil até hoje o KPI de ATs não mostra meta", async ({ page }) => {
    await page.goto("/dashboard?intervalo=livre&de=2026-11-16&ate=2026-11-20");
    const ats = page.getByRole("group", { name: "ATs marcadas", exact: true });
    await expect(ats).toBeVisible();
    await expect(ats).not.toContainText("meta");
  });
});

test.describe("Dashboard em 1280 px", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("alertas e metas ocupam a largura toda, um abaixo do outro, sem rolagem horizontal", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    const metas = page.getByRole("region", { name: "Metas da semana" });
    await expect(metas).toBeVisible();
    const caixa = metas.locator(".overflow-x-auto").first();
    const cabe = await caixa.evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(cabe).toBe(true);
    const alertas = page.getByRole("region", { name: /^Quem precisa de ajuda/ });
    const a = await alertas.boundingBox();
    const m = await metas.boundingBox();
    expect(a!.y).toBeLessThan(m!.y);
    expect(a!.y + a!.height).toBeLessThanOrEqual(m!.y + 1);
  });
});
