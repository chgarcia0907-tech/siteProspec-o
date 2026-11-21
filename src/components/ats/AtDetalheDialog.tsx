import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRegistrarEvento, type AtEventoLinha } from "@/hooks/useAts";
import {
  AT_EVENTO_LABEL,
  antecedenciaDias,
  dataHoraSP,
  eventoErro,
  eventoLinha,
  linkDoCard,
  mensagemQueConverteu,
  paraDatetimeLocal,
  type AtLinha,
  type EventoApp,
  type EventoForm,
} from "@/lib/ats";
import { errorMessage } from "@/lib/utils";
import { AtStatusBadge } from "./AtStatusBadge";

const ACOES: { tipo: EventoApp; rotulo: string }[] = [
  { tipo: "realizada", rotulo: "Marcar realizada" },
  { tipo: "remarcada", rotulo: "Remarcar" },
  { tipo: "no_show", rotulo: "No-show" },
  { tipo: "cancelada", rotulo: "Cancelar AT" },
];

const ORIGEM_LABEL: Record<string, string> = {
  app: "plataforma",
  skill: "skill criar-card",
  planilha: "planilha",
  pipedrive_webhook: "Pipedrive",
  pipedrive_reconciliacao: "Pipedrive",
};

/**
 * Detalhe de uma AT: dados da prospecção, linha do tempo do log e, quando a AT não tem card no
 * Pipedrive e a pessoa pode (dono ou admin), as ações de remarcar, no-show, realizada e cancelar.
 */
