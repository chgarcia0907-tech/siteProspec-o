import { describe, expect, it } from "vitest";
import {
  dataHoraBR,
  depoisDoUltimo,
  lerCSV,
  linhasTime,
  planoDeCarga,
  porCabecalho,
  usuarioDoLogin,
} from "./cargaAts";

// Cabeçalhos e linhas reais da planilha "Registro de ATs - NTec" (motivos encurtados).
const CAB_ATS = [
  "ID do card",
  "Link do card",
  "Registrada em",
  "Hunter",
  "CN",
  "Canal",
  "Mensagem que converteu",
  "Empresa",
  "Prospect",
  "Cargo",
  "Setor (como veio)",
  "LinkedIn",
  "Por que prospectou",
  "Data/hora original",
  "Data/hora atual",
  "Remarcações",
  "Status",
  "ID da pessoa",
  "ID da organização",
  "ID task AT",
  "ID task TP1",
  "ID task TP3",
  "ID task TP4",
  "Ficha original",
];
const linhaAt = (v: Partial<Record<string, string>>) =>
  Object.fromEntries(CAB_ATS.map((c) => [c, v[c] ?? ""]));

const MANGELS = linhaAt({
  "ID do card": "94307",
  "Registrada em": "16/11/2026 13:45",
  Hunter: "enzo.camargos",
  CN: "Augustus Rivas",
  Canal: "E-mail",
  Empresa: "Mangels",
  Prospect: "Palma Recchia Gibeli",
  Cargo: "Consultora de RH",
  "Setor (como veio)": "Indústria",
  LinkedIn: "https://www.linkedin.com/in/palma-recchia-gibeli-3065277",
  "Por que prospectou": "Empresa relevante no setor industrial",
  "Data/hora original": "20/11/2026 10:00",
  "Data/hora atual": "20/11/2026 10:00",
  Remarcações: "0",
  Status: "Agendada",
  "ID da pessoa": "67902",
  "ID da organização": "15151",
  "ID task AT": "160032",
  "ID task TP1": "160029",
  "ID task TP3": "160030",
  "ID task TP4": "160031",
  "Ficha original": "Ficha de AT - Mangels\n\nNome do prospect: Palma Recchia Gibeli",
});

const SIMBIOSE = linhaAt({
  "ID do card": "94410",
  "Registrada em": "18/11/2026 13:38",
  Hunter: "mariana.altali",
  CN: "Leonardo Blanco",
  Canal: "LinkedIn",
  Empresa: "Simbiose",
  Prospect: "Artur Soares",
  "Data/hora original": "23/11/2026 09:00",
  "Data/hora atual": "23/11/2026 09:00",
  Remarcações: "0",
  Status: "Agendada",
});

const hist = (
  deal: string,
  quando: string,
  evento: string,
  novo = "",
  anterior = "",
  motivo = "",
) => ({
  Quando: quando,
  "ID do card": deal,
  Empresa: "",
  Prospect: "",
  Evento: evento,
  "Horário anterior": anterior,
  "Horário novo": novo,
  Motivo: motivo,
  Origem: "ficha (skill criar-card)",
});

const TIME = [
  {
    Nome: "Augustus Rivas",
    Papel: "CN",
    Usuário: "augustus.rivas",
    "Apelidos na marcação": "Augustus, Augustus Rivas",
    "ID da opção no campo Hunter": "424",
    "ID de usuário no Pipedrive": "26429856",
    Ativo: "Sim",
  },
  {
    Nome: "Leonardo Blanco",
    Papel: "CN",
    Usuário: "leonardo.blanco",
    "Apelidos na marcação": "Leonardo, Leonardo Blanco",
    "ID da opção no campo Hunter": "575",
    "ID de usuário no Pipedrive": "28949967",
    Ativo: "Sim",
  },
  {
    Nome: "Enzo Camargos",
    Papel: "Hunter",
    Usuário: "enzo.camargos",
    "Apelidos na marcação": "Enzo, Enzo Camargos",
    "ID da opção no campo Hunter": "708",
    "ID de usuário no Pipedrive": "",
    Ativo: "Sim",
  },
];

