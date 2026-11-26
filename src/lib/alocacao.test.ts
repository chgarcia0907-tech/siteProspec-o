import { describe, expect, it } from "vitest";
import {
  alocacaoDoContato,
  alocacaoLimpa,
  alocacaoVazia,
  alocacaoVigente,
  alocacoesAtuais,
  copiarAlocacoes,
  diasParaTroca,
  duplasDaSafra,
  duplasSugeridas,
  linhasDaAlocacao,
  safraPadraoDaAlocacao,
  erroAlocacao,
  erroDuranteSafra,
  mesmaAlocacao,
  metasDaSafra,
  modoEdicao,
  parceiroDaDupla,
  semMeta,
  trocaDeSetor,
  type Alocacao,
  type AlocacaoForm,
} from "./alocacao";
import { PORTES, isPorte, porteDoPipedrive } from "./empresas";

const S3 = { id: "s3", inicio: "2026-11-23", usa_alocacao: true };
const S4 = { id: "s4", inicio: "2026-11-30", usa_alocacao: true };
const VAREJO = "varejo";
const INDUSTRIA = "industria";
const METALURGIA = "metalurgia";
const PAI = new Map([[METALURGIA, INDUSTRIA]]);

let seq = 0;
const aloc = (o: Partial<Alocacao>): Alocacao => ({
  id: `a${++seq}`,
  safra_id: S3.id,
  user_id: "ana",
  sector_id: VAREJO,
  subsector_id: null,
  dupla: null,
  meta_empresas: 10,
  meta_contatos: 40,
  motivo_meta_zero: null,
  vigente_desde: S3.inicio,
  ...o,
});

// Ana troca de Varejo para Indústria › Metalurgia na quarta (25/11).
const ANA_SEG = aloc({ dupla: "D1" });
const ANA_QUA = aloc({
  sector_id: INDUSTRIA,
  subsector_id: METALURGIA,
  dupla: "D1",
  meta_contatos: 50,
  vigente_desde: "2026-11-25",
});
const BRUNO = aloc({ user_id: "bruno", dupla: "D1" });
const CAIO_PROVA = aloc({
  user_id: "caio",
  meta_empresas: 0,
  meta_contatos: 0,
  motivo_meta_zero: "Semana de provas",
});
const TODAS = [ANA_QUA, ANA_SEG, BRUNO, CAIO_PROVA];

describe("alocação vigente", () => {
  it("troca de setor na quarta: cada contato fica no setor do dia em que foi criado", () => {
    // Critério de aceite da spec: duas linhas, os contatos de cada período com o setor certo.
    const contato = (created_at: string) => ({ user_id: "ana", created_at });
    expect(alocacaoDoContato(contato("2026-11-24T15:00:00Z"), S3.id, TODAS)?.sector_id).toBe(
      VAREJO,
    );
    expect(alocacaoDoContato(contato("2026-11-25T15:00:00Z"), S3.id, TODAS)?.sector_id).toBe(
      INDUSTRIA,
    );
    // Domingo ainda é da semana e fica com a última vigência.
    expect(alocacaoDoContato(contato("2026-11-29T15:00:00Z"), S3.id, TODAS)?.subsector_id).toBe(
      METALURGIA,
    );
  });

  it("dia antes da primeira vigência fica com a primeira linha", () => {
    const tarde = aloc({ user_id: "dani", vigente_desde: "2026-11-24" });
    expect(alocacaoVigente([tarde], S3.id, "dani", "2026-11-23")).toBe(tarde);
  });

  it("hunter sem alocação na safra não tem linha vigente", () => {
    expect(alocacaoVigente(TODAS, S3.id, "zé", "2026-11-24")).toBeNull();
    expect(alocacaoVigente(TODAS, S4.id, "ana", "2026-12-01")).toBeNull();
  });

  it("as metas da safra são as da linha mais recente", () => {
    expect(metasDaSafra(TODAS, S3.id, "ana")).toEqual({ meta_empresas: 10, meta_contatos: 50 });
    expect(metasDaSafra(TODAS, S3.id, "zé")).toBeNull();
  });

  it("a linha atual de cada hunter é a última vigência", () => {
    expect(
      alocacoesAtuais(TODAS, S3.id)
        .map((a) => a.id)
        .sort(),
    ).toEqual([ANA_QUA.id, BRUNO.id, CAIO_PROVA.id].sort());
  });
});

