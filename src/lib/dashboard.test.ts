import { describe, expect, it } from "vitest";
import { DEFAULT_OFFSETS } from "./cadencia";
import {
  clampToCycle,
  businessDaysBetween,
  computeDashboard,
  deltaPct,
  onTimeProgress,
  parseGoalNumber,
  pct,
  presetRange,
  previousRange,
  resolveGoal,
  responseDate,
  templateCode,
  volumeProgress,
  type DashContact,
  type DashInput,
} from "./dashboard";

const H1 = "h1";
const H2 = "h2";
const S1 = "s1";
const CO1 = "co1";

const blank: DashContact = {
  id: "",
  user_id: H1,
  period_id: null,
  sem_whatsapp: false,
  name: "",
  company: "",
  company_id: null,
  phone: "",
  sector: "",
  status: "aguardando",
  created_at: "2026-11-01T12:00:00Z",
  step1_date: null,
  respondeu_em: null,
  resposta_etapa: null,
  resposta_modelo: null,
  sent1_at: null,
  sent2_at: null,
  sent3_at: null,
  sent4_at: null,
  sent5_at: null,
  at_marcada_em: null,
  lead_em: null,
  proposta_em: null,
  aprovacao_em: null,
  vendido_em: null,
  at_registrado_em: null,
  lead_registrado_em: null,
  proposta_registrado_em: null,
  aprovacao_registrado_em: null,
  vendido_registrado_em: null,
};
const ct = (o: Partial<DashContact>): DashContact => ({ ...blank, ...o });

// Hoje é quinta, 12/11/2026; o intervalo é a semana de 09 a 15/11.
const contacts = [
  // Em dia até o WhatsApp 1; LinkedIn 2 previsto para ontem (1 dia útil de atraso).
  ct({
    id: "a",
    name: "Ana",
    company: "Alfa",
    company_id: CO1,
    phone: "11999998888",
    sector: "Tecnologia / TI",
    status: "em_cadencia",
    step1_date: "2026-11-09",
    sent1_at: "2026-11-09",
    sent2_at: "2026-11-10",
  }),
  // Parado desde o LinkedIn 1 da semana passada: WhatsApp 1 atrasado há 7 dias úteis.
  ct({
    id: "b",
    name: "Bia",
    status: "em_cadencia",
    step1_date: "2026-11-02",
    sent1_at: "2026-11-02",
  }),
  // AT registrada nesta semana depois do WhatsApp 1 (sai das filas).
  ct({
    id: "c",
    name: "Caio",
    status: "respondeu",
    step1_date: "2026-11-03",
    sent1_at: "2026-11-03",
    sent2_at: "2026-11-04",
    at_marcada_em: "2026-11-20",
    at_registrado_em: "2026-11-10T13:00:00Z",
  }),
  // Importado nesta semana, ainda sem cadência e sem dados.
  ct({ id: "d", name: "Duda", created_at: "2026-11-10T15:00:00Z" }),
  // Contato de quem está fora do recorte: não entra em nada.
  ct({ id: "x", user_id: "outro", sent1_at: "2026-11-10", step1_date: "2026-11-10" }),
];

const input: DashInput = {
  contacts,
  companies: [
    { id: CO1, user_id: H1, name: "Alfa", sector_id: S1, week_start: "2026-11-09" },
    { id: "co2", user_id: H1, name: "Beta", sector_id: S1, week_start: "2026-11-09" },
  ],
  sectors: [{ id: S1, name: "Varejo", active: true }],
  sectorSteps: { [S1]: [1, 2, 3, 4] },
  hunters: [
    { id: H1, name: "Hunter Um", grupo: "Azul", subgrupo: "" },
    { id: H2, name: "Hunter Dois", grupo: "", subgrupo: "" },
  ],
  offsets: { [H1]: DEFAULT_OFFSETS },
  holidays: new Set(["2026-11-02"]),
  from: "2026-11-09",
  to: "2026-11-15",
  today: "2026-11-12",
};

describe("contato sem WhatsApp no painel", () => {
  it("não cobra telefone nem atraso de WhatsApp", () => {
    const sem = {
      ...input,
      contacts: contacts.map((x) => (x.id === "b" ? { ...x, sem_whatsapp: true } : x)),
    };
    const h = computeDashboard(sem).hunters.find((x) => x.hunter_id === H1)!;
    expect(h.noPhone).toBe(0);
    expect(h.lateList.find((l) => l.name === "Bia")?.step).not.toBe("WhatsApp 1");
  });
});