const PERFIS = [
  { id: "u-enzo", email: "enzo.camargos@polijunior.com.br" },
  { id: "u-aug", email: "augustus.rivas@polijunior.com.br" },
  { id: "u-x", email: null },
];
const CONTATOS = [
  { id: "c-palma", user_id: "u-enzo", name: "Palma Recchia Gibeli", company: "Mangels" },
  { id: "c-outro", user_id: "u-aug", name: "Artur Soares", company: "Simbiose" },
];

describe("lerCSV", () => {
  it("lê aspas, aspas escapadas, vírgula e quebra de linha dentro da célula", () => {
    const csv = '\uFEFFa,b,c\r\n1,"x, y","linha 1\nlinha ""2"""\r\n\r\n2,,\n';
    expect(lerCSV(csv)).toEqual([
      ["a", "b", "c"],
      ["1", "x, y", 'linha 1\nlinha "2"'],
      ["2", "", ""],
    ]);
    expect(porCabecalho(lerCSV(csv))[0]).toEqual({ a: "1", b: "x, y", c: 'linha 1\nlinha "2"' });
  });
});

describe("valores", () => {
  it("data e hora da planilha em Brasília", () => {
    expect(dataHoraBR("16/11/2026 13:45")).toBe("2026-11-16T13:45:00-03:00");
    expect(dataHoraBR("1/2/2027 9:05")).toBe("2027-02-01T09:05:00-03:00");
    expect(dataHoraBR("16/11/2026")).toBe("2026-11-16T00:00:00-03:00");
    expect(dataHoraBR("")).toBeNull();
    expect(dataHoraBR("amanhã")).toBeNull();
  });

  it("um minuto depois do último evento quando empataria", () => {
    const log = [{ ocorrido_em: "2026-11-16T13:45:00-03:00" }];
    expect(depoisDoUltimo(log, "2026-11-16T13:45:00-03:00")).toBe("2026-11-16T13:46:00-03:00");
    expect(depoisDoUltimo(log, "2026-11-20T10:00:00-03:00")).toBe("2026-11-20T10:00:00-03:00");
    expect(depoisDoUltimo([], "2026-11-20T10:00:00-03:00")).toBe("2026-11-20T10:00:00-03:00");
  });

  it("usuário pelo começo do e-mail, só quando é um só", () => {
    expect(usuarioDoLogin("Enzo.Camargos", PERFIS)).toBe("u-enzo");
    expect(usuarioDoLogin("joao.nascimento", PERFIS)).toBeNull();
    expect(
      usuarioDoLogin("ana", [
        { id: "1", email: "ana@a.com" },
        { id: "2", email: "ana@b.com" },
      ]),
    ).toBeNull();
  });

  it("time com papel, apelidos, IDs do Pipedrive e conta", () => {
    expect(linhasTime(TIME, PERFIS)[0]).toEqual({
      login: "augustus.rivas",
      nome: "Augustus Rivas",
      papel: "cn",
      user_id: "u-aug",
      apelidos: ["Augustus", "Augustus Rivas"],
      pipedrive_user_id: 26429856,
      pipedrive_hunter_option_id: 424,
      ativo: true,
    });
    expect(linhasTime(TIME, PERFIS)[2]).toMatchObject({
      papel: "hunter",
      pipedrive_user_id: null,
    });
  });
});

