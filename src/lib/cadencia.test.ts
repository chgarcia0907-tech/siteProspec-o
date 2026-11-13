import { describe, expect, it } from "vitest";
import { DEFAULT_OFFSETS, addBusinessDaysISO, plannedDates } from "./cadencia";

const base = {
  step1_date: null,
  sent1_at: null,
  sent2_at: null,
  sent3_at: null,
  sent4_at: null,
  sent5_at: null,
};

describe("cadência em dias úteis", () => {
  it("envio na sexta: próxima etapa na segunda", () => {
    const p = plannedDates(
      { ...base, step1_date: "2026-10-09", sent1_at: "2026-10-09" },
      DEFAULT_OFFSETS,
    );
    expect(p).toEqual({
      1: "2026-10-09",
      2: "2026-10-12",
      3: "2026-10-13",
      4: "2026-10-14",
      5: "2026-10-15",
    });
  });

  it("envio atrasado no meio recalcula as seguintes", () => {
    const p = plannedDates(
      { ...base, step1_date: "2026-10-09", sent1_at: "2026-10-09", sent2_at: "2026-10-14" },
      DEFAULT_OFFSETS,
    );
    expect(p[3]).toBe("2026-10-15");
    expect(p[4]).toBe("2026-10-16");
    expect(p[5]).toBe("2026-10-19");
  });

  it("envio no sábado conta a partir dele", () => {
    expect(addBusinessDaysISO("2026-10-10", 1)).toBe("2026-10-12");
    expect(addBusinessDaysISO("2026-10-10", 0)).toBe("2026-10-12");
  });

  it("contato atrasado pela regra antiga deixa de estar", () => {
    // Regra antiga: LinkedIn 1 qui 08/10 → WhatsApp 1 sex 09/10, LinkedIn 2 sáb 10/10 (atrasado na segunda).
    const p = plannedDates(
      { ...base, step1_date: "2026-10-08", sent1_at: "2026-10-08", sent2_at: "2026-10-09" },
      DEFAULT_OFFSETS,
    );
    expect(p[3]).toBe("2026-10-12");
    expect(p[3]! < "2026-10-12").toBe(false);
  });
});

describe("feriados", () => {
  const hol = new Set(["2026-10-12"]);
  it("sexta 09/10 → WhatsApp 1 na terça 13/10 (12/10 feriado)", () => {
    const p = plannedDates(
      { ...base, step1_date: "2026-10-09", sent1_at: "2026-10-09" },
      DEFAULT_OFFSETS,
      hol,
    );
    expect(p[2]).toBe("2026-10-13");
    expect(p[3]).toBe("2026-10-14");
  });
  it("LinkedIn 1 prevista no feriado vai para o próximo útil", () => {
    expect(plannedDates({ ...base, step1_date: "2026-10-12" }, DEFAULT_OFFSETS, hol)[1]).toBe(
      "2026-10-13",
    );
  });
});

import { parseLinkedInConnections, parseConnectionDate } from "./cadencia";

