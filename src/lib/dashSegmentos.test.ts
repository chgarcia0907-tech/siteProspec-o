import { describe, expect, it } from "vitest";
import { addDaysISO } from "./cadencia";
import {
  duasProporcoes,
  erroTesteAb,
  opcoesDaDimensao,
  resultadoAb,
  type AbTeste,
} from "./abTestes";
import type { Alocacao } from "./alocacao";
import {
  computeSegmentos,
  decisaoDoAvanco,
  mediasDaDimensao,
  valorDaDimensao,
  type SAt,
  type SContato,
  type SegmentosInput,
} from "./dashSegmentos";
import type { Safra } from "./safras";

// Hoje é quarta, 02/12/2026. Maturação de 1 semana: S01 e S02 maduras; S03 e S04 não.
const HOJE = "2026-12-02";
const safra = (numero: number, inicio: string): Safra => ({
  id: `s${numero}`,
  period_id: "c",
  numero,
  inicio,
  fim: inicio,
  usa_alocacao: true,
  cadencia_em: addDaysISO(inicio, 7),
});
const SAFRAS = [
  safra(1, "2026-11-09"),
  safra(2, "2026-11-16"),
  safra(3, "2026-11-23"),
  safra(4, "2026-11-30"),
];
const ct = (id: string, dia: string, o: Partial<SContato> = {}): SContato => ({
  id,
  user_id: "ana",
  created_at: `${dia}T12:00:00Z`,
  company_id: null,
  job_title: "",
  headline: "",
  sector: null,
  persona: null,
  ...o,
});
const at = (id: string, contact_id: string, o: Partial<SAt> = {}): SAt => ({
  id,
  contact_id,
  status: "realizada",
  canal: "LinkedIn",
  resposta_etapa: 1,
  pipedrive_stage_id: null,
  pipedrive_deal_id: null,
  ...o,
});
const EMPRESAS = {
  e1: { sector_id: "varejo", subsector_id: "moda", porte: "51-200" },
  e2: { sector_id: "varejo", subsector_id: null, porte: "11-50" },
  e3: { sector_id: "saude", subsector_id: null, porte: null },
};
const SETORES = { varejo: "Varejo", moda: "Moda", saude: "Saúde" };

const CONTATOS: SContato[] = [
  // S01 (madura): três da e1, um da e2.
  ct("c1", "2026-11-09", {
    company_id: "e1",
    job_title: "Gerente de Operações",
    sector: "Operações",
  }),
  ct("c2", "2026-11-10", { company_id: "e1", job_title: "Diretor Comercial" }),
  ct("c3", "2026-11-11", { company_id: "e1", job_title: "Analista de RH", sector: "RH" }),
  ct("c4", "2026-11-12", { company_id: "e2", job_title: "CEO", persona: "patrocinador_executivo" }),
  // S02 (madura): um da e3 e um sem empresa.
  ct("c5", "2026-11-16", { company_id: "e3", job_title: "Gerente de TI" }),
  ct("c6", "2026-11-17"),
  // S03 (imatura): fora das quebras por segmento.
  ct("c7", "2026-11-23", { company_id: "e3" }),
];
const ATS: SAt[] = [
  // c1: realizada e avançou (etapa 33). c2: realizada, não avançou. c4: no-show. c5: realizada.
  at("a1", "c1", { pipedrive_stage_id: 33 }),
  at("a2", "c2", { canal: "E-mail", resposta_etapa: 0 }),
  at("a4", "c4", { status: "no_show", canal: null, resposta_etapa: null }),
  at("a5", "c5", { resposta_etapa: 2, canal: "WhatsApp" }),
  // c7 (imatura) e AT sem contato: fora.
  at("a7", "c7"),
  at("a8", "", { contact_id: null }),
];
const aloc = (o: Partial<Alocacao> & Pick<Alocacao, "safra_id">): Alocacao => ({
  id: o.safra_id,
  user_id: "ana",
  sector_id: "varejo",
  subsector_id: null,
  dupla: null,
  meta_empresas: 5,
  meta_contatos: 40,
  motivo_meta_zero: null,
  vigente_desde: "2026-11-09",
  ...o,
});
const base = (o: Partial<SegmentosInput> = {}): SegmentosInput => ({
  hoje: HOJE,
  safras: SAFRAS,
  maturacaoSemanas: 1,
  minAtsSegmento: 2,
  avancoFicaPct: 50,
  avancoTrocaPct: 35,
  contatos: CONTATOS,
  empresas: EMPRESAS,
  setores: SETORES,
  ats: ATS,
  cards: {},
  alocacoes: [aloc({ safra_id: "s1" }), aloc({ safra_id: "s3", sector_id: "saude" })],
  ...o,
});