describe("planoDeCarga", () => {
  const base = { time: TIME, perfis: PERFIS, contatos: CONTATOS };

  it("leva a AT da planilha com hunter, CN, contato e IDs do Pipedrive", () => {
    const p = planoDeCarga({
      ...base,
      ats: [MANGELS],
      historico: [hist("94307", "16/11/2026 13:45", "marcada", "20/11/2026 10:00")],
    });
    expect(p.ats).toEqual([
      expect.objectContaining({
        origem: "planilha",
        user_id: "u-enzo",
        hunter_login: "enzo.camargos",
        cn_login: "augustus.rivas",
        contact_id: "c-palma",
        canal: "E-mail",
        empresa: "Mangels",
        agendada_original: "2026-11-20T10:00:00-03:00",
        agendada_atual: "2026-11-20T10:00:00-03:00",
        registrada_em: "2026-11-16T13:45:00-03:00",
        pipedrive_deal_id: 94307,
        pipedrive_person_id: 67902,
        pipedrive_activity_tp4_id: 160031,
        ficha_original: expect.stringContaining("Ficha de AT - Mangels"),
      }),
    ]);
    expect(p.eventos).toEqual([
      {
        pipedrive_deal_id: 94307,
        evento: "marcada",
        ocorrido_em: "2026-11-16T13:45:00-03:00",
        horario_anterior: null,
        horario_novo: "2026-11-20T10:00:00-03:00",
        motivo: null,
        origem: "planilha",
      },
    ]);
    expect(p.avisos.filter((a) => a.startsWith("Card"))).toEqual([]);
  });

  it("avisa o que não acha em vez de adivinhar", () => {
    const p = planoDeCarga({ ...base, ats: [SIMBIOSE], historico: [] });
    expect(p.ats[0]).toMatchObject({
      user_id: null,
      contact_id: null,
      cn_login: "leonardo.blanco",
    });
    expect(p.avisos).toEqual(
      expect.arrayContaining([
        "Card 94410: hunter mariana.altali sem conta na plataforma.",
        'Card 94410: sem "marcada" no Histórico; criada com o registro da AT.',
      ]),
    );
    expect(p.eventos.map((e) => e.evento)).toEqual(["marcada"]);
  });

  it("leva remarcação e desfecho do Histórico e confere com a linha", () => {
    const p = planoDeCarga({
      ...base,
      ats: [
        {
          ...MANGELS,
          "Data/hora atual": "27/11/2026 15:00",
          Remarcações: "1",
          Status: "Realizada",
        },
      ],
      historico: [
        hist("94307", "16/11/2026 13:45", "marcada", "20/11/2026 10:00"),
        hist(
          "94307",
          "19/11/2026 08:00",
          "remarcada",
          "27/11/2026 15:00",
          "20/11/2026 10:00",
          "viagem",
        ),
        hist("94307", "27/11/2026 16:00", "Realizada"),
      ],
    });
    expect(p.eventos.map((e) => [e.evento, e.motivo])).toEqual([
      ["marcada", null],
      ["remarcada", "viagem"],
      ["realizada", null],
    ]);
    expect(p.avisos.filter((a) => a.startsWith("Card"))).toEqual([]);
  });

  it("completa remarcação e desfecho que a planilha tem e o Histórico não", () => {
    const p = planoDeCarga({
      ...base,
      ats: [{ ...MANGELS, "Data/hora atual": "27/11/2026 15:00", Status: "No-show" }],
      historico: [hist("94307", "16/11/2026 13:45", "marcada", "20/11/2026 10:00")],
    });
    expect(p.eventos.map((e) => [e.evento, e.ocorrido_em, e.horario_novo])).toEqual([
      ["marcada", "2026-11-16T13:45:00-03:00", "2026-11-20T10:00:00-03:00"],
      ["remarcada", "2026-11-16T13:46:00-03:00", "2026-11-27T15:00:00-03:00"],
      ["no_show", "2026-11-27T15:00:00-03:00", null],
    ]);
    expect(p.avisos).toEqual(
      expect.arrayContaining([
        "Card 94307: horário atual da planilha sem remarcação no Histórico; remarcação criada.",
        "Card 94307: status No-show sem evento no Histórico; evento criado no horário da AT.",
        "Card 94307: planilha conta 0 remarcação(ões), o Histórico tem 1.",
      ]),
    );
  });

  it("ignora linha sem card, card repetido e evento de card que não está na aba ATs", () => {
    const p = planoDeCarga({
      ...base,
      ats: [MANGELS, MANGELS, { ...MANGELS, "ID do card": "" }],
      historico: [hist("99999", "16/11/2026 13:45", "marcada", "20/11/2026 10:00")],
    });
    expect(p.ats).toHaveLength(1);
    expect(p.avisos).toEqual(
      expect.arrayContaining([
        "ATs, linha 3: card 94307 repetido, ignorada.",
        "ATs, linha 4: sem ID do card, ignorada.",
        "Histórico: card 99999 não está na aba ATs, evento ignorado.",
      ]),
    );
  });
});
