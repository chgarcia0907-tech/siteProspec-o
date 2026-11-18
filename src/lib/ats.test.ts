import { describe, expect, it } from "vitest";
import {
  antecedenciaDias,
  canalDaFicha,
  contarAts,
  contarAtsPor,
  contatoDaAt,
  dataDaFicha,
  lerFicha,
  mensagemQueConverteu,
  pessoaDaMarcacao,
  remarcacoesPorAt,
  resumoAt,
  statusExibido,
  type AtEvento,
  type PessoaTime,
} from "./ats";

const HOJE = "2026-11-16";

// Fichas reais da planilha "Registro de ATs - NTec" (aba ATs, coluna "Ficha original").
const FICHA_MANGELS = `Ficha de AT - Mangels

Nome do prospect: Palma Recchia Gibeli
Cargo: Consultora de RH
Setor: Indústria
Site da empresa: http://www.mangels.com.br/
LinkedIn: https://www.linkedin.com/in/palma-recchia-gibeli-3065277
Canal de Contato: Email
Data: 20/11/2026 às 10:00

Por que prospectou? A empresa é uma empresa relevante no setor industrial no segmento de peças para automóveis com um grande potencial de processos que necessitam de integração e automação
@Augustus Rivas`;

const FICHA_PLASZOM = `Ficha de AT - Plaszom Embalagens

Nome do prospect: Patricia Ronsani
Cargo: Coordenadora
Setor: Indústria
Site da empresa: https://www.tecnologiaplaszom.plaszom.com.br/#
LinkedIn: https://www.linkedin.com/in/patricia-ronsani-46b1a8174?utm_source=share_via&utm_content=profile&utm_medium=member_ios
Canal de Contato: WhatsApp
Data: 25/11 - 14h

Por que prospectou? A empresa figura entre as maiores fabricantes de embalagens e recipientes no Brasil. No meio da indústria, existem dores relacionadas a otimização de processos. Os contatos oferecidos eram promissores em termos de resposta.

@Sophia Labadaseea`;

const TIME: PessoaTime[] = [
  {
    login: "augustus.rivas",
    nome: "Augustus Rivas",
    papel: "cn",
    apelidos: ["Augustus", "Augustus Rivas"],
    ativo: true,
  },
  {
    login: "sophia.labadessa",
    nome: "Sophia Labadessa",
    papel: "cn",
    apelidos: ["Sophia", "Sophia Labadessa", "Sophia Labadaseea", "Sosie"],
    ativo: true,
  },
  {
    login: "gabriel.a",
    nome: "Gabriel Alves",
    papel: "hunter",
    apelidos: ["Gabriel"],
    ativo: true,
  },
  {
    login: "gabriel.b",
    nome: "Gabriel Brito",
    papel: "hunter",
    apelidos: ["Gabriel"],
    ativo: true,
  },
  { login: "ex.cn", nome: "Ex CN", papel: "cn", apelidos: ["Ex"], ativo: false },
];

let seq = 0;
const ev = (
  evento: AtEvento["evento"],
  ocorrido_em: string,
  extra: Partial<AtEvento> = {},
): AtEvento => ({
  evento,
  ocorrido_em,
  created_at: `2026-11-18T00:00:${String(seq++ % 60).padStart(2, "0")}Z`,
  horario_novo: null,
  ...extra,
});

describe("lerFicha", () => {
  it("lê a ficha de AT com data completa", () => {
    const f = lerFicha(FICHA_MANGELS, HOJE);
    expect(f).toMatchObject({
      tipo: "at",
      empresa: "Mangels",
      prospect: "Palma Recchia Gibeli",
      cargo: "Consultora de RH",
      setor: "Indústria",
      site: "http://www.mangels.com.br/",
      linkedin: "https://www.linkedin.com/in/palma-recchia-gibeli-3065277",
      canal: "E-mail",
      mensagem: "",
      agendada: "2026-11-20T10:00:00-03:00",
      cnMarcacao: "Augustus Rivas",
    });
    expect(f?.tipo === "at" && f.motivo).toMatch(/^A empresa é uma empresa relevante.*automação$/);
  });

  it("lê a ficha com data sem ano, linha em branco antes do @ e URL com parâmetros", () => {
    const f = lerFicha(FICHA_PLASZOM, HOJE);
    expect(f).toMatchObject({
      tipo: "at",
      empresa: "Plaszom Embalagens",
      canal: "WhatsApp",
      agendada: "2026-11-25T14:00:00-03:00",
      cnMarcacao: "Sophia Labadaseea",
    });
    expect(f?.tipo === "at" && f.linkedin).toContain("utm_medium=member_ios");
    expect(f?.tipo === "at" && f.motivo).toMatch(/promissores em termos de resposta\.$/);
  });

  it("aceita emoji, caixa e acento diferentes nos rótulos e motivo em várias linhas", () => {
    const f = lerFicha(
      `📌 FICHA DE AT – Coca-Cola FEMSA
• nome do prospect : João da Silva
CANAL DE CONTATO: LinkedIn - respondeu ao FUP 2
data: qui 19/11 9h30
Por que prospectou?
Linha 1
Linha 2
@Sosie`,
      HOJE,
    );
    expect(f).toMatchObject({
      empresa: "Coca-Cola FEMSA",
      prospect: "João da Silva",
      canal: "LinkedIn",
      mensagem: "respondeu ao FUP 2",
      agendada: "2026-11-19T09:30:00-03:00",
      motivo: "Linha 1\nLinha 2",
      cnMarcacao: "Sosie",
    });
  });

  it("lê a ficha de remarcação", () => {
    const f = lerFicha(
      `Ficha de Remarcação - Mangels

Prospect: Palma Recchia Gibeli
Nova data: 27/11 às 15h
Motivo: prospect viajou`,
      HOJE,
    );
    expect(f).toMatchObject({
      tipo: "remarcacao",
      empresa: "Mangels",
      prospect: "Palma Recchia Gibeli",
      agendada: "2026-11-27T15:00:00-03:00",
      motivo: "prospect viajou",
    });
  });

  it("deixa a data em branco quando a ficha não é clara", () => {
    const f = lerFicha("Ficha de AT - X\nNome do prospect: Y\nData: amanhã 10h", HOJE);
    expect(f).toMatchObject({ agendada: null, dataTexto: "amanhã 10h" });
  });

  it("ignora texto que não é ficha", () => {
    expect(lerFicha("Bom dia, pessoal!", HOJE)).toBeNull();
    expect(lerFicha("", HOJE)).toBeNull();
  });
});