describe("dupla e meta zero", () => {
  it("dupla junta os dois hunters e cada um acha o parceiro", () => {
    expect(duplasDaSafra(TODAS, S3.id).get("D1")).toEqual(["ana", "bruno"]);
    expect(parceiroDaDupla(TODAS, S3.id, "ana")).toBe("bruno");
    expect(parceiroDaDupla(TODAS, S3.id, "caio")).toBeNull();
  });

  it("meta zero marca semana sem prospecção", () => {
    expect(semMeta(CAIO_PROVA)).toBe(true);
    expect(semMeta(BRUNO)).toBe(false);
  });
});

describe("modo de edição", () => {
  it("livre antes da safra, só troca de setor durante, encerrada depois", () => {
    expect(modoEdicao(S3, "2026-11-20")).toBe("livre");
    expect(modoEdicao(S3, "2026-11-23")).toBe("troca_setor");
    expect(modoEdicao(S3, "2026-11-29")).toBe("troca_setor");
    expect(modoEdicao(S3, "2026-11-30")).toBe("encerrada");
  });

  it("a troca começa de hoje até o domingo da safra", () => {
    expect(diasParaTroca(S3, "2026-11-27")).toEqual(["2026-11-27", "2026-11-28", "2026-11-29"]);
    expect(diasParaTroca(S3, "2026-11-20").at(0)).toBe("2026-11-23");
  });

  it("troca de setor cria linha nova com as metas e a dupla da atual", () => {
    expect(trocaDeSetor(BRUNO, { sector_id: INDUSTRIA, subsector_id: null }, "2026-11-26")).toEqual(
      {
        user_id: "bruno",
        sector_id: INDUSTRIA,
        subsector_id: null,
        dupla: "D1",
        meta_empresas: 10,
        meta_contatos: 40,
        motivo_meta_zero: null,
        vigente_desde: "2026-11-26",
      },
    );
    expect(trocaDeSetor(BRUNO, { sector_id: VAREJO, subsector_id: null }, "2026-11-26")).toBeNull();
  });
});

describe("safra em andamento", () => {
  const HOJE = "2026-11-26";

  it("alocação nova vale a partir de hoje; antes da safra, desde a segunda", () => {
    expect(alocacaoVazia("dani", S3, HOJE).vigente_desde).toBe(HOJE);
    expect(alocacaoVazia("dani", S3, "2026-11-20").vigente_desde).toBe(S3.inicio);
    expect(alocacaoVazia("dani", S3).vigente_desde).toBe(S3.inicio);
  });

  it("aloca por inteiro quem ainda está sem setor, a partir de hoje", () => {
    const dani: AlocacaoForm = {
      ...alocacaoVazia("dani", S3, HOJE),
      sector_id: VAREJO,
      dupla: "D2",
      meta_empresas: 5,
      meta_contatos: 20,
    };
    expect(erroDuranteSafra(dani, S3.id, TODAS, HOJE)).toBeNull();
    expect(
      erroDuranteSafra({ ...dani, vigente_desde: "2026-11-28" }, S3.id, TODAS, HOJE),
    ).toBeNull();
    expect(erroDuranteSafra({ ...dani, vigente_desde: S3.inicio }, S3.id, TODAS, HOJE)).toBe(
      "Com a safra em andamento, a alocação vale a partir de hoje.",
    );
  });

  it("quem já tem setor só troca o setor, com as metas e a dupla de antes", () => {
    const troca = trocaDeSetor(BRUNO, { sector_id: INDUSTRIA, subsector_id: null }, HOJE)!;
    expect(erroDuranteSafra(troca, S3.id, TODAS, HOJE)).toBeNull();
    expect(erroDuranteSafra({ ...troca, meta_contatos: 99 }, S3.id, TODAS, HOJE)).toMatch(
      /só o setor muda/,
    );
    expect(erroDuranteSafra({ ...troca, sector_id: VAREJO }, S3.id, TODAS, HOJE)).toMatch(/mesmo/);
    expect(erroDuranteSafra({ ...troca, dupla: "D9" }, S3.id, TODAS, HOJE)).toMatch(
      /só o setor muda/,
    );
    // Linha de outra safra não conta como alocação nesta.
    const naS4 = aloc({ safra_id: S4.id, user_id: "dani" });
    const dani = { ...alocacaoVazia("dani", S3, HOJE), sector_id: INDUSTRIA, meta_contatos: 9 };
    expect(erroDuranteSafra(dani, S3.id, [...TODAS, naS4], HOJE)).toBeNull();
  });
});

