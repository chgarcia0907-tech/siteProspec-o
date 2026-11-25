import { STEPS } from "../src/lib/cadencia";
import { expect, mutations, test } from "./helpers";

const U1 = "11111111-1111-4111-8111-111111111111";
const SETOR_VAREJO = "12121212-0000-4000-8000-000000000001";
const SETOR_INDUSTRIA = "12121212-0000-4000-8000-000000000003";
const SUBSETOR_METALURGIA = "12121212-0000-4000-8000-000000000004";

test.describe("Empresas", () => {
  test("lista as empresas por semana, com setor e contatos vinculados", async ({ page }) => {
    await page.goto("/empresas");
    // O título da semana na lista (o eyebrow do topo repete o mesmo texto).
    await expect(
      page.getByRole("heading", { name: /^Semana de 09\/11\/2026 a 15\/11\/2026/ }),
    ).toBeVisible();
    await expect(page.getByText("· 2 empresas", { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder("Empresa").first()).toHaveValue("Delta");
    // Delta (Diego) e Ômicron (Carla) têm um contato cada.
    await expect(page.getByText("1 contato", { exact: true })).toHaveCount(2);
    // Só a Delta (Varejo) está incompleta; a Ômicron (Metalurgia) tem as 5 etapas.
    await expect(page.getByText("cadência do setor incompleta")).toHaveCount(1);
  });

  test("cadastra várias empresas com o setor e a semana, sem repetir as já cadastradas", async ({
    page,
  }) => {
    await page.goto("/empresas");
    await page.getByLabel("Empresas (uma por linha)").fill("Zeta\ndelta\nÔmega");
    await expect(page.getByText("2 novas · 1 já cadastrada")).toBeVisible();
    // Setor inativo não aparece para o hunter.
    const form = page.getByRole("form", { name: "Cadastrar empresas" });
    const setor = form.getByRole("combobox", { name: "Setor da empresa" });
    await expect(setor.locator("option", { hasText: "Saúde" })).toHaveCount(0);
    await setor.selectOption({ label: "Varejo" });
    await form.getByRole("button", { name: "Cadastrar" }).click();
    await expect(page.getByText("2 empresas cadastradas")).toBeVisible();

    const [m] = await mutations();
    expect(m).toMatchObject({ method: "POST", table: "companies" });
    const week = "2026-11-09"; // segunda-feira da semana de 12/11/2026
    expect(JSON.parse(m!.body)).toEqual([
      { name: "Zeta", gender: "feminino", sector_id: SETOR_VAREJO, week_start: week, user_id: U1 },
      { name: "Ômega", gender: "feminino", sector_id: SETOR_VAREJO, week_start: week, user_id: U1 },
    ]);
  });

  test("cadastra a empresa com setor e subsetor e esconde subsetor inativo", async ({ page }) => {
    await page.goto("/empresas");
    await page.getByLabel("Empresas (uma por linha)").fill("Zeta");
    const form = page.getByRole("form", { name: "Cadastrar empresas" });
    const setor = form.getByRole("combobox", { name: "Setor da empresa" });
    await expect(setor.locator("option", { hasText: "Metalurgia" })).toHaveCount(1);
    await expect(setor.locator("option", { hasText: "Química" })).toHaveCount(0);
    await setor.selectOption({ label: "Metalurgia" });
    await form.getByRole("button", { name: "Cadastrar" }).click();
    await expect(page.getByText("Empresa cadastrada")).toBeVisible();

    const [m] = await mutations();
    expect(m).toMatchObject({ method: "POST", table: "companies" });
    expect(JSON.parse(m!.body)).toEqual([
      {
        name: "Zeta",
        gender: "feminino",
        sector_id: SETOR_INDUSTRIA,
        subsector_id: SUBSETOR_METALURGIA,
        week_start: "2026-11-09",
        user_id: U1,
      },
    ]);
  });

  test("na lista, trocar o subsetor para o setor sozinho zera o subsetor e acusa a cadência incompleta", async ({
    page,
  }) => {
    await page.goto("/empresas");
    const linha = page
      .getByRole("row")
      .filter({ has: page.getByPlaceholder("Empresa") })
      .filter({
        has: page.locator('input[value="Ômicron"]'),
      });
    const setor = linha.getByRole("combobox", { name: "Setor da empresa" });
    await expect(setor.locator("option:checked")).toHaveText("Metalurgia");
    await expect(linha.getByText("cadência do setor incompleta")).toHaveCount(0);
    await setor.selectOption({ label: "Indústria" });
    await expect(page.getByText("Setor atualizado")).toBeVisible();

    const m = (await mutations()).find((x) => x.table === "companies");
    expect(m).toMatchObject({ method: "PATCH" });
    expect(JSON.parse(m!.body)).toEqual({ sector_id: SETOR_INDUSTRIA, subsector_id: null });
    // Sem o subsetor, a Indústria não tem mensagem nenhuma.
    await expect(linha.getByText("cadência do setor incompleta")).toBeVisible();
  });

  test("contato vinculado a uma empresa recebe a cadência do setor", async ({ page }) => {
    await page.goto("/hoje");
    await page.getByRole("tab", { name: /^WhatsApp 2/ }).click();
    const card = page
      .locator("div", { hasText: "Diego Rocha" })
      .filter({ has: page.getByRole("button", { name: "Copiar mensagem" }) })
      .last();
    await expect(card.getByText("Varejo", { exact: true })).toBeVisible();
    // Diego é CEO (Patrocinador Executivo): a mensagem da persona vence a de "qualquer persona" (VAR4).
    await expect(card.getByText("VAR4PE")).toBeVisible();
    await card.getByRole("button", { name: "Copiar mensagem" }).click();
    await expect(page.getByText("Mensagem copiada")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "Oi, Diego! Conversa de patrocinador na Delta.",
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
    // Um botão só grava o setor e a cadência.
    await page.getByRole("button", { name: "Salvar setor e cadência" }).click();
    await expect(page.getByText("Setor e cadência salvos")).toBeVisible();

    const m = (await mutations()).find((x) => x.table === "sector_templates");
    expect(m).toMatchObject({ method: "POST" });
    const todas = JSON.parse(m!.body) as {
      persona: string;
      step: number;
      code: string;
      body: string;
    }[];
    // A persona Patrocinador Executivo, que já tinha texto, também segue junto (5 etapas).
    expect(todas.filter((r) => r.persona === "patrocinador_executivo")).toHaveLength(5);
    const rows = todas.filter((r) => r.persona === "");
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({
      sector_id: SETOR_VAREJO,
      step: 1,
      code: "VAR1",
      body: "Olá, [FIRST NAME]! Varejo [NA_EMPRESA].",
    });
    expect(rows[3]).toMatchObject({ step: 4, code: "VAR4" });
  });

  test("a árvore de setores mostra o subsetor recuado abaixo do setor pai", async ({ page }) => {
    await page.goto("/painel?aba=setores");
    await expect(page.getByRole("button", { name: /^Metalurgia/ })).toBeVisible();
    const nomes = await page.locator("ul li button").allTextContents();
    const i = nomes.findIndex((n) => n.startsWith("Indústria"));
    expect(i).toBeGreaterThanOrEqual(0);
    expect(nomes[i + 1]).toMatch(/^Metalurgia/);
    const pai = await page.getByRole("button", { name: /^Indústria/ }).boundingBox();
    const filho = await page.getByRole("button", { name: /^Metalurgia/ }).boundingBox();
    expect(filho!.y).toBeGreaterThan(pai!.y);
    expect(filho!.x).toBeGreaterThan(pai!.x + 8);
  });

  test("admin cria um subsetor dentro do setor selecionado", async ({ page }) => {
    await page.goto("/painel?aba=setores");
    await page.getByRole("button", { name: /^Indústria/ }).click();
    await page.getByLabel("Nome do novo subsetor").fill("Autopeças");
    await page
      .locator("form")
      .filter({ has: page.getByLabel("Nome do novo subsetor") })
      .getByRole("button", { name: "Criar" })
      .click();
    await expect(page.getByText("Subsetor criado")).toBeVisible();
    const m = (await mutations()).find((x) => x.table === "sectors" && x.method === "POST");
    expect(JSON.parse(m!.body)).toMatchObject({ name: "Autopeças", parent_id: SETOR_INDUSTRIA });
  });

  test("selecionar um subsetor e criar outro grava o setor de primeiro nível como pai", async ({
    page,
  }) => {
    await page.goto("/painel?aba=setores");
    await page.getByRole("button", { name: /^Metalurgia/ }).click();
    await page.getByLabel("Nome do novo subsetor").fill("Autopeças");
    await page
      .locator("form")
      .filter({ has: page.getByLabel("Nome do novo subsetor") })
      .getByRole("button", { name: "Criar" })
      .click();
    await expect(page.getByText("Subsetor criado")).toBeVisible();
    const m = (await mutations()).find((x) => x.table === "sectors" && x.method === "POST");
    expect(JSON.parse(m!.body)).toMatchObject({ name: "Autopeças", parent_id: SETOR_INDUSTRIA });
  });

  test("admin escreve a mensagem de uma persona sem mexer em qualquer persona", async ({
    page,
  }) => {
    await page.goto("/painel?aba=setores");
    await page.getByRole("button", { name: /^Varejo/ }).click();
    const owner = page.getByRole("tab", { name: /^Owner da Operação/ });
    await expect(owner).toContainText(`0/${STEPS.length}`);
    // Qualquer persona tem só a etapa 4 do Varejo.
    await expect(page.getByRole("tab", { name: /^Qualquer persona/ })).toContainText(
      `1/${STEPS.length}`,
    );
    await owner.click();
    await page.getByLabel("Código da mensagem LinkedIn 1").fill("OWN1");
    await page
      .getByLabel("Mensagem LinkedIn 1", { exact: true })
      .fill("Olá, [FIRST NAME]! Owner [NA_EMPRESA].");
    await expect(owner).toContainText(`1/${STEPS.length}`);
    await page.getByRole("button", { name: "Salvar setor e cadência" }).click();
    await expect(page.getByText("Setor e cadência salvos")).toBeVisible();

    const m = (await mutations()).find((x) => x.table === "sector_templates");
    const rows = JSON.parse(m!.body) as {
      persona: string;
      step: number;
      code: string;
      body: string;
    }[];
    const own = rows.filter((r) => r.persona === "owner_operacao");
    expect(own).toHaveLength(STEPS.length);
    expect(own.find((r) => r.step === 1)).toMatchObject({
      sector_id: SETOR_VAREJO,
      code: "OWN1",
      body: "Olá, [FIRST NAME]! Owner [NA_EMPRESA].",
    });
    expect(own.filter((r) => r.body.trim())).toHaveLength(1);
    // "Qualquer persona" continua indo, com a etapa 4 que já existia.
    const qualquer = rows.filter((r) => r.persona === "");
    expect(qualquer).toHaveLength(STEPS.length);
    expect(qualquer.find((r) => r.step === 4)).toMatchObject({ code: "VAR4" });
    // Personas sem texto nem linhas salvas não são enviadas.
    expect(new Set(rows.map((r) => r.persona))).toEqual(
      new Set(["", "owner_operacao", "patrocinador_executivo"]),
    );
  });

  test("preencher vazias com o padrão numa persona não altera as outras abas", async ({ page }) => {
    await page.goto("/painel?aba=setores");
    await page.getByRole("button", { name: /^Varejo/ }).click();
    const owner = page.getByRole("tab", { name: /^Owner da Operação/ });
    await owner.click();
    await page.getByRole("button", { name: "Preencher vazias com o padrão" }).click();
    await expect(owner).toContainText(`${STEPS.length}/${STEPS.length}`);
    await expect(page.getByLabel("Mensagem LinkedIn 1", { exact: true })).toHaveValue(
      "Olá, [FIRST NAME]! Mensagem 1 [NA_EMPRESA].",
    );
    const qualquer = page.getByRole("tab", { name: /^Qualquer persona/ });
    await expect(qualquer).toContainText(`1/${STEPS.length}`);
    await qualquer.click();
    await expect(page.getByLabel("Mensagem LinkedIn 1", { exact: true })).toHaveValue("");
    await page.getByRole("tab", { name: /^WhatsApp 2/ }).click();
    await expect(page.getByLabel("Mensagem WhatsApp 2", { exact: true })).toHaveValue(
      "Oi, [FIRST NAME]! Cadência do varejo [NA_EMPRESA].",
    );
  });

  test("excluir pela lixeira pede confirmação e explica o que acontece com os contatos", async ({
    page,
  }) => {
    await page.goto("/empresas");
    await page.getByRole("button", { name: "Excluir Delta" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Excluir Delta?");
    await expect(dialog).toContainText("1 contatos vinculados continuam cadastrados");
    await dialog.getByRole("button", { name: "Excluir" }).click();
    await expect.poll(async () => (await mutations()).length).toBe(1);
    expect((await mutations())[0]).toMatchObject({ method: "DELETE", table: "companies" });
  });

  test("no editor do setor, as variáveis entram na mensagem com um clique", async ({ page }) => {
    await page.goto("/painel?aba=setores");
    await page.getByRole("button", { name: /Varejo/ }).click();
    // A aba do WhatsApp 2 tem mensagem própria; as outras usam o padrão.
    await expect(page.getByRole("tab", { name: /^WhatsApp 2/ })).toContainText("própria");
    await expect(page.getByRole("tab", { name: /^LinkedIn 1/ })).toContainText("padrão");
    const msg = page.getByLabel("Mensagem LinkedIn 1", { exact: true });
    await msg.fill("Oi, ");
    await page.getByRole("button", { name: "[FIRST NAME]", exact: true }).click();
    await expect(msg).toHaveValue("Oi, [FIRST NAME]");
    await expect(page.getByRole("tab", { name: /^LinkedIn 1/ })).toContainText("própria");
  });
});
