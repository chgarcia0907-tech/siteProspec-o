// Dados dos testes de ponta a ponta. Datas fixas em torno de 12/11/2026 (quinta-feira): os
// testes que dependem do "hoje" congelam o relógio do navegador nessa data.
export const SERVICE_KEY = "service-key";
export const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const U3 = "33333333-3333-4333-8333-333333333333";
const P1 = "aaaaaaaa-0000-4000-8000-000000000001";
const P0 = "aaaaaaaa-0000-4000-8000-000000000000";
const G1 = "bbbbbbbb-0000-4000-8000-000000000001";
const S1 = "cccccccc-0000-4000-8000-000000000001";
export const SETOR_VAREJO = "12121212-0000-4000-8000-000000000001";
const SETOR_SAUDE = "12121212-0000-4000-8000-000000000002";
export const SETOR_INDUSTRIA = "12121212-0000-4000-8000-000000000003";
export const SUBSETOR_METALURGIA = "12121212-0000-4000-8000-000000000004";
export const SUBSETOR_QUIMICA = "12121212-0000-4000-8000-000000000005";
const EMPRESA_DELTA = "13131313-0000-4000-8000-000000000001";
const EMPRESA_OMICRON = "13131313-0000-4000-8000-000000000002";
export const SAFRA_S01 = "16161616-0000-4000-8000-000000000001";
export const SAFRA_S02 = "16161616-0000-4000-8000-000000000002";
export const SAFRA_S03 = "16161616-0000-4000-8000-000000000003";
export const ALOC_U1_S02 = "17171717-0000-4000-8000-000000000001";
export const GOAL_EQUIPE = "14141414-0000-4000-8000-000000000001";

export const USER = {
  id: U1,
  aud: "authenticated",
  role: "authenticated",
  email: "hunter1@example.com",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-10-01T00:00:00Z",
};