describe("validação", () => {
  const base: AlocacaoForm = { ...alocacaoVazia("dani", S3), sector_id: VAREJO, meta_contatos: 30 };

  it("aceita uma alocação completa", () => {
    expect(erroAlocacao(base, S3, TODAS, PAI)).toBeNull();
  });

  it("meta zero exige motivo", () => {
    const zero = { ...base, meta_contatos: 0 };
    expect(erroAlocacao(zero, S3, TODAS, PAI)).toMatch(/motivo/);
    expect(erroAlocacao({ ...zero, motivo_meta_zero: "  " }, S3, TODAS, PAI)).toMatch(/motivo/);
    expect(erroAlocacao({ ...zero, motivo_meta_zero: "Prova" }, S3, TODAS, PAI)).toBeNull();
  });

  it("subsetor precisa ser do setor e a vigência da semana", () => {
    expect(erroAlocacao({ ...base, subsector_id: METALURGIA }, S3, TODAS, PAI)).toMatch(/subsetor/);
    expect(
      erroAlocacao({ ...base, sector_id: INDUSTRIA, subsector_id: METALURGIA }, S3, TODAS, PAI),
    ).toBeNull();
    expect(erroAlocacao({ ...base, vigente_desde: "2026-11-30" }, S3, TODAS, PAI)).toMatch(
      /semana/,
    );
  });

  it("não repete hunter na mesma vigência nem põe três na dupla", () => {
    expect(erroAlocacao({ ...base, user_id: "bruno" }, S3, TODAS, PAI)).toMatch(/já tem alocação/);
    expect(erroAlocacao({ ...base, dupla: " D1 " }, S3, TODAS, PAI)).toBe(
      "A dupla D1 já tem dois hunters nesta safra.",
    );
    // Quem já é da dupla pode continuar nela numa nova vigência.
    const ana = trocaDeSetor(ANA_QUA, { sector_id: VAREJO, subsector_id: null }, "2026-11-27")!;
    expect(erroAlocacao(ana, S3, TODAS, PAI)).toBeNull();
  });

  it("recusa safra sem alocação e metas inválidas", () => {
    expect(erroAlocacao(base, { ...S3, usa_alocacao: false }, TODAS, PAI)).toMatch(/não usa/);
    expect(erroAlocacao({ ...base, meta_empresas: -1 }, S3, TODAS, PAI)).toMatch(/empresas/);
    expect(erroAlocacao({ ...base, sector_id: "" }, S3, TODAS, PAI)).toMatch(/setor/);
  });

  it("limpa a dupla e só guarda o motivo com metas zeradas", () => {
    expect(alocacaoLimpa({ ...base, dupla: "  ", motivo_meta_zero: "x" })).toMatchObject({
      dupla: null,
      motivo_meta_zero: null,
    });
    expect(
      alocacaoLimpa({ ...base, meta_contatos: 0, dupla: " D2 ", motivo_meta_zero: " Prova " }),
    ).toMatchObject({ dupla: "D2", motivo_meta_zero: "Prova" });
  });
});

