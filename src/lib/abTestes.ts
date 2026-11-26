// Testes A/B por propriedade da prospecção (fase 8 do plano). Cada teste compara versões de uma
// dimensão (porte, setor, subsetor, persona, nível ou área) nas safras do teste; a versão do
// contato sai do valor dele na dimensão (`valorDaDimensao`). Contato com valor fora das versões não
// entra. Resultado conclusivo só com `amostraMinima` contatos em cada versão e todas as safras do
// teste maduras; antes disso a tela mostra os números como parciais.
//
// Métrica principal: Prospect → AT (contatos com AT ÷ contatos). Com duas ou mais versões, a
// líder é comparada à segunda por um teste de duas proporções (95%).
import type { VCard } from "./dashRitmo";
import {
  contar,
  valorDaDimensao,
  type Contagem,
  type Dimensao,
  type SAt,
  type SContato,
  type SEmpresa,
  type Taxa,
} from "./dashSegmentos";
import { NIVEIS } from "./enriquecimento";
import { PORTES } from "./empresas";
import { PERSONAS } from "./personas";
import { SECTORS } from "./cadencia";
import { diaSP, safraDaData, statusSafra, type Safra } from "./safras";

export type AbVersao = { rotulo: string; valores: readonly string[] };
export type AbTeste = {
  id: string;
  nome: string;
  dimensao: Dimensao;
  descricao: string | null;
  safra_inicial_id: string;
  safra_final_id: string;
  status: "ativo" | "encerrado";
  conclusao: string | null;
  versoes: readonly AbVersao[];
};

export type AbForm = {
  nome: string;
  dimensao: Dimensao;
  descricao: string;
  safra_inicial_id: string;
  safra_final_id: string;
  versoes: AbVersao[];
};

export type ResultadoVersao = Contagem & {
  rotulo: string;
  valores: readonly string[];
  prospectAt: Taxa;
  avanco: Taxa;
};

export type ResultadoAb = {
  testeId: string;
  /** Números das safras do teste. */
  safras: number[];
  safrasMaduras: boolean;
  versoes: ResultadoVersao[];
  /** Contatos das safras do teste fora de todas as versões (ou sem valor na dimensão). */
  fora: number;
  conclusivo: boolean;
  /** Por que ainda não é conclusivo; null quando é. */
  pendencia: string | null;
  /** Versão com a maior Prospect → AT (só quando conclusivo). */
  lider: string | null;
  /** Diferença em pontos percentuais entre a líder e a segunda. */
  diferencaPp: number | null;
  /** A diferença passa no teste de duas proporções (95%)? */
  significativo: boolean | null;
};

/** Opções de valor de cada dimensão, para o cadastro das versões. */
export function opcoesDaDimensao(
  dim: Dimensao,
  setores: readonly { id: string; name: string; parent_id: string | null }[],
): { valor: string; rotulo: string }[] {
  switch (dim) {
    case "setor":
      return setores
        .filter((s) => !s.parent_id)
        .map((s) => ({ valor: s.id, rotulo: s.name }))
        .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
    case "subsetor": {
      const nome = new Map(setores.map((s) => [s.id, s.name]));
      return setores
        .filter((s) => s.parent_id)
        .map((s) => ({ valor: s.id, rotulo: `${nome.get(s.parent_id!) ?? "?"} › ${s.name}` }))
        .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
    }
    case "porte":
      return PORTES.map((p) => ({ valor: p.key, rotulo: `${p.label} funcionários` }));
    case "persona":
      return PERSONAS.map((p) => ({ valor: p.key, rotulo: p.label }));
    case "nivel":
      return NIVEIS.map((n) => ({ valor: n.key, rotulo: n.label }));
    case "area":
      return SECTORS.map((s) => ({ valor: s, rotulo: s }));
  }
}

/** Erro de validação do cadastro de um teste, ou null. */
export function erroTesteAb(
  f: AbForm,
  safras: readonly Pick<Safra, "id" | "numero">[],
): string | null {
  if (!f.nome.trim()) return "Dê um nome ao teste.";
  const ini = safras.find((s) => s.id === f.safra_inicial_id);
  const fim = safras.find((s) => s.id === f.safra_final_id);
  if (!ini || !fim) return "Escolha as safras do teste.";
  if (fim.numero < ini.numero) return "A safra final vem antes da inicial.";
  if (f.versoes.length < 2) return "O teste precisa de pelo menos duas versões.";
  const rotulos = f.versoes.map((v) => v.rotulo.trim().toLowerCase());
  if (rotulos.some((r) => !r)) return "Toda versão precisa de um nome.";
  if (new Set(rotulos).size !== rotulos.length) return "Duas versões com o mesmo nome.";
  const vazia = f.versoes.find((v) => v.valores.length === 0);
  if (vazia) return `Escolha pelo menos um valor para a versão ${vazia.rotulo.trim()}.`;
  const vistos = new Set<string>();
  for (const v of f.versoes)
    for (const x of v.valores) {
      if (vistos.has(x)) return "Um mesmo valor está em duas versões: cada contato cai numa só.";
      vistos.add(x);
    }
  return null;
}