export function AtDetalheDialog({
  at,
  eventos,
  nomeDe,
  podeAgir,
  onClose,
}: {
  at: AtLinha | null;
  eventos: readonly AtEventoLinha[];
  nomeDe: (login: string | null) => string;
  podeAgir: boolean;
  onClose: () => void;
}) {
  const [acao, setAcao] = useState<EventoApp | null>(null);
  const [form, setForm] = useState<EventoForm>({ quando: "", motivo: "" });
  const registrar = useRegistrarEvento();

  function fechar() {
    setAcao(null);
    setForm({ quando: "", motivo: "" });
    onClose();
  }

  function escolher(tipo: EventoApp) {
    setAcao(tipo);
    setForm({ quando: at ? paraDatetimeLocal(at.agendada_atual) : "", motivo: "" });
  }

  if (!at) return null;
  const erro = acao ? eventoErro(acao, form) : null;
  const doLog = eventos.filter((e) => e.at_id === at.id);
  // Etapa e modelo da cadência quando a AT tem contato; senão, o texto da ficha.
  const mensagem = mensagemQueConverteu(at) ?? at.mensagem_ficha;

  function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!acao || erro || !at) return;
    registrar.mutate(eventoLinha(at.id, acao, form), {
      onSuccess: () => {
        toast.success(`${AT_EVENTO_LABEL[acao]}: ${at.empresa}`);
        setAcao(null);
      },
      onError: (err) => toast.error(errorMessage(err)),
    });
  }

  const dados: [string, string | null][] = [
    ["Prospect", [at.prospect, at.cargo].filter(Boolean).join(" · ")],
    ["Hunter", nomeDe(at.hunter_login)],
    ["CN", nomeDe(at.cn_login)],
    ["Canal", at.canal],
    ["Mensagem que converteu", mensagem],
    ["Setor", at.setor],
    ["Registrada em", dataHoraSP(at.registrada_em)],
    [
      "Antecedência",
      `${antecedenciaDias(at.registrada_em, at.agendada_original)} dias entre o registro e a AT`,
    ],
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {at.empresa}
            <AtStatusBadge status={at.status} remarcacoes={at.remarcacoes} />
          </DialogTitle>
          <DialogDescription>
            AT em {dataHoraSP(at.agendada_atual)}
            {at.remarcacoes > 0 &&
              ` · ${at.remarcacoes === 1 ? "1 remarcação" : `${at.remarcacoes} remarcações`}`}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[180px_1fr] gap-x-4 gap-y-2 text-dense">
          {dados.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-foreground">{v || "—"}</dd>
            </div>
          ))}
          {at.linkedin && (
            <div className="contents">
              <dt className="text-muted-foreground">LinkedIn</dt>
              <dd className="truncate">
                <a
                  href={at.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {at.linkedin}
                </a>
              </dd>
            </div>
          )}
        </dl>
        {at.motivo_prospeccao && (
          <section className="rounded-lg bg-surface-inset p-3">
            <h3 className="text-caption font-semibold text-muted-foreground">Por que prospectou</h3>
            <p className="mt-1 text-dense whitespace-pre-line text-foreground">
              {at.motivo_prospeccao}
            </p>
          </section>
        )}

        <section aria-label="Histórico da AT">
          <h3 className="text-card-title font-semibold text-heading">Histórico</h3>
          <ol className="mt-2 space-y-2 border-l border-border pl-4">
            {doLog.map((e) => (
              <li key={e.id} className="text-dense">
                <span className="font-semibold text-heading">{AT_EVENTO_LABEL[e.evento]}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {dataHoraSP(e.ocorrido_em)} · {ORIGEM_LABEL[e.origem] ?? e.origem}
                </span>
                {e.evento === "remarcada" && e.horario_novo && (
                  <span className="block text-foreground">
                    {e.horario_anterior ? `${dataHoraSP(e.horario_anterior)} → ` : "para "}
                    {dataHoraSP(e.horario_novo)}
                  </span>
                )}
                {e.evento === "marcada" && e.horario_novo && (
                  <span className="block text-foreground">para {dataHoraSP(e.horario_novo)}</span>
                )}
                {e.evento === "etapa_pipedrive" && (
                  <span className="block text-foreground">etapa {e.pipedrive_stage_id}</span>
                )}
                {e.motivo && <span className="block text-muted-foreground">{e.motivo}</span>}
              </li>
            ))}
            {doLog.length === 0 && (
              <li className="text-dense text-muted-foreground">Sem eventos.</li>
            )}
          </ol>
        </section>

        {at.pipedrive_deal_id != null ? (
          <p className="flex items-center justify-between gap-3 rounded-lg bg-surface-inset px-3 py-2 text-dense text-muted-foreground">
            A situação desta AT vem do card no Pipedrive.
            <Button variant="secondary" size="sm" asChild>
              <a href={linkDoCard(at.pipedrive_deal_id)} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden strokeWidth={1.75} />
                Card {at.pipedrive_deal_id}
              </a>
            </Button>
          </p>
        ) : podeAgir ? (
          <section aria-label="Registrar na AT" className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {ACOES.map((a) => (
                <Button
                  key={a.tipo}
                  type="button"
                  size="sm"
                  variant={acao === a.tipo ? "default" : "secondary"}
                  onClick={() => escolher(a.tipo)}
                >
                  {a.rotulo}
                </Button>
              ))}
            </div>
            {acao && (
              <form
                onSubmit={confirmar}
                aria-label={`Registrar ${AT_EVENTO_LABEL[acao]}`}
                className="space-y-3 rounded-lg bg-surface-inset p-3"
              >
                {acao === "remarcada" && (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="ev-quando"
                      className="text-caption font-semibold text-muted-foreground"
                    >
                      Nova data e horário *
                    </label>
                    <Input
                      id="ev-quando"
                      type="datetime-local"
                      value={form.quando}
                      onChange={(e) => setForm((f) => ({ ...f, quando: e.target.value }))}
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <label
                    htmlFor="ev-motivo"
                    className="text-caption font-semibold text-muted-foreground"
                  >
                    {acao === "remarcada" ? "Motivo *" : "Observação"}
                  </label>
                  <Textarea
                    id="ev-motivo"
                    rows={2}
                    value={form.motivo}
                    onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
                    className="text-dense"
                  />
                </div>
                {erro && <p className="text-caption text-warning-text">{erro}</p>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAcao(null)}>
                    Voltar
                  </Button>
                  <Button type="submit" size="sm" disabled={!!erro || registrar.isPending}>
                    Confirmar
                  </Button>
                </div>
              </form>
            )}
          </section>
        ) : (
          <p className="rounded-lg bg-surface-inset px-3 py-2 text-dense text-muted-foreground">
            Só o hunter da AT ou um administrador registram remarcação, no-show e desfecho.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
