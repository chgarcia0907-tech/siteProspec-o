import { describe, expect, it } from "vitest";
import {
  auditConnections,
  daysBetween,
  normName,
  sortAuditRows,
  type AuditContact,
} from "./auditoria";
import { parseLinkedInConnections } from "./cadencia";

const TODAY = "2026-11-17";
let seq = 0;
const contact = (over: Partial<AuditContact>): AuditContact => ({
  id: String(++seq),
  name: "",
  headline: "",
  connected_at: null,
  created_at: "2026-11-10T15:00:00Z",
  status: "aguardando",
  sent1_at: null,
  ...over,
});
const conn = (name: string, headline = "", connected_at: string | null = "2026-11-15") => ({
  name,
  headline,
  connected_at,
});

describe("auditoria de conexões", () => {
  it("normaliza nomes sem acento e pontuação", () => {
    expect(normName("  José  D'Ávila-Souza ")).toBe("jose d avila souza");
    expect(daysBetween("2026-11-10", TODAY)).toBe(7);
  });

  it("casa por nome+headline, só nome e primeiro+último nome", () => {
    const contacts = [
      contact({ name: "Ana Souza", headline: "CEO na Acme" }),
      contact({ name: "Bruno Lima", headline: "Diretor antigo" }),
      contact({ name: "Carla Pereira", headline: "Gerente" }),
    ];
    const r = auditConnections(
      [
        conn("Ana Souza", "CEO na Acme"),
        conn("Bruno Lima", "Diretor novo"),
        conn("Carla Maria Pereira", "Gerente"),
        conn("Diego Alves", "Sócio"),
      ],
      contacts,
      TODAY,
    );
    expect(r.rows.map((x) => x.kind)).toEqual(["exato", "nome", "aproximado", null]);
    expect(r.importadas).toBe(3);
    expect(r.faltando).toBe(1);
    expect(r.cobertura).toBe(75);
  });

  it("não usa o mesmo contato para duas conexões e prefere o casamento mais forte", () => {
    const contacts = [contact({ name: "Ana Souza", headline: "CEO" })];
    const r = auditConnections(
      [conn("Ana Maria Souza", "Outra"), conn("Ana Souza", "CEO")],
      contacts,
      TODAY,
    );
    expect(r.rows.map((x) => x.kind)).toEqual([null, "exato"]);
  });

  it("não casa nome único de forma aproximada", () => {
    const r = auditConnections([conn("Ana")], [contact({ name: "Ana Souza" })], TODAY);
    expect(r.rows[0]!.match).toBeNull();
  });

  it("conta repetidos do texto uma vez", () => {
    const r = auditConnections([conn("Ana Souza", "CEO"), conn("Ana Souza", "CEO")], [], TODAY);
    expect(r.total).toBe(1);
  });

  it("separa por idade da conexão e informa desde quando falta importar", () => {
    const r = auditConnections(
      [
        conn("A Um", "", "2026-11-16"),
        conn("B Dois", "", "2026-11-01"),
        conn("C Tres", "", "2026-08-01"),
        conn("D Quatro", "", null),
      ],
      [contact({ name: "C Tres", created_at: "2026-11-12T02:00:00Z" })],
      TODAY,
    );
    expect(r.buckets.map((b) => [b.key, b.total, b.faltando])).toEqual([
      ["7d", 1, 1],
      ["30d", 1, 1],
      ["antigas", 1, 0],
      ["sem_data", 1, 1],
    ]);
    expect(r.faltandoDesde).toBe("2026-11-01");
    // 02:00 UTC do dia 12 ainda é dia 11 em São Paulo.
    expect(r.ultimaImportacao).toBe("2026-11-11");
  });

  it("ordena não importadas primeiro e as mais recentes antes", () => {
    const r = auditConnections(
      [
        conn("A Um", "", "2026-10-01"),
        conn("B Dois", "", "2026-11-16"),
        conn("C Tres", "", "2026-11-16"),
      ],
      [contact({ name: "C Tres" })],
      TODAY,
    );
    expect(sortAuditRows(r.rows).map((x) => x.name)).toEqual(["B Dois", "A Um", "C Tres"]);
  });

  it("funciona com o texto colado do LinkedIn", () => {
    const text = [
      "Foto do perfil de Kenny Tan Mei",
      "Kenny Tan Mei",
      "Graduando em Engenharia Elétrica",
      "Conexão feita em 10 de novembro de 2026",
      "Mensagem",
      "Foto do perfil de Maria Silva",
      "Maria Silva",
      "Diretora na Acme",
      "Conexão feita em 16 de novembro de 2026",
      "Mensagem",
    ].join("\n");
    const parsed = parseLinkedInConnections(text, new Date("2026-11-17T12:00:00Z"));
    const r = auditConnections(
      parsed,
      [contact({ name: "Kenny Tan Mei", headline: "Graduando em Engenharia Elétrica" })],
      TODAY,
    );
    expect(r.rows.map((x) => [x.name, x.kind, x.days])).toEqual([
      ["Kenny Tan Mei", "exato", 7],
      ["Maria Silva", null, 1],
    ]);
  });
});
