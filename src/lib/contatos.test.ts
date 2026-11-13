import { describe, expect, it } from "vitest";
import { DEFAULT_OFFSETS, type Contact } from "./cadencia";
import { CONTACT_STATUSES, contactsCsvRows, filterContacts, withSyncedStatus } from "./contatos";

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
