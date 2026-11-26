// Screenshots de todas as telas (desktop) com os dados simulados, para o redesign
// comparar o antes e o depois. Só roda com `bun run screenshots`; os arquivos vão para
// docs/redesign/screenshots/desktop/.
import { test as visitor } from "@playwright/test";
import { seed, test, TODAY } from "./helpers";

/** Altura máxima da foto (px CSS): listas longas não precisam aparecer inteiras. */
const MAX_HEIGHT = 2400;

type Shot = {
  name: string;
  path: string;
  tab?: string;
  seed?: number;
  /** Texto colado no primeiro campo antes da foto (ex.: a pré-visualização da importação). */
  paste?: string;
  /** Botão clicado antes da foto (ex.: abrir o editor de um setor). */
  click?: RegExp;
};

/** Conexões de exemplo: uma empresa citada no headline, uma cadastrada e uma sem pistas. */
const COLADO = [
  "Paula Reis",
  "Gerente de Marketing no Itaú | Ex-Ambev",
  "Conexão feita em 10 de novembro de 2026",
  "Rui Alves",
  "Diretor Comercial na Delta",
  "Conexão feita em 11 de novembro de 2026",
  "Sara Lins",
  "Sócia-fundadora",
  "Conexão feita em 11 de novembro de 2026",
].join("\n");

const SHOTS: Shot[] = [
  { name: "15-inicio", path: "/inicio", seed: 60 },
  { name: "02-hoje", path: "/hoje", seed: 60 },
  { name: "03-contatos", path: "/contatos", seed: 60 },
  { name: "04-empresas", path: "/empresas" },
  { name: "16-ats", path: "/ats" },
  { name: "16-ats-detalhe", path: "/ats", click: /^Abrir a AT de Alfa$/ },
  { name: "17-tasks", path: "/tasks" },
  { name: "05-importar", path: "/importar" },
  { name: "05-importar-previa", path: "/importar", paste: COLADO },
  { name: "06-modelos", path: "/modelos" },
  { name: "08-configuracoes", path: "/configuracoes" },
  { name: "09-dashboard", path: "/dashboard" },
  {
    name: "09-dashboard-execucao",
    path: "/dashboard?aberto=22222222-2222-4222-8222-222222222222&ordem=late",
  },
  { name: "10-painel-hunters", path: "/painel", tab: "Hunters" },
  { name: "11-painel-periodos", path: "/painel", tab: "Períodos e grupos" },
  { name: "12-painel-setores", path: "/painel", tab: "Setores e cadências" },
  {
    name: "12-painel-setores-editor",
    path: "/painel",
    tab: "Setores e cadências",
    click: /Varejo/,
  },
  { name: "13-painel-competicao", path: "/painel", tab: "Competição" },
  { name: "14-painel-busca", path: "/painel", tab: "Busca geral" },
];

// Só desktop: o design system não tem layout de celular (docs/redesign/DESIGN.md).
const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
} as const;

async function snap(
  page: import("@playwright/test").Page,
  dir: string,
  name: string,
  maxHeight = MAX_HEIGHT,
) {
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
    clip: { x: 0, y: 0, width, height: Math.min(height, maxHeight) },
    animations: "disabled",
  });
}

for (const [dir, device] of Object.entries(VIEWPORTS)) {
  visitor.describe(`${dir}: visitante`, () => {
    visitor.use(device);
    visitor.beforeEach(({ page }) => page.clock.setFixedTime(new Date(`${TODAY}T12:00:00-03:00`)));
    visitor("00-inicio", async ({ page }) => {
      await page.goto("/");
      // As seções entram ao aparecer na tela: rola até o fim para todas aparecerem na foto.
      for (let y = 0; y < 8; y++) await page.mouse.wheel(0, 900);
      await page.evaluate(() => window.scrollTo(0, 0));
      await snap(page, dir, "00-inicio", 6000);
    });
    visitor("01-entrar", ({ page }) => page.goto("/auth").then(() => snap(page, dir, "01-entrar")));
  });

  test.describe(`${dir}: logado`, () => {
    test.use(device);
    for (const shot of SHOTS) {
      test(shot.name, async ({ page }) => {
        if (shot.seed) await seed(shot.seed);
        await page.goto(shot.path);
        if (shot.paste) await page.getByRole("textbox").first().fill(shot.paste);
        if (shot.tab) {
          // Pelo teclado: no celular as últimas abas do painel ficam fora da tela.
          await page.getByRole("tab", { name: shot.tab }).focus();
          await page.keyboard.press("Enter");
          // Tira o foco do teclado, para o anel de foco não aparecer na foto.
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        }
        if (shot.click) await page.getByRole("button", { name: shot.click }).click();
        await snap(page, dir, shot.name);
      });
    }
  });
}
