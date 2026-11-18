import { describe, expect, it } from "vitest";
import { DEFAULT_OFFSETS, type Contact } from "./cadencia";
import {
  CONTACT_STATUSES,
  cadenceMarks,
  contactsCsvRows,
  filterContacts,
  manualAtError,
  manualAtRow,
  nextSend,
  sameNameContacts,
  statusOptions,
  withSyncedStatus,
} from "./contatos";

const c = (over: Partial<Contact>) =>
  ({
    id: "1",
    name: "José Álvares",
    company: "Ação Ltda",
    headline: "",
    phone: "",
    connected_at: null,
    status: "aguardando",
    step1_date: null,
    sent1_at: null,
    sent2_at: null,
    sent3_at: null,
    sent4_at: null,
    sent5_at: null,
    ...over,
  }) as Contact;

describe("contatos", () => {
  it("mantém a ordem das situações", () => {
    expect(CONTACT_STATUSES).toEqual([
      "aguardando",
      "em_cadencia",
      "respondeu",
      "concluido",
      "descartado",
    ]);
  });

  it("busca sem acento e sem diferenciar maiúsculas, em nome ou empresa", () => {
    const list = [
      c({ id: "1" }),
      c({ id: "2", name: "Maria", company: "Beta", status: "descartado" }),
    ];
    expect(filterContacts(list, "  jose ", "todos").map((x) => x.id)).toEqual(["1"]);
    expect(filterContacts(list, "acao", "todos").map((x) => x.id)).toEqual(["1"]);
    expect(filterContacts(list, "", "descartado").map((x) => x.id)).toEqual(["2"]);
  });

  it("filtra pela situação calculada, a mesma do selo, e não pela gravada", () => {
    // Gravado como "aguardando", mas com o LinkedIn 1 enviado: o selo mostra "em cadência".
    const desatualizado = c({ id: "1", sent1_at: "2026-11-03", step1_date: "2026-11-03" });
    const todas = c({
      id: "2",
      status: "em_cadencia",
      sent1_at: "2026-11-03",
      sent2_at: "2026-11-04",
      sent3_at: "2026-11-05",
      sent4_at: "2026-11-06",
      sent5_at: "2026-11-09",
    });
    const list = [desatualizado, todas];
    expect(filterContacts(list, "", "em_cadencia").map((x) => x.id)).toEqual(["1"]);
    expect(filterContacts(list, "", "aguardando")).toEqual([]);
    expect(filterContacts(list, "", "concluido").map((x) => x.id)).toEqual(["2"]);
  });

  it("filtra contatos sem empresa ou sem área", () => {
    const list = [
      c({ id: "1", company: "", company_id: null, sector: "RH" }),
      c({ id: "2", company: "Beta", company_id: null, sector: "" }),
      c({ id: "3", company: "Delta", company_id: "d", sector: "" }),
      c({ id: "4", company: "Gama", company_id: null, sector: "RH" }),
    ];
    const ids = (m: "todos" | "empresa" | "area") =>
      filterContacts(list, "", "todos", m).map((x) => x.id);
    expect(ids("empresa")).toEqual(["1"]);
    expect(ids("area")).toEqual(["2", "3"]);
    expect(ids("todos")).toEqual(["1", "2", "3", "4"]);
  });

  it("acrescenta a situação só quando ela muda", () => {
    expect(withSyncedStatus(c({}), { sent1_at: "2026-11-12" })).toEqual({
      sent1_at: "2026-11-12",
      status: "em_cadencia",
    });
    expect(withSyncedStatus(c({}), { company: "Nova" })).toEqual({ company: "Nova" });
  });

  it("gera o CSV com etapas previstas e enviadas", () => {
    const [header, row] = contactsCsvRows(
      [c({ step1_date: "2026-11-09", sent1_at: "2026-11-09" })],
      DEFAULT_OFFSETS,
      new Set(),
    );
    expect(header!.slice(5, 7)).toEqual(["LinkedIn 1 prevista", "LinkedIn 1 enviada"]);
    expect(row!.slice(5, 9)).toEqual(["09/11/2026", "09/11/2026", "10/11/2026", "—"]);
    expect(row!.at(-1)).toBe("Em cadência");
  });
});

