import { expect, mutations, test } from "./helpers";

const EMPRESA_DELTA = "13131313-0000-4000-8000-000000000001";

const COLADO = [
  "Foto do perfil de Paula Reis",
  "Paula Reis",
  "Gerente de Marketing no Itaú | Ex-Ambev",
  "Conexão feita em 10 de novembro de 2026",
  "Foto do perfil de Rui Alves",
  "Rui Alves",
  "Diretor Comercial na Delta",
  "Conexão feita em 11 de novembro de 2026",
  "Foto do perfil de Sara Lins",
  "Sara Lins",
  "Sócia-fundadora",
  "Conexão feita em 11 de novembro de 2026",
].join("\n");

test.describe("Importar conexões", () => {
  test("sugere empresa e área pelo headline e grava junto com o contato", async ({ page }) => {
    await page.goto("/importar");
    await page.getByRole("textbox").first().fill(COLADO);
    await expect(page.getByText("3 detectados, 3 novos")).toBeVisible();
    await expect(page.getByText("Itaú (do headline)")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Marketing", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Importar novos contatos" }).click();
    await expect(page.getByText("3 contatos importados")).toBeVisible();

    const [m] = await mutations();
    expect(m).toMatchObject({ method: "POST", table: "contacts" });
    const rows = JSON.parse(m!.body) as Record<string, unknown>[];
    expect(rows[0]).toMatchObject({
      name: "Paula Reis",
      job_title: "Gerente de Marketing",
      company_id: null,
      company: "Itaú",
      company_gender: "masculino",
      sector: "Marketing",
    });
    // Empresa cadastrada citada no headline vira vínculo (nome e concordância vêm do cadastro).
    expect(rows[1]).toMatchObject({
      name: "Rui Alves",
      company_id: EMPRESA_DELTA,
      sector: "Comercial / Vendas",
    });
    // Sem empresa nem área claras: os campos vão vazios para o hunter completar depois. Toda
    // linha leva as mesmas colunas: uma coluna ausente viraria NULL e recusaria o lote inteiro.
    expect(rows[2]).toMatchObject({ name: "Sara Lins", company_id: null, company: "", sector: "" });
    const colunas = rows.map((r) => Object.keys(r).sort().join(","));
    expect(new Set(colunas).size).toBe(1);
  });

  test("pagina a pré-visualização e conta o que fica fora do filtro de data", async ({ page }) => {
    // 55 conexões de 11/11 e 5 de 10/11 (nomes únicos, sem empresa no headline).
    const linhas = Array.from({ length: 60 }, (_, i) => {
      const dia = i < 55 ? 11 : 10;
      return [`Pessoa Teste ${i + 1}`, "Analista", `Conexão feita em ${dia} de novembro de 2026`];
    }).flat();
    await page.goto("/importar");
    await page.getByRole("textbox", { name: "Texto copiado do LinkedIn" }).fill(linhas.join("\n"));
    await expect(page.getByText("60 detectados, 60 novos")).toBeVisible();
    await expect(page.getByText("1–50 de 60 conexões")).toBeVisible();
    await expect(page.locator("main tbody tr")).toHaveCount(50);
    await page.getByRole("button", { name: "Próxima" }).click();
    await expect(page.locator("main tbody tr")).toHaveCount(10);

    await page.getByLabel("Importar apenas conexões feitas a partir de").fill("2026-11-11");
    await expect(page.getByText("60 detectados, 55 novos")).toBeVisible();
    await expect(page.getByText("5 fora do filtro de data")).toBeVisible();
    // Trocar o filtro volta para a primeira página.
    await expect(page.getByText("1–50 de 60 conexões")).toBeVisible();
  });

  test.describe("persona na prévia", () => {
    const PERSONAS_COLADO = [
      "Ana Souza",
      "Diretor de TI",
      "Conexão feita em 11 de novembro de 2026",
      "Bruno Lima",
      "Analista de Dados",
      "Conexão feita em 11 de novembro de 2026",
      "Carla Dias",
      "Gerente de Compras",
      "Conexão feita em 11 de novembro de 2026",
    ].join("\n");

    const rotuloMostrado = (sel: import("@playwright/test").Locator) =>
      sel.evaluate((el) => (el as HTMLSelectElement).selectedOptions[0]!.text);

    async function colar(page: import("@playwright/test").Page) {
      await page.goto("/importar");
      await page.getByRole("textbox", { name: "Texto copiado do LinkedIn" }).fill(PERSONAS_COLADO);
      await expect(page.getByText("3 detectados, 3 novos")).toBeVisible();
    }

    test("mostra a persona sugerida pelo cargo, sem o prefixo Owner", async ({ page }) => {
      await colar(page);
      const sugeridas = page.getByLabel("Persona (sugerida)");
      await expect(sugeridas).toHaveCount(3);
      expect(await rotuloMostrado(sugeridas.nth(0))).toBe("Tecnologia");
      expect(await rotuloMostrado(sugeridas.nth(1))).toBe("Processo");
      expect(await rotuloMostrado(sugeridas.nth(2))).toBe("Operação");
    });

    test("sem troca, nenhuma linha do POST leva persona", async ({ page }) => {
      await colar(page);
      await page.getByRole("button", { name: "Importar novos contatos" }).click();
      await expect(page.getByText("3 contatos importados")).toBeVisible();
      const [m] = await mutations();
      const rows = JSON.parse(m!.body) as Record<string, unknown>[];
      expect(rows).toHaveLength(3);
      for (const r of rows) expect(r).not.toHaveProperty("persona");
      expect(new Set(rows.map((r) => Object.keys(r).sort().join(","))).size).toBe(1);
    });

    test("trocar a persona de uma linha grava só nela; as outras ficam nulas", async ({ page }) => {
      await colar(page);
      await page.getByLabel("Persona (sugerida)").nth(1).selectOption("patrocinador_executivo");
      // Trocada: deixa de ser sugerida (sem borda tracejada) e mostra a escolha.
      await expect(page.getByLabel("Persona (sugerida)")).toHaveCount(2);
      const trocada = page.getByRole("combobox", { name: "Persona", exact: true });
      await expect(trocada).toHaveCount(1);
      expect(await rotuloMostrado(trocada)).toBe("Patrocinador Executivo");

      await page.getByRole("button", { name: "Importar novos contatos" }).click();
      await expect(page.getByText("3 contatos importados")).toBeVisible();
      const [m] = await mutations();
      const rows = JSON.parse(m!.body) as Record<string, unknown>[];
      expect(rows[1]).toMatchObject({ name: "Bruno Lima", persona: "patrocinador_executivo" });
      expect(rows[0]).not.toHaveProperty("persona");
      expect(rows[2]).not.toHaveProperty("persona");
      // Aqui as chaves diferem entre linhas de propósito: o supabase-js manda `columns` com a união
      // das chaves e o hook pede `missing=default`, então a linha sem a chave usa o padrão da coluna
      // (NULL = sugerida).
      // Diferente de empresa e área (NOT NULL), que recusariam o lote.
      expect(m!.query).toContain("columns=");
      expect(m!.query).toContain("persona");
    });
  });

  test.describe("em 1280 px", () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test("a tabela da prévia não tem rolagem horizontal", async ({ page }) => {
      await page.goto("/importar");
      await page.getByRole("textbox").first().fill(COLADO);
      await expect(page.getByText("3 detectados, 3 novos")).toBeVisible();
      await expect(page.getByLabel("Persona (sugerida)").first()).toBeVisible();
      const caixa = page.locator("main table").locator("xpath=..");
      const cabe = await caixa.evaluate((el) => el.scrollWidth <= el.clientWidth);
      expect(cabe).toBe(true);
    });
  });
});
