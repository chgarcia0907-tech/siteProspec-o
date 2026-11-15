import { describe, expect, it } from "vitest";
import {
  FUNNEL,
  FUNNEL_MAX_POINTS,
  OUTRO_CANAL,
  advancePatch,
  entryChannel,
  funnelIndex,
  needsResponseOrigin,
  responseOriginChoices,
  responseOriginLabel,
  undoPatch,
  type Contact,
} from "./cadencia";
import { COMP_CONTACT_COLUMNS, computeCompetition, type CompContact } from "./competition";

const contato = (over: Partial<Contact> = {}) =>
  ({
    name: "Ana",
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
    ...over,
  }) as Contact;

describe("configuração do funil", () => {
  it("mantém a ordem, os pontos e o total do regulamento", () => {
    expect(FUNNEL.map((f) => [f.label, f.points])).toEqual([
      ["AT marcada", 3],
      ["Lead", 5],
      ["Proposta marcada", 10],
      ["Aprovação verbal", 25],
      ["Projeto vendido", 50],
    ]);
    expect(FUNNEL_MAX_POINTS).toBe(93);
    expect(FUNNEL.map((f) => f.abbr)).toEqual([
      "ATs",
      "Leads",
      "Propostas",
      "Aprov. verbais",
      "Vendidos",
    ]);
  });

  it("toda etapa tem coluna de data e de registro distintas, sem repetição", () => {
    const cols = FUNNEL.flatMap((f) => [f.field, f.registeredField]);
    expect(new Set(cols).size).toBe(cols.length);
    expect(new Set(FUNNEL.map((f) => f.countKey)).size).toBe(FUNNEL.length);
  });

  it("a consulta da competição inclui todas as colunas do funil", () => {
    const cols = COMP_CONTACT_COLUMNS.split(", ");
    for (const f of FUNNEL) {
      expect(cols).toContain(f.field);
      expect(cols).toContain(f.registeredField);
    }
  });
});

describe("avançar e desfazer no funil", () => {
  const now = "2026-11-12T15:00:00.000Z";

  it("marcar uma etapa preenche as anteriores vazias com a mesma data", () => {
    const p = advancePatch(contato(), 2, "2026-11-12", now);
    expect(p).toEqual({
      at_marcada_em: "2026-11-12",
      at_registrado_em: now,
      lead_em: "2026-11-12",
      lead_registrado_em: now,
      proposta_em: "2026-11-12",
      proposta_registrado_em: now,
    });
  });

  it("não sobrescreve etapas já marcadas", () => {
    const c = contato({ at_marcada_em: "2026-11-01", at_registrado_em: "2026-11-01T10:00:00Z" });
    expect(advancePatch(c, 1, "2026-11-12", now)).toEqual({
      lead_em: "2026-11-12",
      lead_registrado_em: now,
    });
  });

  it("desfazer limpa só a última etapa e o seu registro", () => {
    const c = contato({ at_marcada_em: "2026-11-01", lead_em: "2026-11-05" });
    expect(funnelIndex(c)).toBe(1);
    expect(undoPatch(c)).toEqual({ lead_em: null, lead_registrado_em: null });
    expect(undoPatch(contato())).toBeNull();
  });
});

describe("pontuação derivada do funil", () => {
  it("um projeto vendido soma os pontos de todas as etapas e conta em cada contador", () => {
    const vendido = {
      user_id: "a",
      sent1_at: "2026-10-05",
      created_at: "2026-10-05T12:00:00Z",
      ...Object.fromEntries(FUNNEL.map((f) => [f.field, "2026-10-06"])),
    } as CompContact;
    const r = computeCompetition(
      [vendido],
      [{ id: "a", name: "A" }],
      { start: "2026-10-05", end: null },
      "2026-10-10",
    );
    const row = r.rows[0]!;
    expect(row.pontos_funil).toBe(FUNNEL_MAX_POINTS);
    for (const f of FUNNEL) expect(row[f.countKey]).toBe(1);
  });
});

describe("mensagem que gerou a resposta", () => {
  const sem = { status: "em_cadencia", at_marcada_em: null, resposta_etapa: null } as const;

  it("pede a origem ao marcar 'respondeu' ou a primeira AT", () => {
    expect(needsResponseOrigin(sem, { status: "respondeu" })).toBe(true);
    expect(needsResponseOrigin(sem, advancePatch(contato(), 0, "2026-11-12"))).toBe(true);
  });

  it("não pede quando a origem já foi informada ou vem junto", () => {
    expect(needsResponseOrigin({ ...sem, resposta_etapa: 2 }, { status: "respondeu" })).toBe(false);
    expect(needsResponseOrigin(sem, { status: "respondeu", resposta_etapa: 0 })).toBe(false);
  });

  it("não pede para etapas seguintes do funil nem para outras situações", () => {
    const comAt = { ...sem, at_marcada_em: "2026-11-10" };
    expect(needsResponseOrigin(comAt, { lead_em: "2026-11-12" })).toBe(false);
    expect(needsResponseOrigin(sem, { status: "descartado" })).toBe(false);
    expect(needsResponseOrigin({ ...sem, status: "respondeu" }, { status: "respondeu" })).toBe(
      false,
    );
  });

  it("oferece só as etapas enviadas, da mais recente para a primeira", () => {
    const c = contato({ sent1_at: "2026-11-02", sent2_at: "2026-11-03", sent3_at: null });
    expect(responseOriginChoices(c).map((s) => s.label)).toEqual(["WhatsApp 1", "LinkedIn 1"]);
  });

  it("canal e rótulo saem de STEPS; 0 é outro canal", () => {
    expect(entryChannel(2)).toBe("whatsapp");
    expect(entryChannel(5)).toBe("linkedin");
    expect(entryChannel(OUTRO_CANAL)).toBe("outro");
    expect(responseOriginLabel(3)).toBe("LinkedIn 2");
    expect(responseOriginLabel(OUTRO_CANAL)).toBe("Outro canal");
  });
});