describe("datas do painel", () => {
  it("conta dias úteis sem fins de semana e feriados", () => {
    expect(businessDaysBetween("2026-11-03", "2026-11-12", new Set())).toBe(7);
    expect(businessDaysBetween("2026-10-30", "2026-11-03", new Set(["2026-11-02"]))).toBe(1);
    expect(businessDaysBetween("2026-11-12", "2026-11-12", new Set())).toBe(0);
  });

  it("compara com o intervalo anterior de mesmo tamanho", () => {
    expect(previousRange("2026-11-09", "2026-11-15")).toEqual({
      from: "2026-11-02",
      to: "2026-11-08",
    });
    expect(previousRange("2026-11-12", "2026-11-12")).toEqual({
      from: "2026-11-11",
      to: "2026-11-11",
    });
  });

  it("variação e percentual sem dividir por zero", () => {
    expect(deltaPct({ value: 3, prev: 2 })).toBe(50);
    expect(deltaPct({ value: 3, prev: 0 })).toBeNull();
    expect(pct(1, 3)).toBe(33.3);
    expect(pct(1, 0)).toBeNull();
  });
});

describe("indicadores", () => {
  const d = computeDashboard(input);
  const h1 = d.hunters.find((h) => h.hunter_id === H1)!;

  it("resume o intervalo e compara com o anterior", () => {
    expect(d.kpis.envios).toEqual({ value: 2, prev: 3 });
    expect(d.kpis.linkedin).toEqual({ value: 1, prev: 2 });
    expect(d.kpis.whatsapp).toEqual({ value: 1, prev: 1 });
    expect(d.kpis.l1).toEqual({ value: 1, prev: 2 });
    expect(d.kpis.ats).toEqual({ value: 1, prev: 0 });
    expect(d.kpis.importados).toEqual({ value: 1, prev: 0 });
    expect(d.kpis.empresas).toEqual({ value: 2, prev: 0 });
    expect(d.kpis.atrasados).toBe(2);
    expect(d.kpis.parados).toBe(1);
  });

  it("conta as conexões (contatos importados no intervalo) de cada hunter", () => {
    expect(h1.importados).toBe(1);
    expect(d.hunters.reduce((n, h) => n + h.importados, 0)).toBe(d.kpis.importados.value);
  });

  it("mostra a execução da cadência por hunter", () => {
    expect(h1.sent).toEqual([1, 1, 0, 0, 0]);
    expect(h1.total).toBe(2);
    expect({ due: h1.due, onTime: h1.onTime }).toEqual({ due: 3, onTime: 2 });
    expect(h1.lateBands).toEqual([1, 0, 1]);
    expect(h1.lateList.map((l) => [l.name, l.step, l.days])).toEqual([
      ["Bia", "WhatsApp 1", 7],
      ["Ana", "LinkedIn 2", 1],
    ]);
    expect(h1.lastSend).toBe("2026-11-10");
    expect(h1.idleDays).toBe(2);
    expect({ inProgress: h1.inProgress, waiting: h1.waiting, noPhone: h1.noPhone }).toEqual({
      inProgress: 2,
      waiting: 1,
      noPhone: 1,
    });
    expect(d.heat.kind).toBe("dia");
    expect(d.heat.buckets).toHaveLength(7);
    expect(h1.heat).toEqual([1, 1, 0, 0, 0, 0, 0]);
    // Hunter sem contatos aparece zerado e não é cobrado como parado.
    expect(d.hunters.find((h) => h.hunter_id === H2)!.total).toBe(0);
  });

  it("no ciclo, pendência prevista antes do início não conta como atrasada", () => {
    // Bia: WhatsApp 1 previsto para antes de 09/11 (fora); Ana: LinkedIn 2 previsto depois (conta).
    const r = computeDashboard({ ...input, lateSince: "2026-11-09" });
    const h = r.hunters.find((x) => x.hunter_id === H1)!;
    expect(r.kpis.atrasados).toBe(1);
    expect(h.lateList.map((l) => l.name)).toEqual(["Ana"]);
    expect(h.lateBands).toEqual([1, 0, 0]);
  });

  it("etapa depois de uma etapa atrasada não conta como devida", () => {
    // LinkedIn 1 em 05/11 e WhatsApp 1 (previsto 06/11) parado: LinkedIn 2, WhatsApp 2 e
    // LinkedIn 3 caem (pela previsão) dentro do intervalo, mas não podem sair antes do WhatsApp 1.
    const late = ct({
      id: "z",
      status: "em_cadencia",
      step1_date: "2026-11-05",
      sent1_at: "2026-11-05",
    });
    const r = computeDashboard({ ...input, contacts: [late] }).hunters.find(
      (h) => h.hunter_id === H1,
    )!;
    expect({ due: r.due, onTime: r.onTime, late: r.late }).toEqual({ due: 0, onTime: 0, late: 1 });
  });

  it("mede o ritmo real entre etapas contra o configurado", () => {
    expect(d.pace[0]).toEqual({ from: "LinkedIn 1", to: "WhatsApp 1", real: 1, planned: 1, n: 1 });
    expect(d.pace[1]!.n).toBe(0);
  });

  it("abastecimento e qualidade dos dados", () => {
    expect(d.supply).toEqual({
      waiting: 1,
      noPhone: 1,
      noCompany: 2,
      noArea: 2,
      companies: 2,
      companiesWithContacts: 1,
      contactsPerCompany: 1,
    });
  });

  it("funil, origem da AT e conversão por setor e área", () => {
    expect(d.funnel[0]).toEqual({ label: "AT marcada", count: 1 });
    expect(d.atOrigin.find((o) => o.count)).toEqual({ label: "WhatsApp 1", count: 1 });
    expect(d.bySector).toEqual([
      { name: "Sem empresa cadastrada", l1: 0, ats: 1 },
      { name: "Varejo", l1: 1, ats: 0 },
    ]);
    expect(d.byArea).toEqual([
      { name: "Sem área", l1: 0, ats: 1 },
      { name: "Tecnologia / TI", l1: 1, ats: 0 },
    ]);
  });

  it("tendência de 12 semanas e coortes", () => {
    expect(d.trend).toHaveLength(12);
    expect(d.trend.at(-1)).toEqual({
      inicio: "2026-11-09",
      envios: 2,
      l1: 1,
      ats: 1,
      respostas: 1,
      importados: 1,
    });
    expect(d.cohorts.at(-2)).toMatchObject({
      inicio: "2026-11-02",
      l1: 2,
      at14: 1,
      at28: 1,
      mature14: false,
    });
  });

  it("alertas do que precisa de ação", () => {
    expect(d.alerts.map((a) => [a.level, a.hunter ?? "", a.text])).toEqual([
      ["alta", "Hunter Um", "1 contatos atrasados há mais de 5 dias úteis"],
      ["media", "Hunter Um", "sem envio há 2 dias úteis"],
      ["media", "Hunter Um", "1 WhatsApps previstos sem telefone cadastrado"],
      ["media", "Hunter Um", "empresa Beta (semana de 09/11/2026) sem nenhum contato"],
      [
        "media",
        "",
        "setor Varejo: cadência sem mensagem própria para LinkedIn 3 (usa o modelo padrão)",
      ],
    ]);
  });
});

