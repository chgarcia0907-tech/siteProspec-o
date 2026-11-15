import { describe, expect, it } from "vitest";
import { DEFAULT_OFFSETS } from "./cadencia";
import {
  businessDaysBetween,
  computeDashboard,
  deltaPct,
  pct,
  presetRange,
  previousRange,
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
  name: "",
  company: "",
  company_id: null,
  phone: "",
  sector: "",
  status: "aguardando",
  created_at: "2026-11-01T12:00:00Z",
  step1_date: null,
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