describe("valorDaDimensao", () => {
  it("lê a empresa, a persona efetiva, o nível pelo cargo e a área", () => {
    const c = CONTATOS[0]!;
    expect(valorDaDimensao(c, "setor", EMPRESAS)).toBe("varejo");
    expect(valorDaDimensao(c, "subsetor", EMPRESAS)).toBe("moda");
    expect(valorDaDimensao(c, "porte", EMPRESAS)).toBe("51-200");
    expect(valorDaDimensao(c, "persona", EMPRESAS)).toBe("owner_operacao");
    expect(valorDaDimensao(c, "nivel", EMPRESAS)).toBe("gerencia");
    expect(valorDaDimensao(c, "area", EMPRESAS)).toBe("Operações");
    expect(valorDaDimensao(CONTATOS[5]!, "porte", EMPRESAS)).toBeNull();
  });
});

describe("decisaoDoAvanco", () => {
  it("fica, ajusta ou troca pelos limites", () => {
    expect(decisaoDoAvanco({ n: 5, d: 10 }, 50, 35)).toBe("fica");
    expect(decisaoDoAvanco({ n: 4, d: 10 }, 50, 35)).toBe("ajusta");
    expect(decisaoDoAvanco({ n: 3, d: 10 }, 50, 35)).toBe("troca");
    expect(decisaoDoAvanco({ n: 0, d: 0 }, 50, 35)).toBeNull();
  });
});

describe("computeSegmentos", () => {
  const r = computeSegmentos(base());
  const dim = (k: string) => r.dimensoes.find((d) => d.chave === k)!.segmentos;

  it("usa só as safras maduras", () => {
    expect(r.maduras).toEqual([1, 2]);
    const total = dim("setor").reduce((t, s) => t + s.contatos, 0);
    expect(total).toBe(6);
  });

  it("quebra por setor com Prospect → AT, % avanço, amostra pequena e decisão", () => {
    expect(
      dim("setor").map((s) => [s.rotulo, s.prospectAt, s.avanco, s.pequeno, s.decisao]),
    ).toEqual([
      // Varejo: 4 contatos, 3 com AT; 2 realizadas, 1 avançou (50%): fica.
      ["Varejo", { n: 3, d: 4 }, { n: 1, d: 2 }, false, "fica"],
      // Saúde: 1 realizada < mínimo de 2: amostra pequena, sem decisão.
      ["Saúde", { n: 1, d: 1 }, { n: 0, d: 1 }, true, null],
      ["Não informado", { n: 0, d: 1 }, { n: 0, d: 0 }, true, null],
    ]);
  });

  it("médias da base inteira para a dispersão", () => {
    // 6 contatos, 4 com AT; 3 realizadas, 1 avançou.
    expect(mediasDaDimensao(dim("setor"))).toEqual({ prospectAt: 66.7, avanco: 33.3 });
    expect(mediasDaDimensao([])).toEqual({ prospectAt: null, avanco: null });
  });

  it("rotula persona, nível e porte", () => {
    expect(dim("persona").map((s) => s.rotulo)).toContain("Patrocinador Executivo");
    expect(dim("nivel").map((s) => s.rotulo)).toEqual(
      expect.arrayContaining([
        "Gerência",
        "Diretoria",
        "C-level e sócios",
        "Analista e especialista",
      ]),
    );
    expect(dim("porte").map((s) => s.rotulo)).toContain("51 a 200 funcionários");
  });

  it("contatos por empresa × empresa chegou à AT", () => {
    expect(r.porEmpresa).toEqual([
      { faixa: "1 contato", empresas: 2, comAt: 2 },
      { faixa: "2 contatos", empresas: 0, comAt: 0 },
      { faixa: "3 contatos", empresas: 1, comAt: 1 },
      { faixa: "4 a 5 contatos", empresas: 0, comAt: 0 },
      { faixa: "6 ou mais", empresas: 0, comAt: 0 },
    ]);
    expect(r.semEmpresa).toBe(1);
  });

  it("canal da AT e mensagem que gerou a resposta", () => {
    expect(r.canais.map((c) => [c.rotulo, c.ats, c.realizadas, c.avancaram])).toEqual([
      ["E-mail", 1, 1, 0],
      ["LinkedIn", 1, 1, 1],
      ["WhatsApp", 1, 1, 0],
      ["Não informado", 1, 0, 0],
    ]);
    expect(r.mensagens.map((m) => [m.rotulo, m.ats])).toEqual([
      ["LinkedIn 1", 1],
      ["WhatsApp 1", 1],
      ["Outro canal", 1],
      ["Não informada", 1],
    ]);
  });

  it("safra × setor alocado com todas as safras", () => {
    expect(r.safraSetor.setores.map((s) => s.nome)).toEqual(["Saúde", "Varejo", "Sem alocação"]);
    const [s1, s2, s3, s4] = r.safraSetor.linhas;
    expect(s1).toMatchObject({
      numero: 1,
      madura: true,
      celulas: { varejo: { contatos: 4, comAt: 3 } },
    });
    expect(Object.values(s2!.celulas)).toEqual([{ contatos: 2, comAt: 1 }]);
    expect(s3).toMatchObject({ madura: false, celulas: { saude: { contatos: 1, comAt: 1 } } });
    expect(s4!.celulas).toEqual({});
  });
});

