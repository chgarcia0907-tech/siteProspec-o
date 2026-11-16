import { expect, test } from "./helpers";

// Hunter Um logado, relógio em 12/11/2026 (semana de 09 a 15/11). Na equipe do ciclo ativo
// (Hunter Um e Hunter Dois), a meta é 1 AT por hunter na semana; só Hunter Dois registrou uma
// (João Pires, em 11/11).
test.describe("Início do hunter", () => {
  test("mostra a semana da equipe, os envios de hoje, os atrasados e a conversão", async ({
    page,
  }) => {
    await page.goto("/inicio");
    await expect(page.getByText("Quinta, 12 de novembro · semana de 09 a 15/11")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Boas-vindas, Hunter Um. A equipe está a 1 AT da meta.",
    );

    const ats = page.getByRole("region", { name: "ATs marcadas pela equipe" });
    await expect(ats).toContainText("1/2");
    await expect(ats).toContainText("Meta da semana: 2. Nenhuma é sua ainda.");
    const vagas = ats.getByRole("list", { name: "ATs da semana, uma por vaga da meta" });
    // A AT de outro hunter aparece só com o dia, sem nome nem empresa.
    await expect(vagas.getByRole("listitem")).toHaveCount(2);
    await expect(vagas.getByRole("listitem").first()).toHaveAccessibleName("AT da equipe · qua 11");
    await expect(vagas.getByRole("listitem").nth(1)).toHaveAccessibleName("Vaga livre da meta");
    await expect(ats).not.toContainText("Kapa");
    await expect(ats).not.toContainText("João");

    // "Só as minhas" apaga as ATs dos outros.
    await ats.getByRole("radio", { name: "Só as minhas" }).click();
    await expect(ats.getByRole("radio", { name: "Só as minhas" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(vagas.getByRole("listitem").first()).toHaveCSS("opacity", "0.25");

    // Mesma conta do contador da navegação: 4 leads esperam envio.
    const hoje = page.getByRole("region", { name: "Envios de hoje" });
    await expect(hoje).toContainText("4 leads na fila");
    await expect(hoje).toContainText(
      "0 já enviados hoje. 1 LinkedIn 1 ainda sem data entram aqui.",
    );
    await expect(hoje.getByRole("link", { name: /WhatsApp 2/ })).toContainText("2");

    const atrasados = page.getByRole("region", { name: "Atrasados" });
    await expect(atrasados).toContainText("2 leads atrasados");
    await expect(atrasados.getByRole("link").first()).toHaveText(
      /Bruno Lima.*WhatsApp 1 · previsto 06\/11.*4 dias úteis/,
    );

    // Semana passada: 1 AT registrada (Elisa, 06/11) para 2 LinkedIn 1 enviados.
    const conversao = page.getByRole("region", { name: "Sua conversão na semana" });
    await expect(conversao).toContainText("Você ainda não enviou LinkedIn 1 nesta semana.");
    await expect(
      conversao.getByRole("meter", { name: "Conversão: semana passada" }),
    ).toHaveAttribute("aria-valuenow", "50");

    await page.getByRole("link", { name: "Começar os envios de hoje" }).click();
    await expect(page).toHaveURL(/\/hoje$/);
  });

  test("é a primeira tela do hunter: o endereço raiz e a navegação levam a ela", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/inicio$/);
    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    await expect(nav.getByRole("link", { name: "Início" })).toHaveAttribute(
      "data-status",
      "active",
    );
  });
});