const blank = {
  headline: "",
  company: "",
  company_gender: "feminino",
  phone: "",
  sem_whatsapp: false,
  sector: "",
  job_title: "",
  connected_at: null,
  step1_date: null,
  respondeu_em: null,
  resposta_etapa: null,
  resposta_tipo: null,
  resposta_modelo: null,
  sent1_at: null,
  sent2_at: null,
  sent3_at: null,
  sent4_at: null,
  sent5_at: null,
  status: "aguardando",
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
  period_id: P1,
  company_id: null,
  updated_at: "2026-11-01T00:00:00Z",
  retomar_em: null,
  retomar_motivo: null,
  retomada_marcada_em: null,
  retomado_em: null,
};
let n = 0;
const ct = (user_id, o) => ({
  ...blank,
  id: `dddddddd-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  user_id,
  created_at: `2026-11-0${(n % 9) + 1}T12:00:00Z`,
  ...o,
});

export function makeContacts() {
  n = 0;
  return [
    ct(U1, {
      name: "Ana Souza",
      headline: "Diretora de Operações na Alfa",
      connected_at: "2026-11-03",
    }),
    ct(U1, {
      name: "Bruno Lima",
      headline: "CTO",
      company: "Beta",
      company_gender: "masculino",
      sector: "Indústria",
      job_title: "CTO",
      phone: "11987654321",
      connected_at: "2026-11-02",
      step1_date: "2026-11-05",
      sent1_at: "2026-11-05",
      status: "em_cadencia",
    }),
    ct(U1, {
      name: "Carla Dias",
      headline: "Gerente de TI",
      company: "Ômicron",
      company_gender: "feminino",
      company_id: EMPRESA_OMICRON,
      sector: "Varejo",
      job_title: "Gerente de TI",
      connected_at: "2026-11-10",
      step1_date: "2026-11-12",
      status: "em_cadencia",
    }),
    ct(U1, {
      name: "Diego Rocha",
      headline: "CEO na Delta",
      company: "Delta",
      company_id: EMPRESA_DELTA,
      job_title: "CEO",
      phone: "11911112222",
      step1_date: "2026-11-03",
      sent1_at: "2026-11-03",
      sent2_at: "2026-11-04",
      sent3_at: "2026-11-05",
      status: "em_cadencia",
    }),
    ct(U1, {
      name: "Elisa Prado",
      company: "Épsilon",
      sector: "Saúde",
      job_title: "COO",
      step1_date: "2026-10-20",
      sent1_at: "2026-10-20",
      sent2_at: "2026-10-21",
      status: "respondeu",
      resposta_tipo: "positiva",
      at_marcada_em: "2026-11-14",
      at_registrado_em: "2026-11-06T13:00:00Z",
      // Retomada atrasada: combinada para 10/11 (hoje é 12/11) e ainda não retomada.
      retomar_em: "2026-11-10",
      retomar_motivo: "Pediu para falar depois da auditoria",
      retomada_marcada_em: "2026-11-03T12:00:00Z",
    }),
    ct(U1, {
      name: "Fábio Neves",
      company: "Zeta",
      sector: "Educação",
      job_title: "Diretor",
      step1_date: "2026-10-13",
      sent1_at: "2026-10-13",
      sent2_at: "2026-10-14",
      sent3_at: "2026-10-15",
      sent4_at: "2026-10-16",
      sent5_at: "2026-10-17",
      status: "concluido",
      at_marcada_em: "2026-10-28",
      lead_em: "2026-11-04",
      at_registrado_em: "2026-10-27T10:00:00Z",
      lead_registrado_em: "2026-11-04T10:00:00Z",
    }),
    ct(U1, {
      name: "Gabi Torres",
      company: "Eta",
      status: "descartado",
      step1_date: "2026-10-10",
      sent1_at: "2026-10-10",
      // Retomada futura (20/11): ainda não aparece em Envios de hoje.
      retomar_em: "2026-11-20",
      retomada_marcada_em: "2026-11-05T12:00:00Z",
    }),
    ct(U1, {
      name: "Hugo Melo",
      company: "Teta",
      sector: "Indústria",
      job_title: "CFO",
      persona: "owner_processo", // já confirmada (a sugerida pelo cargo seria outra)
      phone: "21999998888",
      step1_date: "2026-10-01",
      sent1_at: "2026-10-01",
      sent2_at: "2026-10-02",
      sent3_at: "2026-10-03",
      sent4_at: "2026-10-06",
      sent5_at: "2026-10-07",
      status: "concluido",
      at_marcada_em: "2026-10-09",
      lead_em: "2026-10-12",
      proposta_em: "2026-10-15",
      aprovacao_em: "2026-10-20",
      vendido_em: "2026-10-27",
      at_registrado_em: "2026-10-08T10:00:00Z",
      lead_registrado_em: "2026-10-12T10:00:00Z",
      proposta_registrado_em: "2026-10-15T10:00:00Z",
      aprovacao_registrado_em: "2026-10-20T10:00:00Z",
      vendido_registrado_em: "2026-10-27T10:00:00Z",
    }),
    ct(U2, {
      name: "Iara Costa",
      company: "Iota",
      step1_date: "2026-11-02",
      sent1_at: "2026-11-02",
      status: "em_cadencia",
      at_marcada_em: "2026-11-10",
      at_registrado_em: "2026-11-05T10:00:00Z",
    }),
    ct(U2, {
      name: "João Pires",
      company: "Kapa",
      step1_date: "2026-11-03",
      sent1_at: "2026-11-03",
      sent2_at: "2026-11-04",
      status: "em_cadencia",
      at_marcada_em: "2026-11-11",
      lead_em: "2026-11-11",
      at_registrado_em: "2026-11-11T10:00:00Z",
      lead_registrado_em: "2026-11-11T10:00:00Z",
    }),
    ct(U2, {
      name: "Karen Luz",
      company: "Lambda",
      step1_date: "2026-11-04",
      sent1_at: "2026-11-04",
      status: "em_cadencia",
    }),
  ];
}

/** Estado inicial do banco simulado (cada chamada devolve uma cópia nova). */
export function initialDb() {
  return {
    contacts: makeContacts(),
    profiles: [
      {
        id: U1,
        display_name: "Hunter Um",
        email: "hunter1@example.com",
        message_name: "Hu",
        gender: "m",
        created_at: "2026-10-01T00:00:00Z",
      },
      {
        id: U2,
        display_name: "Hunter Dois",
        email: "hunter2@example.com",
        message_name: null,
        gender: "f",
        created_at: "2026-10-01T00:00:00Z",
      },
      {
        id: U3,
        display_name: "Sem Contatos",
        email: "hunter3@example.com",
        message_name: null,
        gender: "m",
        created_at: "2026-10-01T00:00:00Z",
      },
    ],
    settings: [{ user_id: U1, offset1: 0, offset2: 1, offset3: 2, offset4: 3, offset5: 4 }],
    message_templates: [1, 2, 3, 4, 5].map((step) => ({
      step,
      code: `M${step}`,
      body: `Olá, [FIRST NAME]! Mensagem ${step} [NA_EMPRESA].`,
    })),
    sectors: [
      { id: SETOR_VAREJO, name: "Varejo", active: true, sort: 0, parent_id: null },
      { id: SETOR_SAUDE, name: "Saúde", active: false, sort: 1, parent_id: null },
      { id: SETOR_INDUSTRIA, name: "Indústria", active: true, sort: 2, parent_id: null },
      {
        id: SUBSETOR_METALURGIA,
        name: "Metalurgia",
        active: true,
        sort: 0,
        parent_id: SETOR_INDUSTRIA,
      },
      // Subsetor inativo: não aparece no seletor do hunter, mas o painel o lista.
      {
        id: SUBSETOR_QUIMICA,
        name: "Química",
        active: false,
        sort: 1,
        parent_id: SETOR_INDUSTRIA,
      },
    ],
    // Cadência do Varejo só com o WhatsApp 2; as outras etapas usam o modelo padrão.
    // Metalurgia (subsetor) tem as 5 etapas em "qualquer persona"; Indústria não tem nenhuma.
    sector_templates: [
      ...[1, 2, 3, 4, 5].map((step) => ({
        sector_id: SUBSETOR_METALURGIA,
        persona: "",
        step,
        code: `MET${step}`,
        body: `Olá, [FIRST NAME]! Metalurgia ${step} [NA_EMPRESA].`,
      })),
      {
        sector_id: SETOR_VAREJO,
        persona: "",
        step: 4,
        code: "VAR4",
        body: "Oi, [FIRST NAME]! Cadência do varejo [NA_EMPRESA].",
      },
      // Varejo, WhatsApp 2, só para quem é Patrocinador Executivo (ex.: CEO).
      {
        sector_id: SETOR_VAREJO,
        persona: "patrocinador_executivo",
        step: 4,
        code: "VAR4PE",
        body: "Oi, [FIRST NAME]! Conversa de patrocinador [NA_EMPRESA].",
      },
    ],
    companies: [
      {
        id: EMPRESA_DELTA,
        user_id: U1,
        name: "Delta",
        gender: "feminino",
        sector_id: SETOR_VAREJO,
        subsector_id: null,
        week_start: "2026-11-09",
        period_id: P1,
        created_at: "2026-11-09T12:00:00Z",
        updated_at: "2026-11-09T12:00:00Z",
      },
      {
        id: EMPRESA_OMICRON,
        user_id: U1,
        name: "Ômicron",
        gender: "feminino",
        sector_id: SETOR_INDUSTRIA,
        subsector_id: SUBSETOR_METALURGIA,
        week_start: "2026-11-09",
        period_id: P1,
        created_at: "2026-11-09T12:00:00Z",
        updated_at: "2026-11-09T12:00:00Z",
      },
    ],
    holidays: [
      { date: "2026-11-02", name: "Finados" },
      { date: "2026-11-20", name: "Consciência Negra" },
    ],
    periods: [
      {
        id: P1,
        name: "Ciclo Nov",
        status: "active",
        kind: "ciclo",
        started_at: "2026-10-27T03:00:00Z",
        closed_at: null,
        created_at: "2026-10-27T03:00:00Z",
      },
      {
        id: P0,
        name: "Hacka Out",
        status: "closed",
        kind: "competicao",
        started_at: "2026-10-01T03:00:00Z",
        closed_at: "2026-10-26T20:00:00Z",
        created_at: "2026-10-01T03:00:00Z",
      },
    ],
    // Dashboard › Semanas: o Ciclo Nov tem a S01 (antes do esquema de alocação), a S02 (a semana
    // de hoje, 12/11/2026) e a S03. Parâmetros com os valores padrão; sem metas do ciclo.
    // Cópia dos cards (fase 5): 94500 e 94800 são do outbound NTec sem AT (o 94800 sem cargo);
    // o 94307 está ligado à AT do Paulo Reis e não é do outbound.
    pd_cards: [
      {
        deal_id: 94500,
        titulo: "Sigma Fretes - Rita Lopes",
        pipeline_id: 6,
        stage_id: 31,
        status: "open",
        valor: 30000,
        hunter_login: "hunter2",
        canal_entrada: "Outbound",
        cargo: "Diretora de Logística",
        add_time: "2026-11-03T12:00:00Z",
        // Copiado antes da última mudança no Pipedrive (06/11): a próxima sincronização o refaz.
        update_time: "2026-11-05T10:00:00Z",
        etiquetas: [34],
        outbound: true,
        sincronizado_em: "2026-11-12T12:37:00Z",
      },
      {
        deal_id: 94800,
        titulo: "Engenharia Nova - contato",
        pipeline_id: 6,
        stage_id: 108,
        status: "open",
        hunter_login: "hunter1",
        canal_entrada: "Outbound",
        cargo: null,
        add_time: "2026-11-10T12:00:00Z",
        update_time: "2026-11-10T12:00:00Z",
        etiquetas: [34],
        outbound: true,
        sincronizado_em: "2026-11-12T12:37:00Z",
      },
      {
        deal_id: 94307,
        titulo: "Ômega Log - Paulo Reis",
        pipeline_id: 6,
        stage_id: 108,
        status: "open",
        hunter_login: "hunter1",
        cargo: null,
        add_time: "2026-11-04T12:00:00Z",
        update_time: null,
        etiquetas: [34],
        outbound: false,
        sincronizado_em: "2026-11-12T12:37:00Z",
      },
    ],
    pd_card_etapas: [],
    // Tasks do hunter1 nesta semana: uma concluída no dia do prazo, outra aberta e vencida.
    pd_tasks: [
      {
        activity_id: 700001,
        deal_id: 94800,
        assunto: "TP1",
        due_date: "2026-11-10",
        done: true,
        marked_as_done_time: "2026-11-10T18:00:00Z",
        hunter_login: "hunter1",
      },
      {
        activity_id: 700002,
        deal_id: 94800,
        assunto: "TP3",
        due_date: "2026-11-11",
        done: false,
        marked_as_done_time: null,
        hunter_login: "hunter1",
      },
    ],
    safras: [
      {
        id: SAFRA_S01,
        period_id: P1,
        numero: 1,
        inicio: "2026-11-02",
        fim: "2026-11-06",
        usa_alocacao: false,
      },
      {
        id: SAFRA_S02,
        period_id: P1,
        numero: 2,
        inicio: "2026-11-09",
        fim: "2026-11-13",
        usa_alocacao: true,
      },
      {
        id: SAFRA_S03,
        period_id: P1,
        numero: 3,
        inicio: "2026-11-16",
        fim: "2026-11-20",
        usa_alocacao: true,
      },
    ],
    // Na S02 (semana de hoje) o Hunter Um prospecta Varejo na dupla D1; o Hunter Dois não foi
    // alocado. A S03 ainda não começou: alocação livre.
    alocacoes: [
      {
        id: ALOC_U1_S02,
        safra_id: SAFRA_S02,
        user_id: U1,
        sector_id: SETOR_VAREJO,
        subsector_id: null,
        dupla: "D1",
        meta_empresas: 10,
        meta_contatos: 40,
        motivo_meta_zero: null,
        vigente_desde: "2026-11-09",
      },
    ],
    dashboard_parametros: [
      {
        id: true,
        maturacao_semanas: 3,
        amostra_minima_ab: 500,
        min_ats_segmento: 10,
        avanco_fica_pct: 50,
        avanco_troca_pct: 35,
        esforco_alerta_pct: 70,
        dias_contato_parado: 3,
        concentracao_ats_pct: 30,
        nao_realizadas_pct: 15,
        semanas_seguidas: 2,
        updated_at: "2026-11-01T12:00:00Z",
      },
    ],
    dashboard_tempo_etapas: [108, 31, 33, 34, 35, 36].map((stage_id, i) => ({
      stage_id,
      meta_dias: [7, 7, 10, 7, 4, 5][i],
      updated_at: "2026-11-01T12:00:00Z",
    })),
    ciclo_metas: [],
    groups: [{ id: G1, period_id: P1, name: "Squad Azul", created_at: "2026-10-27T03:00:00Z" }],
    subgroups: [{ id: S1, group_id: G1, name: "Dupla 1", created_at: "2026-10-27T03:00:00Z" }],
    period_members: [
      {
        id: "eeeeeeee-0000-4000-8000-000000000001",
        period_id: P1,
        user_id: U1,
        group_id: G1,
        subgroup_id: S1,
        created_at: "2026-10-27T03:00:00Z",
      },
      {
        id: "eeeeeeee-0000-4000-8000-000000000002",
        period_id: P1,
        user_id: U2,
        group_id: null,
        subgroup_id: null,
        created_at: "2026-10-27T03:00:00Z",
      },
      {
        id: "eeeeeeee-0000-4000-8000-000000000003",
        period_id: P0,
        user_id: U1,
        group_id: null,
        subgroup_id: null,
        created_at: "2026-10-01T03:00:00Z",
      },
    ],
    period_snapshots: [
      {
        id: "ffffffff-0000-4000-8000-000000000001",
        period_id: P0,
        hunter_id: U1,
        hunter_name: "Hunter Um",
        group_name: "",
        subgroup_name: "",
        points: 70.1,
        contacts_count: 4,
        sent1: 4,
        sent2: 3,
        sent3: 2,
        sent4: 1,
        sent5: 1,
        ats_count: 1,
        leads_count: 1,
        propostas_count: 1,
        aprovacoes_count: 1,
        vendas_count: 1,
        weekly_wins: 1,
        first_at_bonus: true,
        extra: {
          total_pontos: 104,
          pontos_funil: 93,
          bonus_semanas: 6,
          taxa_conversao: 25,
          linkedin1: 4,
          inicio: "2026-10-01",
          fim: "2026-10-26",
          semanas: [],
          primeiro_at: { hunter: "Hunter Um", data: "2026-10-08" },
        },
        frozen_at: "2026-10-26T20:00:00Z",
      },
    ],
    // Meta da equipe: 5 mensagens por dia útil, 1 AT por semana e 80% no prazo.
    goals: [
      {
        id: GOAL_EQUIPE,
        user_id: null,
        group_id: null,
        envios_dia: 5,
        l1_semana: null,
        ats_semana: 1,
        no_prazo_pct: 80,
      },
    ],
    competition_settings: [{ id: 1, start_date: "2026-10-01", end_date: null }],
    user_roles: [
      {
        id: "99999999-0000-4000-8000-000000000001",
        user_id: "99999999-9999-4999-8999-999999999999",
        role: "admin",
      },
    ],
    admin_attempts: [],
    time_comercial: [
      {
        login: "hunter1",
        nome: "Hunter Um",
        papel: "hunter",
        apelidos: ["Hunter Um"],
        ativo: true,
        user_id: U1,
      },
      {
        login: "hunter2",
        nome: "Hunter Dois",
        papel: "hunter",
        apelidos: ["Hunter Dois"],
        ativo: true,
        user_id: U2,
      },
      {
        login: "ana.cn",
        nome: "Ana Coordenadora",
        papel: "cn",
        apelidos: ["Ana", "Aninha"],
        ativo: true,
        user_id: null,
      },
      {
        login: "rui.cn",
        nome: "Rui Coordenador",
        papel: "cn",
        apelidos: ["Rui"],
        ativo: true,
        user_id: null,
      },
    ],
    ats: [
      at({
        id: AT_ALFA,
        user_id: U1,
        hunter_login: "hunter1",
        cn_login: "ana.cn",
        empresa: "Alfa",
        prospect: "Ana Souza",
        cargo: "Diretora de Operações",
        canal: "LinkedIn",
        motivo_prospeccao: "Operação grande com processos manuais.",
        agendada_original: "2026-11-13T13:00:00+00:00",
        agendada_atual: "2026-11-17T17:00:00+00:00",
        registrada_em: "2026-11-10T15:00:00+00:00",
      }),
      at({
        id: AT_OMEGA,
        user_id: U2,
        hunter_login: "hunter2",
        cn_login: "rui.cn",
        empresa: "Ômega Log",
        prospect: "Paulo Reis",
        canal: "WhatsApp",
        status: "realizada",
        agendada_original: "2026-11-11T18:00:00+00:00",
        agendada_atual: "2026-11-11T18:00:00+00:00",
        registrada_em: "2026-11-05T14:00:00+00:00",
        origem: "skill",
        pipedrive_deal_id: 94307,
      }),
      at({
        id: AT_SIGMA,
        user_id: U2,
        hunter_login: "hunter2",
        cn_login: "ana.cn",
        empresa: "Sigma",
        prospect: "Lia Prado",
        canal: "E-mail",
        status: "no_show",
        agendada_original: "2026-11-09T12:00:00+00:00",
        agendada_atual: "2026-11-09T12:00:00+00:00",
        registrada_em: "2026-11-04T14:00:00+00:00",
      }),
    ],
    at_eventos: [
      ev(AT_ALFA, 1, "marcada", "2026-11-10T15:00:00+00:00", {
        horario_novo: "2026-11-13T13:00:00+00:00",
      }),
      ev(AT_ALFA, 2, "remarcada", "2026-11-12T12:00:00+00:00", {
        horario_anterior: "2026-11-13T13:00:00+00:00",
        horario_novo: "2026-11-17T17:00:00+00:00",
        motivo: "Prospect pediu outro dia",
      }),
      ev(AT_OMEGA, 3, "marcada", "2026-11-05T14:00:00+00:00", {
        horario_novo: "2026-11-11T18:00:00+00:00",
        origem: "skill",
      }),
      ev(AT_OMEGA, 4, "realizada", "2026-11-11T19:00:00+00:00", { origem: "pipedrive_webhook" }),
      ev(AT_SIGMA, 5, "marcada", "2026-11-04T14:00:00+00:00", {
        horario_novo: "2026-11-09T12:00:00+00:00",
      }),
      ev(AT_SIGMA, 6, "no_show", "2026-11-09T13:00:00+00:00", { motivo: "Não entrou na sala" }),
    ],
  };
}

export const AT_ALFA = "15151515-0000-4000-8000-000000000001";
const AT_OMEGA = "15151515-0000-4000-8000-000000000002";
const AT_SIGMA = "15151515-0000-4000-8000-000000000003";

/** Linha de `ats` com os campos que o teste não precisa variar. */
function at(o) {
  return {
    tipo: "diagnostico",
    mensagem_ficha: null,
    contact_id: null,
    resposta_etapa: null,
    resposta_modelo: null,
    cargo: null,
    setor: null,
    linkedin: null,
    motivo_prospeccao: null,
    ficha_original: null,
    status: "agendada",
    status_em: null,
    pipedrive_deal_id: null,
    pipedrive_person_id: null,
    pipedrive_org_id: null,
    pipedrive_stage_id: null,
    pipedrive_activity_at_id: null,
    pipedrive_activity_tp1_id: null,
    pipedrive_activity_tp3_id: null,
    pipedrive_activity_tp4_id: null,
    origem: "app",
    created_by: o.user_id,
    created_at: o.registrada_em,
    updated_at: o.registrada_em,
    ...o,
  };
}

/** Evento do log de uma AT. */
function ev(at_id, n, evento, ocorrido_em, o = {}) {
  return {
    id: `16161616-0000-4000-8000-${String(n).padStart(12, "0")}`,
    at_id,
    evento,
    ocorrido_em,
    created_at: ocorrido_em,
    horario_anterior: null,
    horario_novo: null,
    motivo: null,
    origem: "app",
    pipedrive_stage_id: null,
    ...o,
  };
}

/** Contatos simples do hunter logado, para testar paginação. */
export function seedContacts(count) {
  return Array.from({ length: count }, (_, i) =>
    ct(U1, { name: `Extra ${String(i + 1).padStart(3, "0")}`, company: "Seed" }),
  );
}

/** Contato do hunter logado de um período de competição encerrado (Hackathon), com envio pendente. */
export function hackathonContact(comAt = false) {
  return ct(U1, {
    ...(comAt ? { at_marcada_em: "2026-11-12", at_registrado_em: "2026-11-12T15:00:00Z" } : {}),
    created_at: "2026-10-06T12:00:00Z", // antes do encerramento do Hackathon
    name: "Hugo Hacka",
    headline: "CEO na Omega",
    company: "Omega",
    sector: "Indústria",
    job_title: "CEO",
    connected_at: "2026-10-05",
    step1_date: "2026-10-06",
    status: "em_cadencia",
    period_id: P0,
  });
}

export const RPC = {
  has_role: true,
  ranking: [
    {
      hunter_id: U1,
      hunter_name: "Hunter Um",
      importados: 8,
      enviadas1: 6,
      enviadas2: 4,
      enviadas3: 3,
      enviadas4: 2,
      enviadas5: 2,
      concluidas: 2,
      respostas: 1,
    },
    {
      hunter_id: U2,
      hunter_name: "Hunter Dois",
      importados: 3,
      enviadas1: 3,
      enviadas2: 1,
      enviadas3: 0,
      enviadas4: 0,
      enviadas5: 0,
      concluidas: 0,
      respostas: 0,
    },
  ],
};

/**
 * Pipedrive simulado: o card 94307 (AT da Ômega Log, realizada em 11/11 no banco) voltou para
 * "AT Diag. Agendada" com uma task nova para 19/11 às 15h, ou seja, foi remarcado.
 */
export const PIPEDRIVE = {
  /** GET /deals (lista): só os cards 94307 e 94500 entram na tela Tasks. */
  lista: [
    "94307",
    {
      // Card do outbound NTec (funil 6 + NTec + Canal de Entrada Outbound) sem AT na plataforma.
      id: 94500,
      title: "Sigma Fretes - Rita Lopes",
      pipeline_id: 6,
      stage_id: 31,
      status: "open",
      value: 30000,
      currency: "BRL",
      person_id: 501,
      add_time: "2026-11-03T12:00:00Z",
      update_time: "2026-11-06T13:00:00Z",
      label_ids: [34],
      custom_fields: {
        "2e9e1edaa8c01d43869bc9e949a5873ba2163ca4": 901,
        "97d0502cc2b489986844a93b374656e5acf179e1": 28,
      },
    },
    {
      id: 94600,
      title: "Em negociação",
      stage_id: 35,
      status: "open",
      label_ids: [34],
      custom_fields: { "2e9e1edaa8c01d43869bc9e949a5873ba2163ca4": 900 },
    },
    {
      id: 94700,
      title: "Card de outro núcleo",
      stage_id: 108,
      status: "open",
      label_ids: [12],
      custom_fields: {},
    },
  ],
  dealFields: [
    {
      field_code: "2e9e1edaa8c01d43869bc9e949a5873ba2163ca4",
      options: [
        { id: 458, label: "Nenhum" },
        { id: 900, label: "hunter1" },
        { id: 901, label: "hunter2" },
      ],
    },
  ],
  deals: {
    // Card do outbound fora da lista do funil (não entra na tela Tasks), achado só pelo id.
    94800: {
      id: 94800,
      title: "Engenharia Nova - contato",
      pipeline_id: 6,
      stage_id: 108,
      status: "open",
      label_ids: [34],
      add_time: "2026-11-10T12:00:00Z",
      update_time: "2026-11-10T12:00:00Z",
      custom_fields: {
        "2e9e1edaa8c01d43869bc9e949a5873ba2163ca4": 900,
        "97d0502cc2b489986844a93b374656e5acf179e1": 28,
      },
    },
    94307: {
      id: 94307,
      title: "Ômega Log - Paulo Reis",
      pipeline_id: 6,
      add_time: "2026-11-04T12:00:00Z",
      label_ids: [34],
      custom_fields: { "2e9e1edaa8c01d43869bc9e949a5873ba2163ca4": 900 },
      stage_id: 108,
      status: "open",
      lost_reason: null,
      update_time: "2026-11-12T13:00:00Z",
      stage_change_time: "2026-11-12T13:00:00Z",
      lost_time: null,
    },
  },
  persons: [
    {
      id: 501,
      custom_fields: { "54dfa4cb1118103bebc367d6e0ae574df374d478": "Diretora de Logística" },
    },
  ],
  // Histórico (API v1): o 94500 passou de AT Diag. Agendada para Realizada em 06/11.
  flows: {
    94500: [
      {
        object: "dealChange",
        data: {
          field_key: "stage_id",
          old_value: "108",
          new_value: "31",
          log_time: "2026-11-06 13:00:00",
        },
      },
    ],
  },
  activities: {
    94500: [
      {
        id: 500010,
        deal_id: 94500,
        subject: "follow up 1",
        type: "task",
        due_date: "2026-11-12",
        due_time: null,
        done: false,
        is_deleted: false,
        marked_as_done_time: null,
        outcome: null,
      },
      {
        id: 500011,
        deal_id: 94500,
        subject: "AT - 10h @hunter2",
        type: "meeting",
        due_date: "2026-11-05",
        due_time: null,
        done: true,
        is_deleted: false,
        marked_as_done_time: "2026-11-06T13:00:00Z",
        outcome: 663,
      },
    ],
    94307: [
      {
        id: 500003,
        deal_id: 94307,
        subject: "WhatsApp - TP3 pré-AT, enviar 14h",
        type: "mensagem",
        due_date: "2026-11-10",
        due_time: null,
        done: false,
        is_deleted: false,
        add_time: "2026-11-05T14:00:00Z",
        update_time: "2026-11-05T14:00:00Z",
        marked_as_done_time: null,
        outcome: null,
      },
      {
        id: 500001,
        subject: "AT - 15h @hunter2",
        type: "meeting",
        due_date: "2026-11-11",
        due_time: null,
        done: true,
        is_deleted: false,
        add_time: "2026-11-05T14:00:00Z",
        update_time: "2026-11-11T19:00:00Z",
        marked_as_done_time: "2026-11-11T19:00:00Z",
        outcome: 664,
      },
      {
        id: 500002,
        subject: "AT - 15h @hunter2",
        type: "reuniao_remarcada",
        due_date: "2026-11-19",
        due_time: null,
        done: false,
        is_deleted: false,
        add_time: "2026-11-12T13:05:00Z",
        update_time: "2026-11-12T13:05:00Z",
        marked_as_done_time: null,
        outcome: null,
      },
    ],
  },
};
