import { describe, expect, it } from "vitest";
import {
  dealDoWebhook,
  eventosDoPipedrive,
  horarioDaTask,
  isoDoPipedrive,
  resultadoId,
  taskDaAt,
  type AtNoBanco,
  type PdActivity,
  type PdDeal,
} from "./pipedrive";

// Formato real da API v2 (card 94331 e as tasks dele, criados pela skill criar-card).
const DEAL: PdDeal = {
  id: 94331,
  stage_id: 108,
  status: "open",
  lost_reason: null,
  update_time: "2026-11-18T13:41:19Z",
  stage_change_time: null,
  lost_time: null,
};
const TP1: PdActivity = {
  id: 160209,
  subject: "LinkedIn - TP1 confirmação",
  type: "mensagem",
  add_time: "2026-11-16T22:33:56Z",
  update_time: "2026-11-17T11:08:14Z",
  due_date: "2026-11-16",
  due_time: null,
  done: true,
  marked_as_done_time: "2026-11-17T11:08:14Z",
  outcome: null,
};
const TASK_AT: PdActivity = {
  id: 160212,
  subject: "AT - 16h30 @enzo.camargos",
  type: "meeting",
  is_deleted: false,
  add_time: "2026-11-16T22:34:03Z",
  update_time: "2026-11-16T22:34:03Z",
  due_date: "2026-11-18",
  due_time: null,
  done: false,
  marked_as_done_time: null,
  outcome: null,
};
// Como a carga gravou a AT: 18/11 16:30 em Brasília, ainda sem etapa conhecida.
const AT: AtNoBanco = {
  status: "agendada",
  agendada_atual: "2026-11-18T19:30:00+00:00",
  pipedrive_stage_id: null,
  pipedrive_activity_at_id: 160212,
};

describe("leitura do Pipedrive", () => {
  it("datas da v2 e da v1 viram ISO em UTC", () => {
    expect(isoDoPipedrive("2026-11-18T13:41:19Z")).toBe("2026-11-18T13:41:19.000Z");
    expect(isoDoPipedrive("2026-11-18 13:41:19")).toBe("2026-11-18T13:41:19.000Z");
    expect(isoDoPipedrive(null)).toBeNull();
    expect(isoDoPipedrive("ontem")).toBeNull();
  });

  it("acha a task da AT pelo assunto, preferindo a aberta mais recente", () => {
    expect(taskDaAt([TP1, TASK_AT], null)?.id).toBe(160212);
    const concluida = { ...TASK_AT, done: true };
    const nova = { ...TASK_AT, id: 170000, add_time: "2026-11-19T10:00:00Z" };
    expect(taskDaAt([concluida, nova], 160212)?.id).toBe(170000);
    expect(taskDaAt([concluida], 160212)?.id).toBe(160212);
    expect(taskDaAt([{ ...TASK_AT, is_deleted: true }], 1)).toBeNull();
    // Assunto editado à mão: cai na task gravada na AT.
    expect(taskDaAt([{ ...TASK_AT, subject: "Reunião com Júlio" }], 160212)?.id).toBe(160212);
  });

  it("horário pela data da task e pela hora do assunto, em Brasília", () => {
    expect(horarioDaTask(TASK_AT, AT.agendada_atual)).toBe("2026-11-18T16:30:00-03:00");
    expect(horarioDaTask({ ...TASK_AT, subject: "AT - 9h @x" }, AT.agendada_atual)).toBe(
      "2026-11-18T09:00:00-03:00",
    );
    // Sem hora no assunto: due_time (UTC no Pipedrive).
    expect(
      horarioDaTask({ ...TASK_AT, subject: "AT", due_time: "13:00:00" }, AT.agendada_atual),
    ).toBe("2026-11-18T10:00:00-03:00");
    // Sem hora nenhuma: mantém a hora atual da AT.
    expect(
      horarioDaTask({ ...TASK_AT, subject: "AT", due_date: "2026-11-25" }, AT.agendada_atual),
    ).toBe("2026-11-25T16:30:00-03:00");
    expect(horarioDaTask({ ...TASK_AT, due_date: null }, AT.agendada_atual)).toBeNull();
  });

  it("resultado em qualquer formato", () => {
    expect(resultadoId(665)).toBe(665);
    expect(resultadoId("663")).toBe(663);
    expect(resultadoId({ id: 666, label: "Cancelado" })).toBe(666);
    expect(resultadoId("Não compareceu")).toBe(665);
    expect(resultadoId({ label: "Concluído" })).toBe(663);
    expect(resultadoId(null)).toBeNull();
    expect(resultadoId("Sem resposta")).toBeNull();
  });

  it("card do webhook nos formatos v1 e v2", () => {
    expect(dealDoWebhook({ meta: { entity: "deal", entity_id: "94331" }, data: {} })).toBe(94331);
    expect(
      dealDoWebhook({ meta: { entity: "activity", entity_id: 1 }, data: { deal_id: 94331 } }),
    ).toBe(94331);
    expect(dealDoWebhook({ meta: { object: "deal", id: 94331 }, current: { id: 94331 } })).toBe(
      94331,
    );
    expect(
      dealDoWebhook({ meta: { object: "activity" }, current: null, previous: { deal_id: 7 } }),
    ).toBe(7);
    expect(dealDoWebhook({ meta: { entity: "person", entity_id: 3 }, data: {} })).toBeNull();
    expect(dealDoWebhook("lixo")).toBeNull();
  });
});

