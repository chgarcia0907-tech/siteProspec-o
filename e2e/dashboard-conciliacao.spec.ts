import { expect, mutations, test } from "./helpers";

const AT_ALFA = "15151515-0000-4000-8000-000000000001";
const AT_SIGMA = "15151515-0000-4000-8000-000000000003";
const CONTATO_ANA = "dddddddd-0000-4000-8000-000000000001";

// Ciclo Nov (desde 27/10). ATs: Ana Souza · Alfa (sem card e sem contato), Paulo Reis · Ômega
// (com o card 94307, sem contato) e Lia Prado · Sigma (sem card e sem contato). Cards do outbound
// sem AT: 94500 "Sigma Fretes" (hunter2) e 94800 "Engenharia Nova" (hunter1, sem cargo).
test.describe("Dashboard › Conciliação", () => {
  test("mostra a higiene e as pendências, com o contador na aba", async ({ page }) => {
    await page.goto("/dashboard");
    // 2 ATs sem card + 3 sem contato + 2 cards sem AT + 1 sem cargo.
    await expect(page.getByRole("tab", { name: /Conciliação\s*8 pendências/ })).toBeVisible();
    await page.getByRole("tab", { name: /Conciliação/ }).click();
    await expect(page).toHaveURL(/aba=conciliacao/);

    const higiene = page.getByRole("region", { name: "Higiene dos dados" });
    await expect(higiene).toContainText("66,7% (2 de 3)");
    await expect(higiene).toContainText("50% (1 de 2)");

    const semCard = page.getByRole("table", { name: "ATs sem card no Pipedrive" });
    await expect(semCard.getByRole("row", { name: /Lia Prado/ })).toContainText(
      '#94500 "Sigma Fretes - Rita Lopes"',
    );
    await expect(
      page.getByRole("table", { name: "Cards do outbound sem AT" }).getByRole("row"),
    ).toHaveCount(3); // cabeçalho + 2
    await expect(page.getByRole("table", { name: "Negócios sem cargo" })).toContainText(
      "Engenharia Nova - contato",
    );
    await expect(page.getByLabel("Contatos sem alocação")).toContainText(
      "todos os hunters com contatos estão alocados",
    );
  });

  test("liga a AT ao card sugerido e ao contato sugerido", async ({ page }) => {
    await page.goto("/dashboard?aba=conciliacao");
    await page.getByRole("button", { name: "Ligar a AT de Lia Prado ao card 94500" }).click();
    await expect(page.getByText("AT ligada ao card")).toBeVisible();
    let ligacao = (await mutations()).find((m) => m.table === "ats");
    expect(ligacao).toMatchObject({ method: "PATCH" });
    expect(ligacao!.query).toContain(AT_SIGMA);
    expect(JSON.parse(ligacao!.body)).toEqual({ pipedrive_deal_id: 94500 });

    await page
      .getByRole("button", { name: "Ligar a AT de Ana Souza ao contato Ana Souza" })
      .click();
    await expect(page.getByText("AT ligada ao contato")).toBeVisible();
    ligacao = (await mutations()).filter((m) => m.table === "ats").at(-1);
    expect(ligacao!.query).toContain(AT_ALFA);
    expect(JSON.parse(ligacao!.body)).toEqual({ contact_id: CONTATO_ANA });
  });

  test("sem sugestão, escolhe o card na lista dos cards sem AT", async ({ page }) => {
    await page.goto("/dashboard?aba=conciliacao");
    await page.getByRole("button", { name: "Escolher o card da AT de Ana Souza" }).click();
    const dialog = page.getByRole("dialog", { name: "Card da AT de Ana Souza" });
    await dialog.getByLabel("Buscar card pelo título ou número").fill("nova");
    await expect(dialog.getByRole("listitem")).toHaveCount(1);
    await dialog.getByRole("button", { name: "Ligar ao card 94800" }).click();
    await expect(page.getByText("AT ligada ao card")).toBeVisible();
    const ligacao = (await mutations()).find((m) => m.table === "ats");
    expect(ligacao!.query).toContain(AT_ALFA);
    expect(JSON.parse(ligacao!.body)).toEqual({ pipedrive_deal_id: 94800 });
  });

  test("sincronizar agora copia os cards que mudaram", async ({ page }) => {
    await page.goto("/dashboard?aba=conciliacao");
    await page.getByRole("button", { name: "Sincronizar agora" }).click();
    // 94500 mudou no Pipedrive depois da cópia; 94307 (ligado à AT) ainda não tinha data.
    await expect(page.getByText("2 cards copiados")).toBeVisible();
    expect((await mutations()).some((m) => m.table === "pd_cards" && m.method === "POST")).toBe(
      true,
    );
  });
});