describe("comparação", () => {
  it("compara campo a campo, depois de limpar dupla e motivo", () => {
    const t = trocaDeSetor(BRUNO, { sector_id: INDUSTRIA, subsector_id: null }, "2026-11-26")!;
    expect(mesmaAlocacao(t, { ...t, dupla: " D1 " })).toBe(true);
    expect(mesmaAlocacao(t, { ...t, meta_contatos: 41 })).toBe(false);
  });
});

describe("copiar da safra anterior", () => {
  it("copia a linha atual de cada hunter a partir da segunda da nova safra", () => {
    const copia = copiarAlocacoes(TODAS, S3, S4);
    expect(copia.map((c) => c.user_id).sort()).toEqual(["ana", "bruno", "caio"]);
    expect(copia.find((c) => c.user_id === "ana")).toMatchObject({
      sector_id: INDUSTRIA,
      subsector_id: METALURGIA,
      meta_contatos: 50,
      vigente_desde: "2026-11-30",
    });
  });

  it("não copia quem já está alocado na nova", () => {
    const jaTem = aloc({ safra_id: S4.id, user_id: "bruno", vigente_desde: S4.inicio });
    expect(copiarAlocacoes([...TODAS, jaTem], S3, S4).map((c) => c.user_id)).not.toContain("bruno");
  });
});

describe("porte", () => {
  it("usa as faixas do Pipedrive", () => {
    expect(PORTES).toHaveLength(8);
    expect(porteDoPipedrive("1,001-5,000")).toBe("1001-5000");
    expect(porteDoPipedrive("10,001+")).toBe("10001+");
    expect(porteDoPipedrive("Não possui - Pessoa Física")).toBeNull();
    expect(isPorte("51-200")).toBe(true);
    expect(isPorte("51 a 200")).toBe(false);
  });
});

describe("tabela de alocação", () => {
  it("uma linha por membro, com a vigência atual e as anteriores", () => {
    const linhas = linhasDaAlocacao(TODAS, S3.id, ["dani", "ana", "bruno"]);
    expect(linhas.map((l) => l.userId)).toEqual(["dani", "ana", "bruno", "caio"]);
    expect(linhas[0]).toEqual({ userId: "dani", atual: null, anteriores: [] });
    expect(linhas[1]!.atual).toBe(ANA_QUA);
    expect(linhas[1]!.anteriores).toEqual([ANA_SEG]);
  });

  it("abre a safra da semana; senão a próxima; senão a última que usa alocação", () => {
    const s1 = { numero: 1, inicio: "2026-11-09", usa_alocacao: false };
    const s2 = { numero: 2, inicio: "2026-11-16", usa_alocacao: false };
    const s3 = { numero: 3, inicio: "2026-11-23", usa_alocacao: true };
    const s4 = { numero: 4, inicio: "2026-11-30", usa_alocacao: true };
    const todas = [s4, s1, s3, s2];
    expect(safraPadraoDaAlocacao(todas, "2026-11-25")).toBe(s3);
    expect(safraPadraoDaAlocacao(todas, "2026-11-12")).toBe(s3); // S01 não usa: a próxima
    expect(safraPadraoDaAlocacao(todas, "2026-12-20")).toBe(s4);
    expect(safraPadraoDaAlocacao([s1, s2], "2026-11-12")).toBe(s1);
    expect(safraPadraoDaAlocacao([], "2026-11-12")).toBeNull();
  });

  it("sugere as duplas já usadas na safra", () => {
    expect(duplasSugeridas(TODAS, S3.id)).toEqual(["D1"]);
  });
});