describe("atraso pelo cronograma original", () => {
  // WhatsApp 1 previsto para 03/11 e enviado em 10/11: LinkedIn 2 entra na fila em 11/11.
  const tarde = ct({
    id: "t",
    name: "Tadeu",
    status: "em_cadencia",
    step1_date: "2026-10-30",
    sent1_at: "2026-10-30",
    sent2_at: "2026-11-10",
  });
  const lista = (today: string) =>
    computeDashboard({ ...input, contacts: [tarde], today })
      .hunters.find((x) => x.hunter_id === H1)!
      .lateList.map((l) => [l.step, l.planned]);

  it("a etapa seguinte não conta antes do intervalo normal depois do envio atrasado", () => {
    expect(lista("2026-11-10")).toEqual([]);
  });

  it("quando entra na fila, segue atrasada desde a data original", () => {
    expect(lista("2026-11-12")).toEqual([["LinkedIn 2", "2026-11-04"]]);
  });
});

describe("filtros", () => {
  it("canal: conta só as etapas do canal", () => {
    const d = computeDashboard({ ...input, channel: "whatsapp" });
    expect(d.steps.map((s) => s.label)).toEqual(["WhatsApp 1", "WhatsApp 2"]);
    expect(d.kpis.envios.value).toBe(1);
    // O atraso da Ana é no LinkedIn 2: fica fora do filtro de WhatsApp.
    expect(d.hunters[0]!.lateList.map((l) => l.name)).toEqual(["Bia"]);
  });

  it("setor da empresa: só contatos e empresas do setor", () => {
    const d = computeDashboard({ ...input, sectorId: S1 });
    expect(d.kpis.envios.value).toBe(2);
    expect(d.kpis.ats.value).toBe(0);
    expect(d.kpis.atrasados).toBe(1);
  });

  it("intervalo longo agrupa o mapa de calor por semana", () => {
    const d = computeDashboard({ ...input, from: "2026-10-01", to: "2026-11-15" });
    expect(d.heat.kind).toBe("semana");
    expect(d.heat.buckets[0]).toBe("2026-09-28");
  });
});

