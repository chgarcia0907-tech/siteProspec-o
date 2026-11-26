import { expect, mutations, seedSegmentos, test } from "./helpers";

const P1 = "aaaaaaaa-0000-4000-8000-000000000001";
const SAFRA_S03 = "16161616-0000-4000-8000-000000000003";
const TESTE = "17171717-0000-4000-8000-000000000001";

// Com o preparo, a S01 está madura: Varejo (Delta) tem a AT realizada da Ômega, que não avançou;
// Indústria (Ômicron) tem o no-show da Sigma. Teste A/B Varejo × Indústria nas S01 e S02.
test.describe("Dashboard: Segmentos", () => {
  test("mostra a quebra por setor com a decisão e troca a dimensão pela URL", async ({ page }) => {
    await seedSegmentos();
    await page.goto("/dashboard");
    await page.getByRole("tab", { name: "Segmentos" }).click();
    await expect(page).toHaveURL(/\/dashboard\?aba=segmentos$/);
    await expect(page.getByRole("heading", { name: "Onde a prospecção converte?" })).toBeVisible();
    await expect(page.getByText(/Safras maduras: S01 · mínimo de 1 AT realizada/)).toBeVisible();

    const matriz = page.getByRole("region", {
      name: "Prospect → AT × % avanço por setor da empresa",
    });
    const varejo = matriz.getByRole("row", { name: /^Varejo/ });
    await expect(varejo).toContainText("50% (1 de 2)");
    await expect(varejo).toContainText("Troca");
    await expect(matriz.getByRole("row", { name: /^Indústria/ })).toContainText("amostra pequena");
    await expect(matriz.getByRole("row", { name: /^Não informado/ })).toContainText(
      "sem a informação",
    );

    await page.getByRole("button", { name: "Nível", exact: true }).click();
    await expect(page).toHaveURL(/dimensao=nivel/);
    await expect(page.getByRole("button", { name: "Nível", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const nivel = page.getByRole("region", { name: "Prospect → AT × % avanço por nível" });
    await expect(nivel.getByRole("row", { name: /^Gerência/ })).toContainText("Troca");
    await expect(nivel.getByRole("row", { name: /^Diretoria/ })).toBeVisible();
  });

  test("mostra o teste A/B parcial e leva ao cadastro em Semanas", async ({ page }) => {
    await seedSegmentos();
    await page.goto("/dashboard?aba=segmentos");
    const teste = page.getByRole("article", { name: "Teste Varejo × Indústria" });
    await expect(teste).toContainText("Setor da empresa · S01 a S02");
    await expect(teste).toContainText("Parcial: Amostra mínima de 500 contatos por versão");
    await expect(teste.getByRole("row", { name: /^A/ })).toContainText("Varejo");
    await expect(teste.getByRole("row", { name: /^B/ })).toContainText("Indústria");

    await page.getByRole("button", { name: "Gerenciar em Semanas" }).click();
    await expect(page).toHaveURL(/aba=semanas/);
    const card = page.getByRole("region", { name: "Testes A/B do ciclo" });
    await expect(card.getByRole("row", { name: /Varejo × Indústria/ })).toContainText(
      "A: Varejo · B: Indústria",
    );
  });

  test("cria um teste A/B com validação", async ({ page }) => {
    await page.goto("/dashboard?aba=semanas");
    const card = page.getByRole("region", { name: "Testes A/B do ciclo" });
    await expect(card).toContainText("Nenhum teste A/B neste ciclo.");
    await card.getByRole("button", { name: "Novo teste" }).click();
    const dialog = page.getByRole("dialog", { name: "Novo teste A/B" });

    await dialog.getByRole("button", { name: "Salvar teste" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Dê um nome ao teste.");
    await dialog.getByLabel("Nome").fill("Porte pequeno × médio");
    await dialog.getByRole("button", { name: "Salvar teste" }).click();
    await expect(dialog.getByRole("alert")).toHaveText(
      "Escolha pelo menos um valor para a versão A.",
    );

    // Marcar um porte em A desabilita o mesmo porte em B.
    await dialog.getByRole("checkbox").nth(1).check(); // A: 11 a 50
    await expect(dialog.getByRole("checkbox").nth(9)).toBeDisabled(); // B: 11 a 50
    await dialog.getByRole("checkbox").nth(10).check(); // B: 51 a 200
    expect(await mutations()).toEqual([]);
    await dialog.getByRole("button", { name: "Salvar teste" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Teste criado")).toBeVisible();

    const [teste, versoes] = await mutations();
    expect(teste).toMatchObject({ method: "POST", table: "ab_testes" });
    expect(JSON.parse(teste!.body)).toMatchObject({
      nome: "Porte pequeno × médio",
      dimensao: "porte",
      descricao: null,
      period_id: P1,
      // O padrão é a última safra do ciclo.
      safra_inicial_id: SAFRA_S03,
      safra_final_id: SAFRA_S03,
    });
    expect(versoes).toMatchObject({ method: "POST", table: "ab_versoes" });
    const id = JSON.parse(teste!.body).id;
    expect(JSON.parse(versoes!.body)).toEqual([
      { teste_id: id, rotulo: "A", valores: ["11-50"], ordem: 0 },
      { teste_id: id, rotulo: "B", valores: ["51-200"], ordem: 1 },
    ]);
  });

  test("encerra um teste com a decisão", async ({ page }) => {
    await seedSegmentos();
    await page.goto("/dashboard?aba=semanas");
    await page.getByRole("button", { name: "Encerrar Varejo × Indústria" }).click();
    const dialog = page.getByRole("dialog", { name: "Encerrar “Varejo × Indústria”" });
    await dialog.getByLabel("Decisão").fill("Seguir com Varejo.");
    await dialog.getByRole("button", { name: "Encerrar teste" }).click();
    await expect(dialog).toBeHidden();
    const [m] = await mutations();
    expect(m).toMatchObject({ method: "PATCH", table: "ab_testes" });
    expect(m!.query).toContain(`id=eq.${TESTE}`);
    expect(JSON.parse(m!.body)).toEqual({ status: "encerrado", conclusao: "Seguir com Varejo." });
  });
});