describe("dataDaFicha", () => {
  it.each([
    ["20/11/2026 às 10:00", "2026-11-20T10:00:00-03:00"],
    ["25/11 - 14h", "2026-11-25T14:00:00-03:00"],
    ["qui 19/11 9h30", "2026-11-19T09:30:00-03:00"],
    ["19/11/26 9:05", "2026-11-19T09:05:00-03:00"],
  ])("%s", (texto, esperado) => expect(dataDaFicha(texto, HOJE)).toBe(esperado));

  it("vira o ano para ficha de janeiro registrada em dezembro", () => {
    expect(dataDaFicha("08/01 às 10h", "2026-12-20")).toBe("2027-01-08T10:00:00-03:00");
  });

  it.each(["amanhã 10h", "19/11", "19/11 ou 20/11 às 10h", "31/02 às 10h", "19/11 às 25h"])(
    "não adivinha: %s",
    (texto) => expect(dataDaFicha(texto, HOJE)).toBeNull(),
  );
});

describe("canalDaFicha", () => {
  it.each([
    ["Email", "E-mail", ""],
    ["E-mail (respondeu ao TP1)", "E-mail", "respondeu ao TP1"],
    ["WhatsApp - respondeu (FUP 2)", "WhatsApp", "respondeu (FUP 2)"],
    ["LinkedIn, aceitou a conexão", "LinkedIn", "aceitou a conexão"],
    ["Cold Call", "Cold Call", ""],
    ["Pombo-correio", null, "Pombo-correio"],
  ])("%s", (texto, canal, mensagem) => expect(canalDaFicha(texto)).toEqual({ canal, mensagem }));
});

describe("pessoaDaMarcacao", () => {
  it("acha o CN por nome, apelido ou grafia salva no celular", () => {
    expect(pessoaDaMarcacao("Augustus Rivas", TIME, "cn")).toBe("augustus.rivas");
    expect(pessoaDaMarcacao("sophia labadaseea", TIME, "cn")).toBe("sophia.labadessa");
    expect(pessoaDaMarcacao("Sosie", TIME)).toBe("sophia.labadessa");
  });

  it("não escolhe quando há mais de uma pessoa, ninguém ou só gente inativa", () => {
    expect(pessoaDaMarcacao("Gabriel", TIME)).toBeNull();
    expect(pessoaDaMarcacao("Fulano", TIME)).toBeNull();
    expect(pessoaDaMarcacao("Ex", TIME)).toBeNull();
    expect(pessoaDaMarcacao("Augustus", TIME, "hunter")).toBeNull();
  });
});

describe("contatoDaAt", () => {
  const contatos = [
    { id: "1", name: "Palma Recchia Gibeli", company: "Mangels Industrial" },
    { id: "2", name: "Patrícia Ronsani", company: "" },
    { id: "3", name: "João Silva", company: "Empresa A" },
    { id: "4", name: "João Silva", company: "Empresa B" },
  ];

  it("casa por nome e empresa compatível, ignorando acento", () => {
    expect(contatoDaAt({ prospect: "Palma Recchia Gibeli", empresa: "Mangels" }, contatos)).toBe(
      "1",
    );
    expect(contatoDaAt({ prospect: "Patricia Ronsani", empresa: "Plaszom" }, contatos)).toBe("2");
    expect(contatoDaAt({ prospect: "João Silva", empresa: "Empresa B" }, contatos)).toBe("4");
  });

  it("na dúvida deixa em branco", () => {
    expect(contatoDaAt({ prospect: "João Silva", empresa: "Empresa C" }, contatos)).toBeNull();
    expect(
      contatoDaAt({ prospect: "Palma Recchia Gibeli", empresa: "Outra" }, contatos),
    ).toBeNull();
    expect(contatoDaAt({ prospect: "", empresa: "Mangels" }, contatos)).toBeNull();
  });
});

