import { expect, test } from "./helpers";

const U1 = "11111111-1111-4111-8111-111111111111";

// Hoje é 12/11/2026 (quinta), semana da S02 (09/11). O Hunter Um está alocado na S02 (Varejo,
// dupla D1, metas de 10 empresas e 40 contatos) e tem um contato criado nela (Hugo) e sete na S01.
// Sem meta de passos: o esforço dele é 1 contato ÷ 40 × 4 de 5 dias úteis = 32 → 3%.
// O Hunter Dois não foi alocado. A única AT da semana é a do Hunter Um (10/11).
test.describe("Dashboard › Hunters", () => {
  test("mostra a disciplina da semana de cada hunter contra a meta", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("tab", { name: "Hunters" }).click();
    await expect(page).toHaveURL(/aba=hunters/);
    await expect(page.getByLabel("Semana", { exact: true })).toHaveValue("2026-11-09");

    const tabela = page.getByRole("table", { name: "Disciplina de cada hunter na semana" });
    const um = tabela.getByRole("row", { name: /Hunter Um/ });
    await expect(um).toContainText("Varejo · D1");
    await expect(um).toContainText("1 de 40");
    await expect(um).toContainText("3%");
    await expect(um).toContainText("Abaixo");
    // Tasks do Pipedrive com prazo até ontem: 1 de 2 concluída no dia do vencimento.
    await expect(um).toContainText("50% (1 de 2)");
    // Bruno e Diego estão sem envio há 5 dias úteis.
    await expect(um.getByRole("cell").last()).toHaveText("2");
    const dois = tabela.getByRole("row", { name: /Hunter Dois/ });
    await expect(dois).toContainText("sem meta definida");
    // Só a Karen: Iara e João já têm AT marcada e saíram da cadência.
    await expect(dois.getByRole("cell").last()).toHaveText("1");

    const participacao = page.getByRole("table", {
      name: "Participação de cada hunter nas ATs por semana",
    });
    await expect(participacao.getByRole("row", { name: /Hunter Um/ })).toContainText(
      "100% (1 de 1)",
    );
    await expect(participacao.getByRole("row", { name: /Hunter Um/ })).toContainText(
      "concentração",
    );
  });

  test("abre a ficha do hunter com as duas filas e fecha", async ({ page }) => {
    await page.goto("/dashboard?aba=hunters");
    await page
      .getByRole("table", { name: "Disciplina de cada hunter na semana" })
      .getByRole("button", { name: "Hunter Um" })
      .click();
    await expect(page).toHaveURL(new RegExp(`ficha=${U1}`));
    const ficha = page.getByRole("region", { name: "Ficha de Hunter Um" });
    const prospeccao = ficha.getByRole("region", { name: "Fila de prospecção" });
    await expect(prospeccao).toContainText("S02");
    await expect(prospeccao).toContainText("Varejo · metas: 10 empresas, 40 contatos");
    const cadencia = ficha.getByRole("region", { name: "Fila de cadência" });
    await expect(cadencia).toContainText("S01");
    await expect(cadencia).toContainText("Contatos parados (2)");
    await expect(cadencia).toContainText("Bruno Lima");
    await expect(cadencia).toContainText("Diego Rocha");
    await expect(
      ficha.getByRole("table", { name: "Histórico de Hunter Um por safra" }),
    ).toContainText("imatura");

    await ficha.getByRole("button", { name: "Fechar a ficha" }).click();
    await expect(page).not.toHaveURL(/ficha=/);
    await expect(page.getByRole("region", { name: "Ficha de Hunter Um" })).toHaveCount(0);
  });

  test("trocar a semana mostra a safra dela", async ({ page }) => {
    await page.goto("/dashboard?aba=hunters");
    await page.getByLabel("Semana", { exact: true }).selectOption("2026-11-02");
    await expect(page).toHaveURL(/semana=2026-11-02/);
    const um = page
      .getByRole("table", { name: "Disciplina de cada hunter na semana" })
      .getByRole("row", { name: /Hunter Um/ });
    // Sete contatos criados de 02/11 a 08/11; a S01 não usa alocação.
    await expect(um.getByRole("cell").nth(1)).toHaveText("7");
  });

  test("sem safras maduras, a dispersão de avanço explica por que está vazia", async ({ page }) => {
    await page.goto("/dashboard?aba=hunters");
    await expect(page.getByText("Nenhuma safra madura ainda")).toBeVisible();
  });
});