describe("opções de situação na edição", () => {
  it("não oferece 'descartado' (recusa vira resposta negativa)", () => {
    expect(statusOptions("em_cadencia")).toEqual([
      "aguardando",
      "em_cadencia",
      "respondeu",
      "concluido",
    ]);
  });

  it("mantém 'descartado' para quem já está descartado", () => {
    expect(statusOptions("descartado")).toContain("descartado");
  });
});

describe("próximo envio e marcadores da cadência", () => {
  const hoje = "2026-11-12"; // quinta
  const sem = new Set<string>();

  it("aponta a primeira etapa não enviada, com a data prevista", () => {
    const x = c({ status: "em_cadencia", step1_date: "2026-11-10", sent1_at: "2026-11-10" });
    const n = nextSend(x, DEFAULT_OFFSETS, sem, hoje)!;
    expect(n.step.n).toBe(2);
    expect(n.date).toBe("2026-11-11");
    expect(n.late).toBe(true);
    expect(cadenceMarks(x, n)).toEqual(["enviada", "atrasada", "futura", "futura", "futura"]);
  });

  it("no prazo é a próxima; LinkedIn 1 sem data fica sem data e não atrasa", () => {
    const noPrazo = c({ status: "em_cadencia", step1_date: hoje, sent1_at: hoje });
    expect(cadenceMarks(noPrazo, nextSend(noPrazo, DEFAULT_OFFSETS, sem, hoje))).toEqual([
      "enviada",
      "proxima",
      "futura",
      "futura",
      "futura",
    ]);
    const semData = nextSend(c({}), DEFAULT_OFFSETS, sem, hoje)!;
    expect(semData).toMatchObject({ date: null, late: false });
    expect(semData.step.n).toBe(1);
  });

  it("não há próximo envio para quem respondeu, descartou, marcou AT ou concluiu", () => {
    const enviados = {
      step1_date: "2026-11-02",
      sent1_at: "2026-11-02",
      sent2_at: "2026-11-03",
      sent3_at: "2026-11-04",
      sent4_at: "2026-11-05",
      sent5_at: "2026-11-06",
    };
    for (const x of [
      c({ status: "respondeu", step1_date: hoje }),
      c({ status: "descartado", step1_date: hoje }),
      c({ status: "em_cadencia", step1_date: hoje, at_marcada_em: hoje }),
      c({ status: "concluido", ...enviados }),
    ])
      expect(nextSend(x, DEFAULT_OFFSETS, sem, hoje)).toBeNull();
    const concluido = c({ status: "concluido", ...enviados });
    expect(cadenceMarks(concluido, null)).toEqual(Array(5).fill("enviada"));
  });
});

describe("contato manual com AT por e-mail", () => {
  const base = {
    name: "  Maria Souza ",
    job_title: " Diretora ",
    sector: "TI",
    phone: "",
    company_id: null,
    company: " Acme ",
    atDate: "2026-11-10",
  };

  it("exige nome e data da AT; a data pode ser futura (reunião agendada)", () => {
    expect(manualAtError(base)).toBeNull();
    expect(manualAtError({ ...base, atDate: "2026-11-18" })).toBeNull();
    expect(manualAtError({ ...base, name: "  " })).toMatch(/nome/);
    expect(manualAtError({ ...base, atDate: "" })).toMatch(/data da AT/);
  });

  it("acha contato de mesmo nome sem considerar acento nem caixa", () => {
    const lista = [c({ id: "1", name: "José Álvares" }), c({ id: "2", name: "Outra Pessoa" })];
    expect(sameNameContacts(lista, " jose alvares ").map((x) => x.id)).toEqual(["1"]);
    expect(sameNameContacts(lista, "")).toEqual([]);
  });

  it("monta a linha como respondeu, com AT registrada e origem em outro canal", () => {
    const row = manualAtRow(base, "2026-11-12T15:00:00.000Z");
    expect(row).toMatchObject({
      name: "Maria Souza",
      job_title: "Diretora",
      company: "Acme",
      status: "respondeu",
      at_marcada_em: "2026-11-10",
      at_registrado_em: "2026-11-12T15:00:00.000Z",
      resposta_etapa: 0,
    });
  });

  it("com empresa cadastrada, não envia o texto livre (o trigger copia o nome)", () => {
    const row = manualAtRow({ ...base, company_id: "co-1" });
    expect(row.company_id).toBe("co-1");
    expect("company" in row).toBe(false);
  });
});
