// Screenshots de todas as telas (desktop e celular) com os dados simulados, para o redesign
// comparar o antes e o depois. Só roda com `bun run screenshots`; os arquivos vão para
// docs/redesign/screenshots/<desktop|celular>/.
import { devices, test as visitor } from "@playwright/test";
import { seed, test, TODAY } from "./helpers";

/** Altura máxima da foto (px CSS): listas longas não precisam aparecer inteiras. */
const MAX_HEIGHT = 2400;

type Shot = { name: string; path: string; tab?: string; seed?: number };

const SHOTS: Shot[] = [
  { name: "02-hoje", path: "/hoje", seed: 60 },
  { name: "03-contatos", path: "/contatos", seed: 60 },
  { name: "04-empresas", path: "/empresas" },
  { name: "05-importar", path: "/importar" },
  { name: "06-modelos", path: "/modelos" },
  { name: "08-configuracoes", path: "/configuracoes" },
  { name: "09-painel-indicadores", path: "/painel", tab: "Indicadores" },
  { name: "10-painel-hunters", path: "/painel", tab: "Hunters" },
  { name: "11-painel-periodos", path: "/painel", tab: "Períodos e grupos" },
  { name: "12-painel-setores", path: "/painel", tab: "Setores e cadências" },
  { name: "13-painel-competicao", path: "/painel", tab: "Competição" },
  { name: "14-painel-busca", path: "/painel", tab: "Busca geral" },
];

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  // Pixel 7 sem o defaultBrowserType, que não pode ser trocado dentro de um describe.
  celular: {
    viewport: devices["Pixel 7"].viewport,
    userAgent: devices["Pixel 7"].userAgent,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  },
} as const;

async function snap(page: import("@playwright/test").Page, dir: string, name: string) {
  await page.waitForLoadState("networkidle");
  // Espera os "Carregando…" sumirem antes da foto.
  await page
    .getByText(/^Carregando/)
    .first()
    .waitFor({ state: "detached", timeout: 10_000 })
    .catch(() => undefined);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const width = page.viewportSize()!.width;
  await page.screenshot({
    path: `docs/redesign/screenshots/${dir}/${name}.png`,
    fullPage: true,
    clip: { x: 0, y: 0, width, height: Math.min(height, MAX_HEIGHT) },
    animations: "disabled",
  });
}

for (const [dir, device] of Object.entries(VIEWPORTS)) {
  visitor.describe(`${dir}: visitante`, () => {
    visitor.use(device);
    visitor.beforeEach(({ page }) => page.clock.setFixedTime(new Date(`${TODAY}T12:00:00-03:00`)));
    visitor("00-inicio", ({ page }) => page.goto("/").then(() => snap(page, dir, "00-inicio")));
    visitor("01-entrar", ({ page }) => page.goto("/auth").then(() => snap(page, dir, "01-entrar")));
  });

  test.describe(`${dir}: logado`, () => {
    test.use(device);
    for (const shot of SHOTS) {
      test(shot.name, async ({ page }) => {
        if (shot.seed) await seed(shot.seed);
        await page.goto(shot.path);
        if (shot.tab) {
          // Pelo teclado: no celular as últimas abas do painel ficam fora da tela.
          await page.getByRole("tab", { name: shot.tab }).focus();
          await page.keyboard.press("Enter");
        }
        await snap(page, dir, shot.name);
      });
    }
  });
}
