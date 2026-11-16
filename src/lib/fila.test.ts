import { describe, expect, it } from "vitest";
import { DEFAULT_OFFSETS, STEPS, type Contact } from "./cadencia";
import {
  buildQueues,
  dayProgress,
  hackathonPeriodIds,
  markSentPatch,
  missingForMessage,
  splitHackathon,
} from "./fila";

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

describe("progresso do dia", () => {
  const ref = "2026-11-12";
  const base = [
    // enviou LinkedIn 1 e WhatsApp 1 hoje: 2 feitos
    c({ id: "a", step1_date: ref, sent1_at: ref, sent2_at: ref, status: "em_cadencia" }),
    // enviado ontem: não conta como feito hoje; WhatsApp 1 vence hoje
    c({ id: "b", step1_date: "2026-11-11", sent1_at: "2026-11-11", status: "em_cadencia" }),
    // nunca começou: entra na fila do LinkedIn 1 sem data
    c({ id: "d" }),
    // WhatsApp 1 previsto para 10/11 e não enviado: atrasado, e as etapas seguintes vencem em cadeia
    c({ id: "e", step1_date: "2026-11-09", sent1_at: "2026-11-09", status: "em_cadencia" }),
  ];

  it("soma os envios do dia e conta cada lead pendente uma vez", () => {
    const queues = buildQueues(base, DEFAULT_OFFSETS, new Set(), ref);
    const itensDoE = Object.values(queues)
      .flat()
      .filter((i) => i.contact.id === "e").length;
    expect(itensDoE).toBeGreaterThan(1); // "e" está em mais de uma fila...
    // ...mas conta uma vez: pendentes "b", "d" e "e", com "e" atrasado.
    expect(dayProgress(base, queues, ref)).toEqual({ done: 2, pending: 3, late: 1, total: 5 });
  });

  it("enviar a etapa atrasada aumenta os feitos sem encolher o total", () => {
    const antes = dayProgress(base, buildQueues(base, DEFAULT_OFFSETS, new Set(), ref), ref);
    const depois = base.map((x) => (x.id === "e" ? { ...x, sent2_at: ref } : x));
    const p = dayProgress(depois, buildQueues(depois, DEFAULT_OFFSETS, new Set(), ref), ref);
    expect(p.done).toBe(antes.done + 1);
    expect(p.total).toBe(antes.total);
  });

  it("sem contatos, tudo zero", () => {
    const queues = buildQueues([], DEFAULT_OFFSETS, new Set(), ref);
    expect(dayProgress([], queues, ref)).toEqual({ done: 0, pending: 0, late: 0, total: 0 });
  });
});

describe("contatos do Hackathon", () => {
  const periods = [
    { id: "hacka-fechado", status: "closed", kind: "competicao" },
    { id: "hacka-ativo", status: "active", kind: "competicao" },
    { id: "ciclo", status: "active", kind: "ciclo" },
  ];

  it("só períodos de competição encerrados contam como Hackathon", () => {
    expect([...hackathonPeriodIds(periods)]).toEqual(["hacka-fechado"]);
    expect(hackathonPeriodIds(undefined).size).toBe(0);
  });

  it("separa os contatos e mantém os sem período na fila", () => {
    const ids = hackathonPeriodIds(periods);
    const a = c({ name: "hacka", period_id: "hacka-fechado" } as Partial<Contact>);
    const b = c({ name: "ciclo", period_id: "ciclo" } as Partial<Contact>);
    const d = c({ name: "sem-periodo", period_id: null } as Partial<Contact>);
    const { current, hackathon } = splitHackathon([a, b, d], ids);
    expect(names(current.map((contact) => ({ contact })))).toEqual(["ciclo", "sem-periodo"]);
    expect(hackathon).toEqual([a]);
  });
});
