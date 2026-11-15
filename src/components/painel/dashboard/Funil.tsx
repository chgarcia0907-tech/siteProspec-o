import { pct, type Breakdown } from "@/lib/dashboard";
import { BarList, Section } from "./shared";
import { num, pctText, type Dash } from "./format";

/** Funil do intervalo e a taxa de passagem de cada etapa para a seguinte. */
export function Funil({ d }: { d: Dash }) {
  return (
    <Section
      title="Funil no intervalo"
      hint="Etapas registradas no intervalo (mesmo critério do placar). A nota mostra a passagem em relação à etapa anterior."
    >
      <BarList
        items={d.funnel.map((f, i) => {
          const before = i > 0 ? d.funnel[i - 1]!.count : 0;
          return {
            label: f.label,
            value: f.count,
            ...(i > 0 && before ? { note: `(${pctText(pct(f.count, before))})` } : {}),
          };
        })}
        empty="Nenhuma etapa do funil registrada no intervalo."
      />
    </Section>
  );
}

/** Em que etapa da cadência o contato estava quando a AT foi registrada. */
export function OrigemAt({ d }: { d: Dash }) {
  return (
    <Origem
      title="Etapa que gerou a AT"
      hint="Última mensagem enviada antes do registro da AT. Mostra se as etapas finais da cadência trazem reunião."
      items={d.atOrigin}
      empty="Nenhuma AT no intervalo."
    />
  );
}

/** Em que etapa o contato estava quando respondeu, e quanto tempo levou desde o LinkedIn 1. */
export function OrigemResposta({ d }: { d: Dash }) {
  const t = d.responseTime;
  return (
    <Origem
      title="Etapa que gerou a resposta"
      hint={`Última mensagem enviada antes da resposta (sem data de resposta, vale o registro da AT).${
        t.avg === null ? "" : ` Resposta chega em média ${num(t.avg)} dias úteis após o LinkedIn 1.`
      }${
        d.undatedResponses
          ? ` ${num(d.undatedResponses)} respostas marcadas antes de existir a data ficam fora.`
          : ""
      }`}
      items={d.respOrigin}
      empty="Nenhuma resposta no intervalo."
    />
  );
}

function Origem({
  title,
  hint,
  items,
  empty,
}: {
  title: string;
  hint: string;
  items: { label: string; count: number }[];
  empty: string;
}) {
  const total = items.reduce((n, o) => n + o.count, 0);
  return (
    <Section title={title} hint={hint}>
      <BarList
        items={items.map((o) => ({
          label: o.label,
          value: o.count,
          ...(total ? { note: `(${pctText(pct(o.count, total))})` } : {}),
        }))}
        empty={empty}
      />
    </Section>
  );
}

/** Conversão LinkedIn 1 → AT por setor da empresa ou por área do contato. */
export function ConversaoPor({
  title,
  hint,
  rows,
  label,
}: {
  title: string;
  hint: string;
  rows: Breakdown[];
  label: string;
}) {
  return (
    <Section title={title} hint={hint}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem LinkedIn 1 nem ATs no intervalo.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1">{label}</th>
              <th className="py-1 text-right">LinkedIn 1</th>
              <th className="py-1 text-right">ATs</th>
              <th className="py-1 text-right">Conversão</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t">
                <td className="py-1">{r.name}</td>
                <td className="py-1 text-right tabular-nums">{num(r.l1)}</td>
                <td className="py-1 text-right font-medium tabular-nums">{num(r.ats)}</td>
                <td className="py-1 text-right tabular-nums">{pctText(pct(r.ats, r.l1))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

/** Abastecimento da fila e qualidade dos dados dos contatos ativos. */
export function Abastecimento({ d }: { d: Dash }) {
  const s = d.supply;
  const items: { label: string; value: string; hint: string; bad?: boolean }[] = [
    {
      label: "Aguardando início",
      value: num(s.waiting),
      hint: "Contatos importados que ainda não receberam o LinkedIn 1",
    },
    {
      label: "Empresas da semana com contato",
      value: `${num(s.companiesWithContacts)} de ${num(s.companies)}`,
      hint: "Empresas cadastradas nas semanas do intervalo",
      bad: s.companiesWithContacts < s.companies,
    },
    {
      label: "Contatos por empresa",
      value: s.contactsPerCompany === null ? "—" : num(s.contactsPerCompany),
      hint: "Média entre as empresas da semana que têm contato",
    },
    {
      label: "WhatsApp sem telefone",
      value: num(s.noPhone),
      hint: "Em cadência, com WhatsApp previsto até hoje e sem telefone",
      bad: s.noPhone > 0,
    },
    {
      label: "Sem empresa",
      value: num(s.noCompany),
      hint: "Contatos ativos sem empresa (nem cadastrada nem texto)",
    },
    { label: "Sem área", value: num(s.noArea), hint: "Contatos ativos sem área (TI, RH...)" },
  ];
  return (
    <Section
      title="Abastecimento e qualidade dos dados"
      hint="O que garante envios nas próximas semanas. Contagens de agora (exceto empresas da semana)."
    >
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((i) => (
          <div key={i.label} className="rounded-md border p-2" title={i.hint}>
            <dt className="text-xs text-muted-foreground">{i.label}</dt>
            <dd className={`text-lg font-semibold tabular-nums ${i.bad ? "text-destructive" : ""}`}>
              {i.value}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
