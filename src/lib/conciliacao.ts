// Conciliação da Dashboard de Outbound (fase 5 do plano): o que está desencontrado entre a
// plataforma e o Pipedrive para o LO resolver. Regras puras; leitura e ações em
// `dashboard.functions.ts`.
//
// - AT sem card: AT Diagnóstica sem `pipedrive_deal_id` (gera alerta no mesmo dia).
// - Card sem AT: card do outbound NTec (pd_cards.outbound) que nenhuma AT referencia.
// - AT sem contato: AT sem `contact_id`; conta como "fora de cadência" até ser ligada.
// - Contatos sem alocação: hunter com contatos numa safra que usa alocação e sem alocação nela.
// - Negócio sem cargo: card do outbound sem o campo Cargo da pessoa.
// Tudo a partir de `desde` (início do ciclo), para o histórico antigo não encher a fila.
import { contatoDaAt, type ContatoParaAt } from "./ats";
import { diaSP, safraDaData, type Safra } from "./safras";

export type CAt = {
  id: string;
  user_id: string | null;
  hunter_login: string | null;
  contact_id: string | null;
  pipedrive_deal_id: number | null;
  empresa: string;
  prospect: string;
  registrada_em: string;
  status: string;
};

export type CCard = {
  deal_id: number;
  titulo: string;
  hunter_login: string | null;
  stage_id: number | null;
  status: string;
  add_time: string | null;
  cargo: string | null;
};

export type CContato = ContatoParaAt & { user_id: string; created_at: string };

export type ConciliacaoInput = {
  desde: string;
  ats: readonly CAt[];
  /** Só os cards do outbound NTec. */
  cards: readonly CCard[];
  contatos: readonly CContato[];
  safras: readonly Safra[];
  alocacoes: readonly { safra_id: string; user_id: string }[];
};

export type AtPendente = CAt & {
  /** Sugestão de ligação (contato do hunter ou card), quando há uma só candidata clara. */
  sugestao: { id: string; rotulo: string } | null;
};

export type Conciliacao = {
  atsSemCard: AtPendente[];
  cardsSemAt: CCard[];
  atsSemContato: AtPendente[];
  semAlocacao: { userId: string; safraId: string; numero: number; contatos: number }[];
  semCargo: CCard[];
  /** Base dos indicadores de higiene. */
  totais: { ats: number; cards: number };
};

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Card que corresponde à AT: card do outbound ainda sem AT cujo título cita a empresa ou o
 * prospect, do mesmo hunter quando o card diz o hunter. Só com uma candidata; senão null.
 */
export function cardDaAt(
  at: Pick<CAt, "empresa" | "prospect" | "hunter_login">,
  cards: readonly CCard[],
): CCard | null {
  const empresa = norm(at.empresa);
  const prospect = norm(at.prospect);
  if (!empresa && !prospect) return null;
  const candidatos = cards.filter((c) => {
    const t = ` ${norm(c.titulo)} `;
    const cita =
      (!!empresa && t.includes(` ${empresa} `)) || (!!prospect && t.includes(` ${prospect} `));
    const hunterOk = !c.hunter_login || !at.hunter_login || c.hunter_login === at.hunter_login;
    return cita && hunterOk;
  });
  return candidatos.length === 1 ? candidatos[0]! : null;
}

export function computeConciliacao(input: ConciliacaoInput): Conciliacao {
  const { desde } = input;
  const ats = input.ats.filter((a) => diaSP(a.registrada_em) >= desde && a.status !== "cancelada");
  const cards = input.cards.filter(
    (c) => c.status !== "deleted" && (!c.add_time || diaSP(c.add_time) >= desde),
  );
  const comCard = new Set(input.ats.map((a) => a.pipedrive_deal_id).filter((d) => d !== null));
  const cardsSemAt = cards.filter((c) => !comCard.has(c.deal_id));
  const porRegistro = (a: CAt, b: CAt) => b.registrada_em.localeCompare(a.registrada_em);

  const atsSemCard: AtPendente[] = ats
    .filter((a) => a.pipedrive_deal_id === null)
    .sort(porRegistro)
    .map((a) => {
      const c = cardDaAt(a, cardsSemAt);
      return { ...a, sugestao: c && { id: String(c.deal_id), rotulo: c.titulo } };
    });

  const atsSemContato: AtPendente[] = ats
    .filter((a) => a.contact_id === null)
    .sort(porRegistro)
    .map((a) => {
      const meus = input.contatos.filter((c) => c.user_id === a.user_id);
      const id = contatoDaAt(a, meus);
      const c = id ? meus.find((x) => x.id === id) : undefined;
      return {
        ...a,
        sugestao: c ? { id: c.id, rotulo: [c.name, c.company].filter(Boolean).join(" · ") } : null,
      };
    });

  // Contatos por hunter e safra (só safras que usam alocação) sem alocação do hunter nela.
  const comAlocacao = new Set(input.alocacoes.map((a) => `${a.safra_id}|${a.user_id}`));
  const usam = input.safras.filter((s) => s.usa_alocacao);
  const contagem = new Map<string, { userId: string; safra: Safra; contatos: number }>();
  for (const c of input.contatos) {
    const s = safraDaData(diaSP(c.created_at), usam);
    if (!s || comAlocacao.has(`${s.id}|${c.user_id}`)) continue;
    const k = `${s.id}|${c.user_id}`;
    const atual = contagem.get(k) ?? { userId: c.user_id, safra: s, contatos: 0 };
    atual.contatos++;
    contagem.set(k, atual);
  }
  const semAlocacao = [...contagem.values()]
    .map((x) => ({
      userId: x.userId,
      safraId: x.safra.id,
      numero: x.safra.numero,
      contatos: x.contatos,
    }))
    .sort((a, b) => b.numero - a.numero || b.contatos - a.contatos);

  return {
    atsSemCard,
    cardsSemAt: [...cardsSemAt].sort((a, b) => (b.add_time ?? "").localeCompare(a.add_time ?? "")),
    atsSemContato,
    semAlocacao,
    semCargo: cards.filter((c) => !c.cargo?.trim()),
    totais: { ats: ats.length, cards: cards.length },
  };
}