describe("testes A/B", () => {
  const SAFRAS_IDS = SAFRAS.map(({ id, numero }) => ({ id, numero }));
  const form = {
    nome: "Porte pequeno × médio",
    dimensao: "porte" as const,
    descricao: "",
    safra_inicial_id: "s1",
    safra_final_id: "s2",
    versoes: [
      { rotulo: "A", valores: ["11-50"] },
      { rotulo: "B", valores: ["51-200"] },
    ],
  };

  it("valida o cadastro", () => {
    expect(erroTesteAb(form, SAFRAS_IDS)).toBeNull();
    expect(erroTesteAb({ ...form, nome: " " }, SAFRAS_IDS)).toBe("Dê um nome ao teste.");
    expect(erroTesteAb({ ...form, safra_inicial_id: "s2", safra_final_id: "s1" }, SAFRAS_IDS)).toBe(
      "A safra final vem antes da inicial.",
    );
    expect(erroTesteAb({ ...form, versoes: [form.versoes[0]!] }, SAFRAS_IDS)).toBe(
      "O teste precisa de pelo menos duas versões.",
    );
    expect(
      erroTesteAb(
        { ...form, versoes: [form.versoes[0]!, { rotulo: "a", valores: ["1-10"] }] },
        SAFRAS_IDS,
      ),
    ).toBe("Duas versões com o mesmo nome.");
    expect(
      erroTesteAb(
        { ...form, versoes: [form.versoes[0]!, { rotulo: "B", valores: ["11-50"] }] },
        SAFRAS_IDS,
      ),
    ).toBe("Um mesmo valor está em duas versões: cada contato cai numa só.");
    expect(
      erroTesteAb(
        { ...form, versoes: [form.versoes[0]!, { rotulo: "B", valores: [] }] },
        SAFRAS_IDS,
      ),
    ).toBe("Escolha pelo menos um valor para a versão B.");
  });

  it("lista as opções de cada dimensão", () => {
    const setores = [
      { id: "varejo", name: "Varejo", parent_id: null },
      { id: "moda", name: "Moda", parent_id: "varejo" },
    ];
    expect(opcoesDaDimensao("setor", setores)).toEqual([{ valor: "varejo", rotulo: "Varejo" }]);
    expect(opcoesDaDimensao("subsetor", setores)).toEqual([
      { valor: "moda", rotulo: "Varejo › Moda" },
    ]);
    expect(opcoesDaDimensao("nivel", []).length).toBe(6);
  });

  const teste: AbTeste = {
    id: "t1",
    ...form,
    descricao: null,
    status: "ativo",
    conclusao: null,
  };
  const ctx = {
    hoje: HOJE,
    safras: SAFRAS,
    maturacaoSemanas: 1,
    amostraMinima: 1,
    contatos: CONTATOS,
    empresas: EMPRESAS,
    ats: ATS,
    cards: {},
  };

  it("separa os contatos das safras do teste pelas versões", () => {
    const r = resultadoAb(teste, ctx);
    expect(r.safras).toEqual([1, 2]);
    expect(r.versoes.map((v) => [v.rotulo, v.contatos, v.comAt])).toEqual([
      ["A", 1, 1],
      ["B", 3, 2],
    ]);
    // c5 (e3, sem porte) e c6 (sem empresa) ficam fora.
    expect(r.fora).toBe(2);
    expect(r.conclusivo).toBe(true);
    expect(r.lider).toBe("A");
    expect(r.diferencaPp).toBe(33.3);
    expect(r.significativo).toBe(false);
  });

  it("não é conclusivo sem amostra ou com safra imatura", () => {
    expect(resultadoAb(teste, { ...ctx, amostraMinima: 500 })).toMatchObject({
      conclusivo: false,
      lider: null,
      pendencia: "Amostra mínima de 500 contatos por versão (falta em A, B).",
    });
    expect(resultadoAb({ ...teste, safra_final_id: "s3" }, ctx)).toMatchObject({
      conclusivo: false,
      pendencia: "Nem todas as safras do teste amadureceram.",
    });
  });

  it("teste de duas proporções", () => {
    expect(duasProporcoes({ n: 30, d: 100 }, { n: 10, d: 100 })).toBe(true);
    expect(duasProporcoes({ n: 3, d: 10 }, { n: 2, d: 10 })).toBe(false);
    expect(duasProporcoes({ n: 0, d: 0 }, { n: 1, d: 2 })).toBeNull();
  });
});