describe("eventosDoPipedrive", () => {
  const ev = (at: Partial<AtNoBanco>, deal: Partial<PdDeal>, acts: PdActivity[]) =>
    eventosDoPipedrive({ ...AT, ...at }, { ...DEAL, ...deal }, acts);

  it("estado real sem mudança: só registra a etapa do card na primeira vez", () => {
    expect(ev({}, {}, [TP1, TASK_AT])).toEqual([
      {
        evento: "etapa_pipedrive",
        ocorrido_em: "2026-11-18T13:41:19.000Z",
        horario_anterior: null,
        horario_novo: null,
        motivo: null,
        pipedrive_stage_id: 108,
        pipedrive_ref: "deal:94331:etapa:108:2026-11-18T13:41:19.000Z",
      },
    ]);
    expect(ev({ pipedrive_stage_id: 108 }, {}, [TP1, TASK_AT])).toEqual([]);
  });

  it("task movida para outro dia e hora vira remarcação", () => {
    const movida = {
      ...TASK_AT,
      type: "reuniao_remarcada",
      subject: "AT - 10h @enzo.camargos",
      due_date: "2026-11-24",
      update_time: "2026-11-18T20:00:00Z",
    };
    expect(ev({ pipedrive_stage_id: 108 }, {}, [movida])).toEqual([
      {
        evento: "remarcada",
        ocorrido_em: "2026-11-18T20:00:00.000Z",
        horario_anterior: AT.agendada_atual,
        horario_novo: "2026-11-24T10:00:00-03:00",
        motivo: "Remarcada no Pipedrive",
        pipedrive_stage_id: null,
        pipedrive_ref: "act:160212:horario:2026-11-24T10:00:00-03:00",
      },
    ]);
  });

  it("remarcar depois de um no-show reabre a AT", () => {
    const nova = {
      ...TASK_AT,
      id: 170000,
      due_date: "2026-11-26",
      add_time: "2026-11-19T10:00:00Z",
    };
    const antiga = { ...TASK_AT, done: true, outcome: 665 };
    const r = ev({ status: "no_show", pipedrive_stage_id: 108 }, {}, [antiga, nova]);
    expect(r.map((e) => [e.evento, e.horario_novo])).toEqual([
      ["remarcada", "2026-11-26T16:30:00-03:00"],
    ]);
  });

  it("resultado da task define o desfecho", () => {
    const feita = (outcome: number) => ({
      ...TASK_AT,
      done: true,
      outcome,
      marked_as_done_time: "2026-11-18T20:10:00Z",
    });
    const so = (outcome: number, status: AtNoBanco["status"] = "agendada") =>
      ev({ status, pipedrive_stage_id: 108 }, {}, [feita(outcome)]).map((e) => [
        e.evento,
        e.ocorrido_em,
        e.pipedrive_ref,
      ]);
    expect(so(663)).toEqual([
      [
        "realizada",
        "2026-11-18T20:10:00.000Z",
        "act:160212:resultado:663:2026-11-18T20:10:00.000Z",
      ],
    ]);
    expect(so(665)).toEqual([
      ["no_show", "2026-11-18T20:10:00.000Z", "act:160212:resultado:665:2026-11-18T20:10:00.000Z"],
    ]);
    expect(so(666)).toEqual([
      [
        "cancelada",
        "2026-11-18T20:10:00.000Z",
        "act:160212:resultado:666:2026-11-18T20:10:00.000Z",
      ],
    ]);
    // Já está assim no banco: nada a fazer.
    expect(so(665, "no_show")).toEqual([]);
    // "Reagendado" sozinho não muda nada: a remarcação vem da nova data.
    expect(so(664)).toEqual([]);
  });

  it("card numa etapa depois da AT conta como realizada", () => {
    const r = ev(
      { pipedrive_stage_id: 108 },
      { stage_id: 31, stage_change_time: "2026-11-18T21:00:00Z" },
      [{ ...TASK_AT, done: true }],
    );
    expect(r.map((e) => [e.evento, e.pipedrive_stage_id, e.pipedrive_ref])).toEqual([
      ["etapa_pipedrive", 31, "deal:94331:etapa:31:2026-11-18T21:00:00.000Z"],
      ["realizada", null, "deal:94331:realizada:31:2026-11-18T21:00:00.000Z"],
    ]);
    // O resultado da task vale mais que a etapa.
    expect(
      ev({ pipedrive_stage_id: 31 }, { stage_id: 31 }, [
        { ...TASK_AT, done: true, outcome: 665 },
      ]).map((e) => e.evento),
    ).toEqual(["no_show"]);
  });

  it("card perdido ainda na etapa da AT cancela, com o motivo da perda", () => {
    const r = ev(
      { pipedrive_stage_id: 108 },
      { status: "lost", lost_reason: "Timing", lost_time: "2026-11-17T12:00:00Z" },
      [{ ...TASK_AT, done: true }],
    );
    expect(r).toEqual([
      expect.objectContaining({
        evento: "cancelada",
        motivo: "Card perdido: Timing",
        ocorrido_em: "2026-11-17T12:00:00.000Z",
      }),
    ]);
  });

  it("na dúvida não muda: task concluída sem resultado e card ainda na etapa da AT", () => {
    expect(ev({ pipedrive_stage_id: 108 }, {}, [{ ...TASK_AT, done: true }])).toEqual([]);
    expect(ev({ pipedrive_stage_id: 108 }, {}, [])).toEqual([]);
  });

  it("card que volta para antes da AT reabre a AT, na mesma data", () => {
    const voltou = { stage_id: 108, stage_change_time: "2026-11-19T12:00:00Z" };
    const feita = { ...TASK_AT, done: true };
    expect(ev({ status: "realizada", pipedrive_stage_id: 31 }, voltou, [feita])).toEqual([
      expect.objectContaining({ evento: "etapa_pipedrive", pipedrive_stage_id: 108 }),
      {
        evento: "reaberta",
        ocorrido_em: "2026-11-19T12:00:00.000Z",
        horario_anterior: null,
        horario_novo: null,
        motivo: "Card voltou para AT Diag. Agendada no Pipedrive",
        pipedrive_stage_id: null,
        pipedrive_ref: "deal:94331:reaberta:108:2026-11-19T12:00:00.000Z",
      },
    ]);
    // Card perdido que foi reaberto também volta a agendada.
    expect(
      ev({ status: "cancelada", pipedrive_stage_id: 108 }, { status: "open" }, [feita]).map(
        (e) => e.evento,
      ),
    ).toEqual(["reaberta"]);
    // Já agendada: nada a fazer.
    expect(ev({ status: "agendada", pipedrive_stage_id: 108 }, voltou, [feita])).toEqual([]);
  });

  it("o Resultado da task segura o desfecho mesmo com o card voltando", () => {
    const r = ev({ status: "no_show", pipedrive_stage_id: 31 }, { stage_id: 108 }, [
      { ...TASK_AT, done: true, outcome: 665 },
    ]);
    expect(r.map((e) => e.evento)).toEqual(["etapa_pipedrive"]);
  });

  it("avançar, voltar e avançar de novo registra cada vez com uma chave nova", () => {
    const feita = { ...TASK_AT, done: true };
    const primeira = ev(
      { pipedrive_stage_id: 108 },
      { stage_id: 31, stage_change_time: "2026-11-18T21:00:00Z" },
      [feita],
    );
    const segunda = ev(
      { status: "agendada", pipedrive_stage_id: 108 },
      { stage_id: 31, stage_change_time: "2026-11-20T09:00:00Z" },
      [feita],
    );
    const ref = (l: typeof primeira) => l.find((e) => e.evento === "realizada")!.pipedrive_ref;
    expect(ref(primeira)).not.toBe(ref(segunda));
  });
});
