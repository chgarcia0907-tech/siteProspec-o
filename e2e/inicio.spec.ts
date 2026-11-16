import { expect, test } from "@playwright/test";
import { TODAY } from "./helpers";

// Visitante sem sessão, com o relógio em 12/11/2026 (quinta-feira).
test.beforeEach(({ page }) => page.clock.setFixedTime(new Date(`${TODAY}T12:00:00-03:00`)));

test.describe("Página inicial", () => {
  test("as abas das pastas mostram o dia útil de cada mensagem", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Do aceite à reunião");
    const aceite = page.getByLabel("Conexão aceita em");
    await expect(aceite).toHaveValue("2026-11-12");
    await expect(page.getByText("qui, 12/11")).toBeVisible();

    // Aceite na sexta: a segunda mensagem pula o fim de semana.
    await aceite.fill("2026-11-13");
    await expect(page.getByText("qui, 12/11")).toHaveCount(0);
    await expect(page.getByText("sex, 13/11")).toBeVisible();
    await expect(page.getByText("seg, 16/11")).toBeVisible();
    await expect(page.getByText("qui, 19/11")).toBeVisible();
  });

  test("a lista de telas troca o recorte ao lado", async ({ page }) => {
    await page.goto("/");
    const telas = page.getByRole("region", { name: "O que o hunter usa todo dia" });
    await telas.scrollIntoViewIfNeeded();
    await telas.getByRole("button", { name: /^Modelos/ }).hover();
    await expect(telas.getByRole("button", { name: /^Modelos/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(telas.getByText("[DOR_DO_SETOR]")).toBeVisible();
  });

  test("leva ao cadastro e ao login", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Criar conta de hunter" }).click();
    await expect(page).toHaveURL(/\/auth\?modo=cadastro$/);
    await expect(page.getByRole("tab", { name: "Criar conta" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByLabel("Seu nome")).toBeVisible();

    await page.getByRole("tab", { name: "Entrar" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Entrar");
    await expect(page.getByLabel("Seu nome")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
  });
});
