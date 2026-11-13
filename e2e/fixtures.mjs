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
  sector: "",
  job_title: "",
  connected_at: null,
  step1_date: null,
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
  updated_at: "2026-11-01T00:00:00Z",
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
      company: "Gama",
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
      at_marcada_em: "2026-11-14",
      at_registrado_em: "2026-11-06T13:00:00Z",
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
    }),
    ct(U1, {
      name: "Hugo Melo",
      company: "Teta",
      sector: "Indústria",
      job_title: "CFO",
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
    competition_settings: [{ id: 1, start_date: "2026-10-01", end_date: null }],
    user_roles: [
      {
        id: "99999999-0000-4000-8000-000000000001",
        user_id: "99999999-9999-4999-8999-999999999999",
        role: "admin",
      },
    ],
    admin_attempts: [],
  };
}

/** Contatos simples do hunter logado, para testar paginação. */
export function seedContacts(count) {
  return Array.from({ length: count }, (_, i) =>
    ct(U1, { name: `Extra ${String(i + 1).padStart(3, "0")}`, company: "Seed" }),
  );
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