/** Teste de duas proporções: |z| ≥ 1,96 (95%). Null sem base. */
export function duasProporcoes(a: Taxa, b: Taxa): boolean | null {
  if (!a.d || !b.d) return null;
  const p = (a.n + b.n) / (a.d + b.d);
  const erro = Math.sqrt(p * (1 - p) * (1 / a.d + 1 / b.d));
  if (!erro) return null;
  return Math.abs(a.n / a.d - b.n / b.d) / erro >= 1.96;
}

const pct = (t: Taxa) => (t.d ? (t.n / t.d) * 100 : 0);

export function resultadoAb(
  teste: AbTeste,
  ctx: {
    hoje: string;
    safras: readonly Safra[];
    maturacaoSemanas: number;
    amostraMinima: number;
    contatos: readonly SContato[];
    empresas: Readonly<Record<string, SEmpresa>>;
    ats: readonly SAt[];
    cards: Readonly<Record<number, VCard>>;
  },
): ResultadoAb {
  const ordenadas = [...ctx.safras].sort((a, b) => a.numero - b.numero);
  const ini = ordenadas.find((s) => s.id === teste.safra_inicial_id);
  const fim = ordenadas.find((s) => s.id === teste.safra_final_id);
  const doTeste =
    ini && fim ? ordenadas.filter((s) => s.numero >= ini.numero && s.numero <= fim.numero) : [];
  const ids = new Set(doTeste.map((s) => s.id));
  const safrasMaduras =
    doTeste.length > 0 &&
    doTeste.every((s) => statusSafra(s, ctx.hoje, ctx.maturacaoSemanas) === "madura");

  const atsDe = new Map<string, SAt[]>();
  for (const a of ctx.ats) {
    if (!a.contact_id) continue;
    atsDe.set(a.contact_id, [...(atsDe.get(a.contact_id) ?? []), a]);
  }
  const versaoDe = new Map<string, string>();
  for (const v of teste.versoes) for (const x of v.valores) versaoDe.set(x, v.rotulo);
  const porVersao = new Map<string, SContato[]>(teste.versoes.map((v) => [v.rotulo, []]));
  let fora = 0;
  for (const c of ctx.contatos) {
    const s = safraDaData(diaSP(c.created_at), ordenadas);
    if (!s || !ids.has(s.id)) continue;
    const valor = valorDaDimensao(c, teste.dimensao, ctx.empresas);
    const rotulo = valor !== null ? versaoDe.get(valor) : undefined;
    if (rotulo === undefined) fora++;
    else porVersao.get(rotulo)!.push(c);
  }
  const versoes: ResultadoVersao[] = teste.versoes.map((v) => {
    const n = contar(porVersao.get(v.rotulo) ?? [], atsDe, ctx.cards);
    return {
      ...n,
      rotulo: v.rotulo,
      valores: v.valores,
      prospectAt: { n: n.comAt, d: n.contatos },
      avanco: { n: n.avancaram, d: n.realizadas },
    };
  });

  const faltaAmostra = versoes.filter((v) => v.contatos < ctx.amostraMinima);
  const pendencia = !doTeste.length
    ? "As safras do teste não existem mais no ciclo."
    : faltaAmostra.length
      ? `Amostra mínima de ${ctx.amostraMinima} contatos por versão (falta em ${faltaAmostra.map((v) => v.rotulo).join(", ")}).`
      : !safrasMaduras
        ? "Nem todas as safras do teste amadureceram."
        : null;
  const conclusivo = pendencia === null;
  const ranking = [...versoes].sort((a, b) => pct(b.prospectAt) - pct(a.prospectAt));
  const [primeira, segunda] = ranking;
  return {
    testeId: teste.id,
    safras: doTeste.map((s) => s.numero),
    safrasMaduras,
    versoes,
    fora,
    conclusivo,
    pendencia,
    lider: conclusivo && primeira ? primeira.rotulo : null,
    diferencaPp:
      conclusivo && primeira && segunda
        ? Math.round((pct(primeira.prospectAt) - pct(segunda.prospectAt)) * 10) / 10
        : null,
    significativo:
      conclusivo && primeira && segunda
        ? duasProporcoes(primeira.prospectAt, segunda.prospectAt)
        : null,
  };
}
