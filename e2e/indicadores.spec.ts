import { expect, mutations, seedHackathon, test } from "./helpers";

const U2 = "22222222-2222-4222-8222-222222222222";
const GOAL_EQUIPE = "14141414-0000-4000-8000-000000000001";

// Hoje é 12/11/2026 (quinta). Na semana de 09 a 15/11 ninguém enviou mensagem; a única AT
// registrada é a do João (Hunter Dois, depois do WhatsApp 1). Bruno, Diego e Karen estão atrasados.
test.describe("Indicadores", () => {
  test("o endereço antigo da aba leva ao menu Indicadores", async ({ page }) => {
    await page.goto("/painel?aba=indicadores");
    await expect(page).toHaveURL(/\/indicadores$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Indicadores");
  });

  test("abre na semana atual com os números da equipe", async ({ page }) => {
    await page.goto("/indicadores");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Indicadores");
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
    await page.goto("/indicadores");
    const ats = page.getByRole("group", { name: "ATs marcadas", exact: true });
    // Sem o Hackathon o valor é 1 (a AT do João); com a AT do card dele seria 2.
    await expect(ats).toContainText(/ATs marcadas\s*1(?!\d)/);
  });

  test("lista os atrasados do hunter e a etapa que gerou a AT", async ({ page }) => {
    await page.goto("/indicadores");
    await page.getByRole("button", { name: "Hunter Dois" }).click();
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
    await page.goto("/indicadores");
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
    await page.goto("/indicadores");
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
    await page.goto("/indicadores");
    const alertas = page.getByRole("region", { name: /^Quem precisa de ajuda/ });
    await expect(alertas.getByRole("listitem")).toHaveCount(5);
    await expect(alertas.getByText(/setor Varejo/)).toHaveCount(0);
    await alertas.getByRole("button", { name: "Ver todos os 7" }).click();
    await expect(alertas.getByRole("listitem")).toHaveCount(7);
    await expect(alertas.getByText(/setor Varejo/)).toBeVisible();
    await alertas.getByRole("button", { name: "Mostrar só os mais urgentes" }).click();
    await expect(alertas.getByRole("listitem")).toHaveCount(5);
  });

  test("editor de metas grava a meta da equipe e a exceção de um hunter", async ({ page }) => {
    await page.goto("/indicadores");
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
    await page.goto("/indicadores");
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
    await page.goto("/indicadores");
    await page.getByRole("tab", { name: "Execução por hunter", exact: true }).click();
    const bloco = page.getByRole("region", { name: "Execução da cadência por hunter" });
    await expect(bloco.getByRole("columnheader", { name: /Conexões/ })).toBeVisible();
    // Um clique ordena pela coluna.
    await bloco.getByRole("button", { name: "Conexões" }).click();
    await expect(bloco.getByRole("button", { name: /Conexões/ })).toContainText("↓");
  });
});
