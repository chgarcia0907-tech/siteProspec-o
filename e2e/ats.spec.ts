import { expect, mutations, semAdmin, test } from "./helpers";

const U1 = "11111111-1111-4111-8111-111111111111";
const AT_ALFA = "15151515-0000-4000-8000-000000000001";
const BRUNO = "dddddddd-0000-4000-8000-000000000002";

const FICHA = `Ficha de AT - Beta

Nome do prospect: Bruno Lima
Cargo: CTO
Setor: Indústria
LinkedIn: https://www.linkedin.com/in/bruno-lima
Canal de Contato: WhatsApp - respondeu ao WhatsApp 1
Data: 19/11 às 15h

Por que prospectou? Fábrica com muito controle em planilha.
@Rui`;

test.describe("ATs", () => {
  test("lista as ATs da equipe com resumo, remarcação e card do Pipedrive", async ({ page }) => {
    await page.goto("/ats");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ATs");
    await expect(page.getByText("3 ATs registradas")).toBeVisible();

    const resumo = page.getByRole("region", { name: "Resumo das ATs" });
    await expect(resumo).toContainText("ATs3");
    await expect(resumo).toContainText("50% de comparecimento");
    await expect(resumo).toContainText("No-show1");
    await expect(resumo).toContainText("33% das ATs");

    const linhas = page.getByRole("row");
    // Cabeçalho + 3 ATs, da data mais distante para a mais próxima.
    await expect(linhas).toHaveCount(4);
    await expect(linhas.nth(1)).toContainText("17/11/2026 14:00");
    await expect(linhas.nth(1)).toContainText("era 13/11/2026 10:00");
    await expect(linhas.nth(1)).toContainText("Remarcada");
    await expect(linhas.nth(1)).toContainText("Ana Coordenadora");
    await expect(linhas.nth(2)).toContainText("Ômega Log");
    await expect(linhas.nth(2)).toContainText("Realizada");
    await expect(
      linhas.nth(2).getByRole("link", { name: "Abrir o card de Ômega Log no Pipedrive" }),
    ).toHaveAttribute("href", "https://polijunior.pipedrive.com/deal/94307");
    await expect(linhas.nth(3)).toContainText("No-show");

    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    await expect(nav.getByRole("link", { name: "ATs" })).toHaveAttribute("data-status", "active");
  });

  test("filtra por busca, situação, hunter e CN", async ({ page }) => {
    await page.goto("/ats");
    const linhas = page.getByRole("row");
    await expect(linhas).toHaveCount(4);

    await page.getByLabel("Buscar por empresa ou prospect").fill("omega paulo");
    await expect(linhas).toHaveCount(2);
    await expect(linhas.nth(1)).toContainText("Ômega Log");
    await page.getByLabel("Buscar por empresa ou prospect").fill("");

    await page.getByLabel("Situação").selectOption("remarcada");
    await expect(linhas).toHaveCount(2);
    await expect(linhas.nth(1)).toContainText("Alfa");
    await page.getByLabel("Situação").selectOption("todas");

    await page.getByLabel("Hunter").selectOption("hunter2");
    await expect(linhas).toHaveCount(3);
    await page.getByLabel("CN").selectOption("ana.cn");
    await expect(linhas).toHaveCount(2);
    await expect(linhas.nth(1)).toContainText("Sigma");
    await expect(page.getByRole("region", { name: "Resumo das ATs" })).toContainText("ATs1");
  });

  test("registra uma AT colando a ficha e liga o contato do hunter", async ({ page }) => {
    await page.goto("/ats");
    await page.getByRole("button", { name: "Registrar AT" }).click();
    const form = page.getByRole("form", { name: "Registrar AT" });
    await form.getByLabel("Ficha de AT (opcional)").fill(FICHA);

    await expect(form.getByLabel("Empresa *")).toHaveValue("Beta");
    await expect(form.getByLabel("Prospect *")).toHaveValue("Bruno Lima");
    await expect(form.getByLabel("Data e horário da AT *")).toHaveValue("2026-11-19T15:00");
    await expect(form.getByLabel("Canal")).toHaveValue("WhatsApp");
    await expect(form.getByLabel("CN")).toHaveValue("rui.cn");
    await expect(form.getByText("Ligada ao seu contato Bruno Lima (Beta).")).toBeVisible();

    await form.getByRole("button", { name: "Registrar AT" }).click();
    await expect(page.getByText("AT de Beta registrada")).toBeVisible();

    const m = (await mutations()).find((x) => x.table === "ats");
    expect(m).toMatchObject({ method: "POST" });
    expect(JSON.parse(m!.body)).toEqual({
      user_id: U1,
      hunter_login: "hunter1",
      cn_login: "rui.cn",
      contact_id: BRUNO,
      resposta_etapa: null,
      resposta_modelo: null,
      canal: "WhatsApp",
      empresa: "Beta",
      prospect: "Bruno Lima",
      cargo: "CTO",
      setor: "Indústria",
      linkedin: "https://www.linkedin.com/in/bruno-lima",
      motivo_prospeccao: "Fábrica com muito controle em planilha.",
      ficha_original: FICHA,
      agendada_original: "2026-11-19T15:00:00-03:00",
    });
  });

  test("não registra AT sem data e avisa a ficha de remarcação", async ({ page }) => {
    await page.goto("/ats");
    await page.getByRole("button", { name: "Registrar AT" }).click();
    const form = page.getByRole("form", { name: "Registrar AT" });
    await form
      .getByLabel("Ficha de AT (opcional)")
      .fill(FICHA.replace("19/11 às 15h", "amanhã 15h"));
    await expect(form.getByRole("status")).toHaveText(
      "Confira a data e o horário: a ficha não deixou claro.",
    );
    await expect(form.getByRole("button", { name: "Registrar AT" })).toBeDisabled();

    await form
      .getByLabel("Ficha de AT (opcional)")
      .fill("Ficha de Remarcação - Alfa\nProspect: Ana Souza\nNova data: 18/11 às 10h");
    await expect(form.getByRole("status")).toContainText("Ficha de Remarcação");
  });

  test("remarca a própria AT sem card, com motivo obrigatório, e mostra o histórico", async ({
    page,
  }) => {
    await page.goto("/ats");
    await page.getByRole("button", { name: "Abrir a AT de Alfa" }).click();
    const dialog = page.getByRole("dialog");
    const historico = dialog.getByRole("region", { name: "Histórico da AT" });
    await expect(historico).toContainText("Marcada");
    await expect(historico).toContainText("13/11/2026 10:00 → 17/11/2026 14:00");
    await expect(historico).toContainText("Prospect pediu outro dia");
    await expect(dialog).toContainText("1 remarcação");

    await dialog.getByRole("button", { name: "Remarcar" }).click();
    const form = dialog.getByRole("form", { name: "Registrar Remarcada" });
    await expect(form.getByLabel("Nova data e horário *")).toHaveValue("2026-11-17T14:00");
    await form.getByLabel("Nova data e horário *").fill("2026-11-24T09:30");
    await expect(form.getByText("Informe o motivo da remarcação.")).toBeVisible();
    await expect(form.getByRole("button", { name: "Confirmar" })).toBeDisabled();
    await form.getByLabel("Motivo *").fill("Viagem do prospect");
    await form.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText("Remarcada: Alfa")).toBeVisible();

    const m = (await mutations()).find((x) => x.table === "at_eventos");
    expect(JSON.parse(m!.body)).toEqual({
      at_id: AT_ALFA,
      evento: "remarcada",
      horario_novo: "2026-11-24T09:30:00-03:00",
      motivo: "Viagem do prospect",
    });
  });

  test("AT com card só mostra o Pipedrive, sem ações", async ({ page }) => {
    await page.goto("/ats");
    await page.getByRole("button", { name: "Abrir a AT de Ômega Log" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("A situação desta AT vem do card no Pipedrive.");
    await expect(dialog.getByRole("link", { name: "Card 94307" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Remarcar" })).toHaveCount(0);
    await expect(dialog.getByRole("region", { name: "Histórico da AT" })).toContainText(
      "Realizada · 11/11/2026 16:00 · Pipedrive",
    );
  });

  test("o admin registra em AT de outro hunter; o hunter comum só nas próprias", async ({
    page,
  }) => {
    await page.goto("/ats");
    await page.getByRole("button", { name: "Abrir a AT de Sigma" }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Remarcar" })).toBeVisible();

    await semAdmin();
    await page.reload();
    await page.getByRole("button", { name: "Abrir a AT de Sigma" }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "Só o hunter da AT ou um administrador registram remarcação, no-show e desfecho.",
    );
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Abrir a AT de Alfa" }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: "No-show" })).toBeVisible();
  });
});
