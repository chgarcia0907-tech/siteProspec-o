import { describe, expect, it } from "vitest";
import {
  diasDeAtraso,
  hunterDoCard,
  resumoTasks,
  SEM_HUNTER,
  situacaoTask,
  type CardTasks,
  type TaskPd,
} from "./tasksHunter";

const HOJE = "2026-11-19";
const OPCOES = new Map([
  [458, "Nenhum"],
  [707, "mariana.altali"],
  [708, "enzo.camargos"],
]);

let n = 0;
const task = (deal: number, o: Partial<TaskPd>): TaskPd => ({
  id: ++n,
  deal_id: deal,
  subject: "WhatsApp - TP3 pré-AT, enviar 14h",
  type: "mensagem",
  due_date: HOJE,
  done: false,
  marked_as_done_time: null,
  ...o,
});

// Cards reais do NTec (títulos como a skill cria).
const CARDS: CardTasks[] = [
  {
    id: 94413,
    title: "Perplan Incorporações - Lucas Verdolini",
    stage_id: 108,
    hunter: "mariana.altali",
  },
  { id: 94410, title: "Simbiose - Artur Soares", stage_id: 108, hunter: "mariana.altali" },
  { id: 94331, title: "BH Airport - Júlio Cesar Tolentino", stage_id: 31, hunter: "enzo.camargos" },
  { id: 91571, title: "Camorim Serviços Marítimos", stage_id: 31, hunter: SEM_HUNTER },
  { id: 90000, title: "Card em negociação", stage_id: 35, hunter: "enzo.camargos" },
];

describe("situação da task", () => {
  it("aberta: atrasada, vence hoje, próxima ou sem data", () => {
    expect(situacaoTask(task(1, { due_date: "2026-11-18" }), HOJE)).toBe("atrasada");
    expect(situacaoTask(task(1, {}), HOJE)).toBe("hoje");
    expect(situacaoTask(task(1, { due_date: "2026-11-20" }), HOJE)).toBe("proxima");
    expect(situacaoTask(task(1, { due_date: null }), HOJE)).toBe("sem_data");
  });

  it("concluída: no prazo se marcada até o dia do vencimento, no fuso de São Paulo", () => {
    const feita = (due: string, quando: string) =>
      situacaoTask(task(1, { done: true, due_date: due, marked_as_done_time: quando }), HOJE);
    expect(feita("2026-11-16", "2026-11-16T20:00:00Z")).toBe("concluida_no_prazo");
    // 23h30 de SP do dia 16 ainda é dia 16 (02h30 UTC do dia 17).
    expect(feita("2026-11-16", "2026-11-17T02:30:00Z")).toBe("concluida_no_prazo");
    expect(feita("2026-11-16", "2026-11-17T11:08:14Z")).toBe("concluida_com_atraso");
    // Formato antigo da API (UTC sem "T").
    expect(feita("2026-11-16", "2026-11-17 11:08:14")).toBe("concluida_com_atraso");
    expect(situacaoTask(task(1, { done: true, due_date: null }), HOJE)).toBe("concluida_no_prazo");
  });

  it("dias de atraso", () => {
    expect(diasDeAtraso(task(1, { due_date: "2026-11-16" }), HOJE)).toBe(3);
    expect(diasDeAtraso(task(1, {}), HOJE)).toBe(0);
    expect(diasDeAtraso(task(1, { due_date: "2026-11-16", done: true }), HOJE)).toBe(0);
  });

  it("hunter do card pelo rótulo da opção; Nenhum ou vazio vira Sem hunter", () => {
    expect(hunterDoCard(707, OPCOES)).toBe("mariana.altali");
    expect(hunterDoCard({ id: 708, label: "enzo.camargos" }, OPCOES)).toBe("enzo.camargos");
    expect(hunterDoCard(458, OPCOES)).toBe(SEM_HUNTER);
    expect(hunterDoCard(null, OPCOES)).toBe(SEM_HUNTER);
    expect(hunterDoCard(999, OPCOES)).toBe(SEM_HUNTER);
  });
});

describe("resumoTasks", () => {
  const TASKS: TaskPd[] = [
    task(94413, { due_date: "2026-11-16", subject: "E-mail - TP1 confirmação (CN em cópia)" }),
    task(94413, {}),
    task(94413, { due_date: "2026-11-20", subject: "AT - 15h @mariana.altali" }),
    task(94410, {
      done: true,
      due_date: "2026-11-18",
      marked_as_done_time: "2026-11-18T12:00:00Z",
    }),
    task(94410, {
      done: true,
      due_date: "2026-11-17",
      marked_as_done_time: "2026-11-18T12:00:00Z",
    }),
    task(94331, { due_date: "2026-11-10", subject: "follow up 1" }),
    task(94331, { is_deleted: true, due_date: "2026-11-01" }),
    task(91571, { due_date: null, subject: "aprofundamento" }),
    task(90000, { due_date: "2026-11-01" }), // card fora das etapas acompanhadas
    task(12345, { due_date: "2026-11-01" }), // card que não está na lista
  ];

  it("soma por hunter e no total, só nas etapas acompanhadas", () => {
    const r = resumoTasks(CARDS, TASKS, HOJE);
    expect(r.total).toEqual({
      cards: { 108: 2, 31: 2 },
      abertas: 5,
      atrasadas: 2,
      hoje: 1,
      proximas: 1,
      semData: 1,
      concluidas: 2,
      noPrazo: 1,
      comAtraso: 1,
      taxaNoPrazo: 0.5,
    });
    // Mais atrasadas primeiro; Sem hunter por último.
    expect(r.hunters.map((h) => [h.hunter, h.contagem.abertas, h.contagem.atrasadas])).toEqual([
      ["mariana.altali", 3, 1],
      ["enzo.camargos", 1, 1],
      [SEM_HUNTER, 1, 0],
    ]);
    expect(r.hunters[0]!.contagem.cards).toEqual({ 108: 2, 31: 0 });
  });

  it("lista as abertas, mais atrasada primeiro", () => {
    const r = resumoTasks(CARDS, TASKS, HOJE);
    expect(r.abertas.map((t) => [t.assunto, t.situacao, t.diasAtraso, t.etapa])).toEqual([
      ["follow up 1", "atrasada", 9, 31],
      ["E-mail - TP1 confirmação (CN em cópia)", "atrasada", 3, 108],
      ["WhatsApp - TP3 pré-AT, enviar 14h", "hoje", 0, 108],
      ["AT - 15h @mariana.altali", "proxima", 0, 108],
      ["aprofundamento", "sem_data", 0, 31],
    ]);
    expect(r.abertas[0]).toMatchObject({
      card: 94331,
      cardTitulo: "BH Airport - Júlio Cesar Tolentino",
      hunter: "enzo.camargos",
    });
  });

  it("filtra por etapa", () => {
    const r = resumoTasks(CARDS, TASKS, HOJE, 31);
    expect(r.total.cards).toEqual({ 108: 0, 31: 2 });
    expect(r.total.abertas).toBe(2);
    expect(r.hunters.map((h) => h.hunter)).toEqual(["enzo.camargos", SEM_HUNTER]);
  });

  it("sem tasks: taxa nula e listas vazias", () => {
    const r = resumoTasks([], [], HOJE);
    expect(r.total.taxaNoPrazo).toBeNull();
    expect(r.hunters).toEqual([]);
    expect(r.abertas).toEqual([]);
  });
});