describe("parser do LinkedIn", () => {
  const now = new Date("2026-10-13T15:00:00Z"); // 13/10/2026 12h SP

  it("lê vários contatos com Ctrl+A e botão 'Enviar mensagem'", () => {
    const text = `Pular para o conteúdo principal
Início
Minha rede
1.234 conexões
Classificar por: Adicionados recentementeAdicionados recentemente
Pesquisar com filtros
Foto do perfil de Ana Souza
Ana Souza
Analista de Vendas na ACME
Conexão feita em 12 de outubro de 2026
Enviar mensagem
Mais
Foto do perfil de Bruno Lima, MBA
Bruno Lima, MBA
--
Conexão feita há 2 dias
Enviar mensagem
Foto do perfil de Carla Dias
Carla Dias
CEO | Startup
Conexão feita em 28 de set. de 2026
Mensagem`;
    const r = parseLinkedInConnections(text, now);
    expect(r.map((c) => c.name)).toEqual(["Ana Souza", "Bruno Lima", "Carla Dias"]);
    expect(r[0]!.headline).toBe("Analista de Vendas na ACME");
    expect(r[1]!.headline).toBe("");
    expect(r.map((c) => c.connected_at)).toEqual(["2026-10-12", "2026-10-11", "2026-09-28"]);
  });

  it("funciona sem linhas de foto", () => {
    const text = `Ana Souza\nAnalista\nConexão feita em 12 de outubro de 2026\nEnviar mensagem\nBruno Lima\nDev\nConexão feita há 1 semana\nEnviar mensagem`;
    const r = parseLinkedInConnections(text, now);
    expect(r).toEqual([
      { name: "Ana Souza", headline: "Analista", connected_at: "2026-10-12" },
      { name: "Bruno Lima", headline: "Dev", connected_at: "2026-10-06" },
    ]);
  });

  it("formato antigo com 'Mensagem' continua funcionando", () => {
    const text = `Foto do perfil de Kenny Tan Mei\nKenny Tan Mei\nGraduando\nConexão feita em 28 de setembro de 2026\nMensagem\nFoto do perfil de Zé\nZé\nDev\nConexão feita em 1 de outubro de 2026\nMensagem`;
    expect(parseLinkedInConnections(text, now).length).toBe(2);
  });

  it("datas relativas e em inglês", () => {
    expect(parseConnectionDate("Conexão feita há 3 horas", now)).toBe("2026-10-13");
    expect(parseConnectionDate("Conexão feita ontem", now)).toBe("2026-10-12");
    expect(parseConnectionDate("Conexão feita há uma semana", now)).toBe("2026-10-06");
    expect(parseConnectionDate("Conexão feita há 1 mês", now)).toBe("2026-09-13");
    expect(parseConnectionDate("Connected on October 5, 2026", now)).toBe("2026-10-05");
    expect(parseConnectionDate("Connected 2 days ago", now)).toBe("2026-10-11");
  });
});

import {
  normalizarNome as _nn,
  cleanName as _cn,
  parseLinkedInConnections as _pl,
} from "./cadencia";
describe("normalizarNome / cleanName", () => {
  it.each([
    ["RENATO F. RODRIGUES", "Renato F. Rodrigues"],
    ["ANA SILVA", "Ana Silva"],
    ["João Mesquita - MBA", "João Mesquita"],
    ["Leandro Rodrigues - PCD", "Leandro Rodrigues"],
    ["Fulano (PMP PMO Consultant)", "Fulano"],
    ["ÂNGELA D'ÁVILA", "Ângela D'Ávila"],
    ["Fiorato's Profile Picture", "Fiorato's Profile Picture"],
    ["LUDWIG VAN BEETHOVEN", "Ludwig van Beethoven"],
    ["Ana-Maria Souza", "Ana-Maria Souza"],
    ["MARIA DA SILVA", "Maria da Silva"],
    ["John McDonald", "John McDonald"],
    ["DE PAULA SANTOS", "De Paula Santos"],
  ])("%s", (a, b) => expect(_cn(a)).toBe(b));
  it("preserva sigla quando há minúsculas", () =>
    expect(_nn("João Mesquita MBA")).toBe("João Mesquita MBA"));
  it("primeira letra após pontuação", () => expect(_nn("(PMP")).toBe("(Pmp"));
  it("apóstrofo longo fica minúsculo", () => expect(_nn("FIORATO'S")).toBe("Fiorato's"));
  it("parser extrai nome da foto", () => {
    const r = _pl(
      "Foto de perfil de Maria Souza\nMaria Souza\nGerente\nConexão feita em 1 de outubro de 2026",
    );
    expect(r.map((c) => c.name)).toEqual(["Maria Souza"]);
    const r2 = _pl(
      "Carlos Fiorato’s profile picture\nCarlos Fiorato\nCEO\nConexão feita em 1 de outubro de 2026",
    );
    expect(r2.map((c) => c.name)).toEqual(["Carlos Fiorato"]);
  });
  it("acessar perfil e ruídos", () => {
    const r = _pl(
      "Classificar por:\nPor:\nAcessar perfil de Nelson A.A última atividade de Nelson foi há 2 dias\nNelson A.\nDiretor\nSalvar no Sales Navigator\nConexão feita em 1 de outubro de 2026",
    );
    expect(r.map((c) => c.name)).toEqual(["Nelson A."]);
  });
});