describe("atalhos de intervalo", () => {
  it.each([
    ["hoje", "2026-11-12", "2026-11-12"],
    ["ontem", "2026-11-11", "2026-11-11"],
    ["semana", "2026-11-09", "2026-11-15"],
    ["semana_passada", "2026-11-02", "2026-11-08"],
    ["30dias", "2026-10-14", "2026-11-12"],
    ["mes", "2026-11-01", "2026-11-30"],
  ] as const)("%s", (preset, from, to) => {
    expect(presetRange(preset, "2026-11-12")).toEqual({ from, to });
  });
  it("mês com 31 dias e virada de ano", () => {
    expect(presetRange("mes", "2026-12-31")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
});

describe("respostas", () => {
  const resp = [
    // Respondeu na quarta depois do LinkedIn 1 de segunda (2 dias úteis).
    ct({
      id: "r1",
      status: "respondeu",
      step1_date: "2026-11-09",
      sent1_at: "2026-11-09",
      respondeu_em: "2026-11-11T15:00:00Z",
    }),
    // AT sem "respondeu": a resposta conta no registro da AT.
    ct({
      id: "r2",
      step1_date: "2026-11-09",
      sent1_at: "2026-11-09",
      sent2_at: "2026-11-10",
      at_marcada_em: "2026-11-20",
      at_registrado_em: "2026-11-12T13:00:00Z",
    }),
    // Marcado como respondeu antes de existir a data: fica fora das contagens por período.
    ct({ id: "r3", status: "respondeu", step1_date: "2026-10-01", sent1_at: "2026-10-01" }),
  ];
  const d = computeDashboard({ ...input, contacts: resp });

  it("data da resposta: a marcada, senão o registro da AT", () => {
    expect(responseDate(resp[0]!)).toBe("2026-11-11");
    expect(responseDate(resp[1]!)).toBe("2026-11-12");
    expect(responseDate(resp[2]!)).toBeNull();
  });

  it("conta respostas, tempo até a resposta e a etapa que gerou", () => {
    expect(d.kpis.respostas).toEqual({ value: 2, prev: 0 });
    expect(d.hunters[0]!.responses).toBe(2);
    expect(d.responseTime).toEqual({ avg: 2.5, n: 2 });
    expect(d.respOrigin.filter((o) => o.count)).toEqual([
      { label: "LinkedIn 1", count: 1 },
      { label: "WhatsApp 1", count: 1 },
    ]);
    expect(d.undatedResponses).toBe(1);
    expect(d.cohorts.at(-1)).toMatchObject({ inicio: "2026-11-09", l1: 2, resp14: 2, at14: 1 });
  });
});

describe("mensagem que gerou a resposta", () => {
  const codes = { defaults: { 1: "L1", 2: "W1" }, sectors: { [S1]: { 2: "W1-varejo", 3: "" } } };
  const contacts = [
    // Hunter informou que o lead respondeu ao LinkedIn 1, apesar do WhatsApp 1 enviado depois.
    ct({
      id: "m1",
      company_id: CO1,
      status: "respondeu",
      step1_date: "2026-11-09",
      sent1_at: "2026-11-09",
      sent2_at: "2026-11-10",
      respondeu_em: "2026-11-11T15:00:00Z",
      resposta_etapa: 1,
      resposta_modelo: "L1-antigo",
    }),
    // AT sem origem informada: vale a última mensagem enviada antes (WhatsApp 1 do setor).
    ct({
      id: "m2",
      company_id: CO1,
      step1_date: "2026-11-09",
      sent1_at: "2026-11-09",
      sent2_at: "2026-11-10",
      at_marcada_em: "2026-11-20",
      at_registrado_em: "2026-11-12T13:00:00Z",
    }),
    // AT vinda de uma ligação (outro canal), sem empresa: modelo padrão nos envios.
    ct({
      id: "m3",
      step1_date: "2026-11-09",
      sent1_at: "2026-11-09",
      at_marcada_em: "2026-11-20",
      at_registrado_em: "2026-11-12T13:00:00Z",
      resposta_etapa: 0,
    }),
  ];
  const d = computeDashboard({ ...input, contacts, templateCodes: codes });

  it("usa a origem informada e, sem ela, a última mensagem enviada", () => {
    expect(d.respOrigin.filter((o) => o.count)).toEqual([
      { label: "Outro canal", count: 1 },
      { label: "LinkedIn 1", count: 1 },
      { label: "WhatsApp 1", count: 1 },
    ]);
    expect(d.atOrigin.filter((o) => o.count)).toEqual([
      { label: "Outro canal", count: 1 },
      { label: "WhatsApp 1", count: 1 },
    ]);
    expect(d.declaredOrigin).toEqual({ responses: 2, ats: 1 });
  });

  it("agrupa respostas e ATs por canal de entrada", () => {
    expect(d.entryChannels).toEqual([
      { channel: "linkedin", label: "LinkedIn", responses: 1, ats: 0 },
      { channel: "whatsapp", label: "WhatsApp", responses: 1, ats: 1 },
      { channel: "outro", label: "Outro canal", responses: 1, ats: 1 },
    ]);
  });

  it("mede cada mensagem pelo modelo, com o código carimbado na resposta", () => {
    expect(d.messages).toEqual([
      { step: "WhatsApp 1", code: "W1-varejo", sent: 2, responses: 1, ats: 1 },
      { step: "LinkedIn 1", code: "L1-antigo", sent: 1, responses: 1, ats: 0 },
      { step: "LinkedIn 1", code: "L1", sent: 2, responses: 0, ats: 0 },
    ]);
  });

  it("código do modelo: o do setor, senão o padrão; sem código, o nome", () => {
    const varejo = { id: S1, name: "Varejo" };
    expect(templateCode(codes, 2, varejo)).toBe("W1-varejo");
    expect(templateCode(codes, 3, varejo)).toBe("Setor Varejo");
    expect(templateCode(codes, 1, varejo)).toBe("L1");
    expect(templateCode(codes, 4, null)).toBe("Padrão");
  });
});

describe("metas", () => {
  it("vale a meta do hunter, senão a do grupo, senão a da equipe, campo a campo", () => {
    const goals = [
      {
        user_id: null,
        group_id: null,
        envios_dia: 10,
        l1_semana: 5,
        ats_semana: 1,
        no_prazo_pct: 80,
      },
      {
        user_id: null,
        group_id: "g1",
        envios_dia: null,
        l1_semana: 8,
        ats_semana: null,
        no_prazo_pct: null,
      },
      {
        user_id: H1,
        group_id: null,
        envios_dia: 20,
        l1_semana: null,
        ats_semana: null,
        no_prazo_pct: null,
      },
    ];
    expect(resolveGoal(goals, H1, "g1")).toEqual({
      envios_dia: 20,
      l1_semana: 8,
      ats_semana: 1,
      no_prazo_pct: 80,
      passos_semana: null,
    });
    expect(resolveGoal(goals, H2, null)).toEqual({
      envios_dia: 10,
      l1_semana: 5,
      ats_semana: 1,
      no_prazo_pct: 80,
      passos_semana: null,
    });
    expect(resolveGoal([], H1, null).envios_dia).toBeNull();
  });

  it("semáforo: meta batida, perto (70%+) ou abaixo", () => {
    expect(volumeProgress(10, 10).status).toBe("ok");
    expect(volumeProgress(7, 10)).toEqual({ real: 7, target: 10, pct: 70, status: "atencao" });
    expect(volumeProgress(6, 10).status).toBe("abaixo");
    expect(onTimeProgress(8, 10, 80).status).toBe("ok");
    expect(onTimeProgress(7, 10, 80).status).toBe("atencao");
    expect(onTimeProgress(6, 10, 80).status).toBe("abaixo");
  });

  // Seg a qui (4 dias úteis) da semana de 09/11: meta diária × 4 e semanal × 4/5.
  const d = computeDashboard({
    ...input,
    hunters: [
      { ...input.hunters[0]!, groupId: "g1" },
      { ...input.hunters[1]!, groupId: null },
    ],
    goals: [
      {
        user_id: null,
        group_id: null,
        envios_dia: 1,
        l1_semana: null,
        ats_semana: 5,
        no_prazo_pct: 80,
      },
      {
        user_id: null,
        group_id: "g1",
        envios_dia: null,
        l1_semana: 5,
        ats_semana: null,
        no_prazo_pct: null,
      },
      {
        user_id: H1,
        group_id: null,
        envios_dia: 2,
        l1_semana: null,
        ats_semana: null,
        no_prazo_pct: null,
      },
    ],
  });
  const h1 = d.hunters.find((h) => h.hunter_id === H1)!;
  const h2 = d.hunters.find((h) => h.hunter_id === H2)!;

  it("converte as metas para o intervalo e compara por hunter", () => {
    expect(d.goals.elapsedDays).toBe(4);
    expect(d.goals.partial).toBe(true);
    expect(h1.goals.envios).toEqual({ real: 2, target: 8, pct: 25, status: "abaixo" });
    expect(h1.goals.l1).toEqual({ real: 1, target: 4, pct: 25, status: "abaixo" });
    expect(h1.goals.ats).toEqual({ real: 1, target: 4, pct: 25, status: "abaixo" });
    expect(h1.goals.noPrazo).toEqual({ real: 66.7, target: 80, pct: 83, status: "abaixo" });
    expect(h2.goals.l1).toBeNull();
    expect(h2.goals.noPrazo).toBeNull(); // nada previsto no intervalo
  });

  it("soma a equipe e conta quem bate cada meta", () => {
    expect(d.goals.team.envios).toEqual({ real: 2, target: 12, pct: 17, status: "abaixo" });
    expect(d.goals.onTarget.envios).toEqual({ ok: 0, total: 2 });
    expect(d.goals.onTarget.l1).toEqual({ ok: 0, total: 1 });
    expect(d.alerts.map((a) => a.text)).toContain("abaixo da meta de ATs: 1 de 4 (25%)");
  });

  it("meta de envios não vale com filtro de canal", () => {
    const w = computeDashboard({
      ...input,
      channel: "whatsapp",
      goals: [
        {
          user_id: null,
          group_id: null,
          envios_dia: 1,
          l1_semana: null,
          ats_semana: null,
          no_prazo_pct: null,
        },
      ],
    });
    expect(w.hunters[0]!.goals.envios).toBeNull();
  });
});

describe("campo de meta", () => {
  it.each([
    ["", null],
    ["  ", null],
    ["20", 20],
    ["1,5", 1.5],
    ["0.5", 0.5],
    ["-2", undefined],
    ["dez", undefined],
  ] as const)("%j", (text, value) => expect(parseGoalNumber(text)).toBe(value));
});

describe("clampToCycle", () => {
  const ciclo = { start: "2026-11-09", end: null };
  it("não deixa o intervalo começar antes do ciclo", () => {
    expect(clampToCycle({ from: "2026-10-18", to: "2026-11-16" }, ciclo)).toEqual({
      from: "2026-11-09",
      to: "2026-11-16",
    });
    expect(clampToCycle({ from: "2026-11-16", to: "2026-11-22" }, ciclo)).toEqual({
      from: "2026-11-16",
      to: "2026-11-22",
    });
  });
  it("corta no fim de um ciclo encerrado e devolve null fora dele", () => {
    const fechado = { start: "2026-11-09", end: "2026-11-30" };
    expect(clampToCycle({ from: "2026-11-20", to: "2026-12-10" }, fechado)).toEqual({
      from: "2026-11-20",
      to: "2026-11-30",
    });
    expect(clampToCycle({ from: "2026-11-02", to: "2026-11-08" }, ciclo)).toBeNull();
  });
});
