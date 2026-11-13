import { describe, expect, it } from "vitest";
import { DEFAULT_OFFSETS, STEPS, type Contact } from "./cadencia";
import { buildQueues, markSentPatch, missingForMessage } from "./fila";

let id = 0;
const c = (over: Partial<Contact>) =>
  ({
    id: String(++id),
    name: `C${id}`,
    company: "Empresa",
    sector: "Indústria",
    job_title: "CEO",
    status: "aguardando",
    step1_date: null,
    sent1_at: null,
    sent2_at: null,
    sent3_at: null,
    sent4_at: null,
    sent5_at: null,
    at_marcada_em: null,
    ...over,
  }) as Contact;

const names = (q: { contact: Contact }[]) => q.map((x) => x.contact.name);
const REF = "2026-11-12"; // quinta-feira

describe("filas do dia", () => {
  it("LinkedIn 1 sem data entra sem previsão; com data futura não entra", () => {
    const sem = c({ name: "sem-data" });
    const futuro = c({ name: "futuro", step1_date: "2026-11-13" });
    const q = buildQueues([sem, futuro], DEFAULT_OFFSETS, new Set(), REF);
    expect(names(q[1])).toEqual(["sem-data"]);
    expect(q[1][0]!.planned).toBeNull();
  });

  it("atrasados vêm primeiro; um atrasado aparece em toda etapa pendente já vencida", () => {
    const hoje = c({ name: "hoje", step1_date: "2026-11-11", sent1_at: "2026-11-11" });
    const atrasado = c({ name: "atrasado", step1_date: "2026-11-05", sent1_at: "2026-11-05" });
    const q = buildQueues([hoje, atrasado], DEFAULT_OFFSETS, new Set(), REF);
    expect(names(q[2])).toEqual(["atrasado", "hoje"]);
    expect(q[2].map((x) => x.late)).toEqual([true, false]);
    expect(q[1]).toEqual([]);
    expect(names(q[3])).toEqual(["atrasado"]);
  });

  it("ignora quem respondeu, foi descartado ou já tem AT", () => {
    const base = { step1_date: "2026-11-05", sent1_at: "2026-11-05" };
    const q = buildQueues(
      [
        c({ ...base, status: "respondeu" }),
        c({ ...base, status: "descartado" }),
        c({ ...base, at_marcada_em: "2026-11-20" }),
      ],
      DEFAULT_OFFSETS,
      new Set(),
      REF,
    );
    expect(Object.values(q).flat()).toEqual([]);
  });

  it("feriado empurra a previsão para o próximo dia útil", () => {
    const x = c({ step1_date: "2026-11-11", sent1_at: "2026-11-11" });
    const q = buildQueues([x], DEFAULT_OFFSETS, new Set(["2026-11-12"]), REF);
    expect(q[2]).toEqual([]);
  });
});

describe("mensagem e envio", () => {
  it("exige empresa sempre e setor/cargo só no LinkedIn 1", () => {
    expect(missingForMessage(c({ company: " " }), STEPS[1]!)).toBe("empresa");
    expect(missingForMessage(c({ sector: "" }), STEPS[0]!)).toBe("setor_cargo");
    expect(missingForMessage(c({ sector: "" }), STEPS[1]!)).toBeNull();
  });

  it("com o texto do modelo, só exige área e cargo se ele usar as tags", () => {
    const semArea = c({ sector: "" });
    expect(missingForMessage(semArea, STEPS[0]!, "Olá [FIRST NAME]")).toBeNull();
    expect(missingForMessage(semArea, STEPS[0]!, "Dor: [DOR_DO_SETOR]")).toBe("setor_cargo");
    expect(missingForMessage(c({ job_title: "" }), STEPS[0]!, "Como [CARGO]")).toBe("setor_cargo");
  });

  it("marcar LinkedIn 1 define a data da etapa e coloca em cadência", () => {
    expect(markSentPatch(c({}), STEPS[0]!, REF)).toEqual({
      sent1_at: REF,
      step1_date: REF,
      status: "em_cadencia",
    });
  });
});
