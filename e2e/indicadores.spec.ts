import { expect, mutations, test } from "./helpers";

const U2 = "22222222-2222-4222-8222-222222222222";
const GOAL_EQUIPE = "14141414-0000-4000-8000-000000000001";

// Hoje é 12/11/2026 (quinta). Na semana de 09 a 15/11 ninguém enviou mensagem; a única AT
// registrada é a do João (Hunter Dois, depois do WhatsApp 1). Bruno, Diego e Karen estão atrasados.
test.describe("Painel · Indicadores", () => {
  test("abre na semana atual com os números da equipe", async ({ page }) => {
    await page.goto("/painel");
    await expect(page.getByRole("tab", { name: "Indicadores" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const tile = (name: string) => page.getByRole("group", { name, exact: true });
    await expect(tile("ATs marcadas")).toContainText("1");
    await expect(tile("ATs marcadas")).toContainText("antes: 2");
    await expect(tile("Mensagens enviadas")).toContainText("antes: 8");
    await expect(tile("Envios atrasados agora")).toContainText("3");
    await expect(tile("Hunters parados (2+ dias úteis)")).toContainText("2");
    await expect(page.getByText("Hunter Dois: sem envio há 6 dias úteis")).toBeVisible();
    await expect(page.getByText("09/11/2026 a 15/11/2026 · comparado com")).toBeVisible();
  });

  test("lista os atrasados do hunter e a etapa que gerou a AT", async ({ page }) => {
    await page.goto("/painel");
    await page.getByRole("button", { name: "Hunter Dois" }).click();
    const late = page.getByRole("row", { name: /^Karen Luz/ });
    await expect(late).toContainText("WhatsApp 1");
    await expect(late).toContainText("5 d úteis");
    const origem = page.getByRole("region", { name: "Etapa que gerou a AT" });
    await expect(origem.locator("li", { hasText: "WhatsApp 1" })).toContainText("(100%)");
  });

  test("filtros de intervalo e de grupo recalculam os números", async ({ page }) => {
    await page.goto("/painel");
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
    await page.goto("/painel");
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
    await expect(metas.getByRole("row", { name: /^Equipe/ })).toContainText("1 / 2,4");
    await expect(
      page.getByText("Hunter Um: abaixo da meta de mensagens: 0 de 20 (0%)"),
    ).toBeVisible();
  });

  test("editor de metas grava a meta da equipe e a exceção de um hunter", async ({ page }) => {
    await page.goto("/painel");
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
});
