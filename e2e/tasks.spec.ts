import { expect, semAdmin, test } from "./helpers";

// Pipedrive simulado (e2e/fixtures.mjs, PIPEDRIVE): card 94307 em AT Diag. Agendada do Hunter Um
// (uma task atrasada desde 10/11, uma para 19/11 e uma concluída no prazo) e card 94500 em AT Diag.
// Realizada do Hunter Dois (uma task que vence hoje, 12/11, e uma concluída com atraso). Cards de
// outra etapa ou de outro núcleo ficam de fora.

test.describe("Tasks", () => {
  test("o admin vê as tasks por hunter, com as atrasadas primeiro", async ({ page }) => {
    await page.goto("/tasks");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tasks");

    const resumo = page.getByRole("region", { name: "Resumo das tasks" });
    await expect(resumo).toContainText("Tasks abertas3em 2 cards");
    await expect(resumo).toContainText("Atrasadas1");
    await expect(resumo).toContainText("Vencem hoje1");
    await expect(resumo).toContainText("Concluídas no prazo50%1 de 2 concluídas");

    const porHunter = page.getByRole("region", { name: "Tasks por hunter" });
    const linhas = porHunter.getByRole("row");
    await expect(linhas).toHaveCount(3);
    await expect(linhas.nth(1)).toContainText("Hunter Um");
    await expect(linhas.nth(1)).toContainText("1 card0 cards210100%");
    await expect(linhas.nth(2)).toContainText("Hunter Dois");

    const lista = page.getByRole("region", { name: "Tasks abertas" }).getByRole("row");
    await expect(lista).toHaveCount(4);
    await expect(lista.nth(1)).toContainText("Atrasada 2 dias");
    await expect(lista.nth(1)).toContainText("WhatsApp - TP3 pré-AT, enviar 14h");
    await expect(
      lista.nth(1).getByRole("link", { name: /Ômega Log - Paulo Reis/ }),
    ).toHaveAttribute("href", "https://polijunior.pipedrive.com/deal/94307");
    await expect(lista.nth(2)).toContainText("Vence hoje");
    await expect(lista.nth(2)).toContainText("Hunter Dois");
    await expect(page.getByText("Em negociação")).toHaveCount(0);
    await expect(page.getByText("Card de outro núcleo")).toHaveCount(0);

    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    await expect(nav.getByRole("link", { name: "Tasks" })).toHaveAttribute("data-status", "active");
  });

  test("filtra por etapa e por hunter", async ({ page }) => {
    await page.goto("/tasks");
    const resumo = page.getByRole("region", { name: "Resumo das tasks" });
    await expect(resumo).toContainText("Tasks abertas3");

    await page
      .getByRole("group", { name: "Etapa" })
      .getByRole("button", { name: "AT Diag. Realizada" })
      .click();
    await expect(resumo).toContainText("Tasks abertas1em 1 card");
    await expect(resumo).toContainText("Concluídas no prazo0%");
    await page.getByRole("button", { name: "As duas etapas" }).click();

    await page.getByRole("button", { name: "Hunter Um", exact: true }).click();
    await expect(resumo).toContainText("Tasks abertas2");
    await expect(resumo).toContainText("Concluídas no prazo100%");
    await expect(page.getByRole("region", { name: "Tasks abertas" }).getByRole("row")).toHaveCount(
      3,
    );
    await page.getByRole("button", { name: /ver todos/ }).click();
    await expect(resumo).toContainText("Tasks abertas3");
  });

  test("o hunter vê só os próprios números e tasks", async ({ page }) => {
    await semAdmin();
    await page.goto("/tasks");
    const resumo = page.getByRole("region", { name: "Resumo das tasks" });
    await expect(resumo).toContainText("Tasks abertas2em 1 card");
    await expect(resumo).toContainText("Atrasadas1");
    await expect(page.getByRole("region", { name: "Tasks por hunter" })).toHaveCount(0);
    const lista = page.getByRole("region", { name: "Tasks abertas" });
    await expect(lista.getByRole("row")).toHaveCount(3);
    await expect(lista).not.toContainText("follow up 1");
    await expect(lista.getByRole("columnheader", { name: "Hunter" })).toHaveCount(0);
  });
});
