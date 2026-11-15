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

const declaredText = (declared: number, total: number) =>
  ` Informada pelo hunter em ${num(declared)} de ${num(total)}; nas demais vale a última mensagem enviada antes.`;

/** Mensagem da cadência que gerou a AT. */
export function OrigemAt({ d }: { d: Dash }) {
  const total = d.atOrigin.reduce((n, o) => n + o.count, 0);
  return (
    <Origem
      title="Etapa que gerou a AT"
      hint={`Mensagem que o lead respondeu antes da AT. Mostra se as etapas finais da cadência trazem reunião.${
        total ? declaredText(d.declaredOrigin.ats, total) : ""
      }`}
      items={d.atOrigin}
      empty="Nenhuma AT no intervalo."
    />
  );
}

/** Mensagem que gerou a resposta, e quanto tempo levou desde o LinkedIn 1. */
export function OrigemResposta({ d }: { d: Dash }) {
  const t = d.responseTime;
  const total = d.respOrigin.reduce((n, o) => n + o.count, 0);
  return (
    <Origem
      title="Etapa que gerou a resposta"
      hint={`Mensagem que o lead respondeu (sem data de resposta, vale o registro da AT).${
        total ? declaredText(d.declaredOrigin.responses, total) : ""
      }${
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
            <dd
              className={`text-lg font-semibold tabular-nums ${i.bad ? "text-destructive-text" : ""}`}
            >
              {i.value}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

/** Canal de entrada: por qual canal vieram as respostas e as ATs do intervalo. */
export function CanalEntrada({ d }: { d: Dash }) {
  const resp = d.entryChannels.reduce((n, c) => n + c.responses, 0);
  const ats = d.entryChannels.reduce((n, c) => n + c.ats, 0);
  return (
    <Section
      title="Canal de entrada"
      hint="Canal da mensagem que gerou a resposta ou a AT. Outro canal: ligação, e-mail, indicação ou resposta antes do LinkedIn 1."
    >
      {resp + ats === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma resposta nem AT no intervalo.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1">Canal</th>
              <th className="py-1 text-right">Respostas</th>
              <th className="py-1 text-right">ATs</th>
            </tr>
          </thead>
          <tbody>
            {d.entryChannels.map((c) => (
              <tr key={c.channel} className="border-t">
                <td className="py-1">{c.label}</td>
                <td className="py-1 text-right tabular-nums">
                  {num(c.responses)}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({pctText(pct(c.responses, resp))})
                  </span>
                </td>
                <td className="py-1 text-right font-medium tabular-nums">
                  {num(c.ats)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({pctText(pct(c.ats, ats))})
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

/** Desempenho de cada mensagem (etapa + modelo): qual CTA mais gera resposta e reunião. */
export function Mensagens({ d }: { d: Dash }) {
  return (
    <Section
      title="Mensagens que geram reunião"
      hint="Mensagens enviadas no intervalo e quantas o lead respondeu ou viraram AT (mesmo depois do intervalo). Ordenado pela taxa de AT: o melhor CTA fica no topo. Modelos editados depois do envio contam com o código atual."
    >
      {d.messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma mensagem enviada no intervalo.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1">Etapa</th>
                <th className="py-1">Modelo</th>
                <th className="py-1 text-right">Enviadas</th>
                <th className="py-1 text-right">Respostas</th>
                <th className="py-1 text-right">Taxa de resposta</th>
                <th className="py-1 text-right">ATs</th>
                <th className="py-1 text-right">Taxa de AT</th>
              </tr>
            </thead>
            <tbody>
              {d.messages.map((m) => (
                <tr key={`${m.step}|${m.code}`} className="border-t">
                  <td className="py-1 whitespace-nowrap">{m.step}</td>
                  <td className="py-1">{m.code}</td>
                  <td className="py-1 text-right tabular-nums">{num(m.sent)}</td>
                  <td className="py-1 text-right tabular-nums">{num(m.responses)}</td>
                  <td className="py-1 text-right tabular-nums">
                    {pctText(pct(m.responses, m.sent))}
                  </td>
                  <td className="py-1 text-right font-medium tabular-nums">{num(m.ats)}</td>
                  <td className="py-1 text-right font-medium tabular-nums">
                    {pctText(pct(m.ats, m.sent))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