describe("resumoAt", () => {
  it("segue o evento mais recente de cada tipo, mesmo fora de ordem", () => {
    // Mesmo cenário do teste da migração: realizada chega antes da remarcação anterior a ela.
    const r = resumoAt([
      ev("marcada", "2026-11-18T13:00:00Z", { horario_novo: "2026-11-25T17:00:00Z" }),
      ev("realizada", "2026-11-25T18:00:00Z"),
      ev("remarcada", "2026-11-24T12:00:00Z", { horario_novo: "2026-11-26T17:00:00Z" }),
      ev("etapa_pipedrive", "2026-11-26T19:00:00Z", { pipedrive_stage_id: 31 }),
    ]);
    expect(r).toEqual({
      status: "realizada",
      agendadaAtual: "2026-11-26T17:00:00Z",
      pipedriveStageId: 31,
      remarcacoes: 1,
    });
  });

  it("remarcar depois de um no-show volta para agendada", () => {
    const r = resumoAt([
      ev("marcada", "2026-11-10T13:00:00Z", { horario_novo: "2026-11-12T13:00:00Z" }),
      ev("no_show", "2026-11-12T14:00:00Z"),
      ev("remarcada", "2026-11-13T12:00:00Z", { horario_novo: "2026-11-19T13:00:00Z" }),
    ]);
    expect(r).toMatchObject({ status: "agendada", remarcacoes: 1 });
    expect(statusExibido(r.status, r.remarcacoes)).toBe("Remarcada");
  });

  it("sem eventos fica agendada", () => {
    expect(resumoAt([])).toEqual({
      status: "agendada",
      agendadaAtual: null,
      pipedriveStageId: null,
      remarcacoes: 0,
    });
  });
});

describe("indicadores", () => {
  const ats = [
    { status: "realizada" as const, remarcacoes: 0, canal: "WhatsApp" },
    { status: "realizada" as const, remarcacoes: 2, canal: "WhatsApp" },
    { status: "no_show" as const, remarcacoes: 1, canal: "E-mail" },
    { status: "agendada" as const, remarcacoes: 0, canal: "E-mail" },
    { status: "cancelada" as const, remarcacoes: 0, canal: "WhatsApp" },
  ];

  it("conta desfechos, remarcações e taxas", () => {
    expect(contarAts(ats)).toEqual({
      total: 5,
      agendadas: 1,
      realizadas: 2,
      noShow: 1,
      canceladas: 1,
      remarcadas: 2,
      remarcadasRealizadas: 1,
      taxaShow: 2 / 3,
      taxaNoShow: 1 / 3,
      taxaRemarcacao: 2 / 5,
    });
  });

  it("sem desfecho as taxas ficam nulas", () => {
    expect(contarAts([])).toMatchObject({ taxaShow: null, taxaNoShow: null, taxaRemarcacao: null });
    expect(contarAts([{ status: "agendada", remarcacoes: 0 }]).taxaShow).toBeNull();
  });

  it("agrupa e ordena pelo total", () => {
    const g = contarAtsPor(ats, (a) => a.canal);
    expect(g.map((x) => [x.chave, x.contagem.total])).toEqual([
      ["WhatsApp", 3],
      ["E-mail", 2],
    ]);
  });

  it("conta remarcações por AT", () => {
    const m = remarcacoesPorAt([
      { at_id: "a", evento: "marcada" },
      { at_id: "a", evento: "remarcada" },
      { at_id: "a", evento: "remarcada" },
      { at_id: "b", evento: "no_show" },
    ]);
    expect(m.get("a")).toBe(2);
    expect(m.get("b")).toBeUndefined();
  });
});

describe("utilidades", () => {
  it("mensagem que converteu a partir do contato", () => {
    expect(mensagemQueConverteu({ resposta_etapa: 2, resposta_modelo: "WPP-1" })).toBe(
      "WhatsApp 1 (WPP-1)",
    );
    expect(mensagemQueConverteu({ resposta_etapa: 0, resposta_modelo: null })).toBe("Outro canal");
    expect(mensagemQueConverteu({ resposta_etapa: null, resposta_modelo: null })).toBeNull();
  });

  it("antecedência em dias corridos no fuso de São Paulo", () => {
    // Registrada às 23h de SP do dia 16 (02h UTC do dia 17), AT no dia 20.
    expect(antecedenciaDias("2026-11-17T02:00:00Z", "2026-11-20T13:00:00Z")).toBe(4);
  });
});