import { jobTitleFromHeadline as _jt, cargoSemEmpresa as _cse } from "./cadencia";
describe("cargo", () => {
  it.each([
    ["Gerente Comercial na ADA", "Gerente Comercial"],
    ["Diretor Financeiro | ESG | Report GRI", "Diretor Financeiro"],
    ["CEO @ Vellore", "CEO"],
    ["Sales Manager at Bild", "Sales Manager"],
    ["Co-founder - Startup X", "Co-founder"],
    ["Analista Técnico na Ada", "Analista Técnico"],
    ["| Só barra", "| Só barra"],
  ])("%s", (a, b) => expect(_jt(a)).toBe(b));
  it("remove empresa do fim do cargo", () => {
    expect(_cse("Gerente Comercial na ADA", "Ada")).toBe("Gerente Comercial");
    expect(_cse("Diretora no Grupo Bild", "grupo bíld")).toBe("Diretora");
    expect(_cse("Gerente Comercial na ADA", "Outra")).toBe("Gerente Comercial na ADA");
  });
});

import { renderTemplate as _rt } from "./cadencia";
describe("concordância da empresa", () => {
  const h = { name: "H", gender: "m" as const };
  const r = (b: string, company: string, g: "masculino" | "feminino" | "sem_artigo", job = "") =>
    _rt(b, { name: "X", company, company_gender: g, job_title: job }, h);
  it("tags", () => {
    expect(r("[NA_EMPRESA]|[A_EMPRESA]|[DA_EMPRESA]", "Grupo Bild", "masculino")).toBe(
      "no Grupo Bild|o Grupo Bild|do Grupo Bild",
    );
    expect(r("[NA_EMPRESA]|[A_EMPRESA]|[DA_EMPRESA]", "Ada", "feminino")).toBe(
      "na Ada|a Ada|da Ada",
    );
    expect(r("[NA_EMPRESA]|[A_EMPRESA]|[DA_EMPRESA]", "Lojas Americanas", "sem_artigo")).toBe(
      "em Lojas Americanas|Lojas Americanas|de Lojas Americanas",
    );
  });
  it("cargo não repete empresa", () =>
    expect(
      r("atua como [CARGO] [NA_EMPRESA]", "Grupo Bild", "masculino", "Diretor no Grupo Bild"),
    ).toBe("atua como Diretor no Grupo Bild"));
});

import { janelaDeTempo, renderTemplate as rt } from "./cadencia";
describe("janela de tempo da reunião", () => {
  it("segunda a quarta → nos próximos dias", () => {
    expect(janelaDeTempo(new Date("2026-11-02T15:00:00Z"))).toBe("nos próximos dias");
    expect(janelaDeTempo(new Date("2026-11-04T15:00:00Z"))).toBe("nos próximos dias");
  });
  it("quinta a domingo → nas próximas semanas (fuso SP)", () => {
    expect(janelaDeTempo(new Date("2026-11-05T15:00:00Z"))).toBe("nas próximas semanas");
    expect(janelaDeTempo(new Date("2026-11-08T15:00:00Z"))).toBe("nas próximas semanas");
    // quarta 23:30 em SP = quinta 02:30 UTC → ainda quarta
    expect(janelaDeTempo(new Date("2026-11-05T02:30:00Z"))).toBe("nos próximos dias");
  });
  it("texto antigo vira janela", () => {
    const out = rt(
      "Que tal marcarmos na [DIA_SUGERIDO]?",
      { name: "Renato", company: "X" },
      { name: "A", gender: "m" },
      { now: new Date("2026-11-06T15:00:00Z") },
    );
    expect(out).toBe("Que tal marcarmos uma conversa nas próximas semanas?");
  });
});
