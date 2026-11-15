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
    expect(rows[1]).not.toHaveProperty("company");
    // Sem empresa nem área claras: os campos ficam para o hunter.
    expect(rows[2]).toMatchObject({ name: "Sara Lins", company_id: null });
    expect(rows[2]).not.toHaveProperty("company");
    expect(rows[2]).not.toHaveProperty("sector");
  });
});
