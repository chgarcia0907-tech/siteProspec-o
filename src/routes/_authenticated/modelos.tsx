import { createFileRoute } from "@tanstack/react-router";
import { useProfile, useTemplates } from "@/hooks/useCadencia";
import { STEPS, renderTemplate } from "@/lib/cadencia";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChannelBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/_authenticated/modelos")({
  head: () => ({
    meta: [
      { title: "Modelos de mensagem — Cadência Outbound" },
      {
        name: "description",
        content: "Os 5 modelos padrão da cadência de prospecção, iguais para todos os hunters.",
      },
      { property: "og:title", content: "Modelos — Cadência Outbound" },
      {
        property: "og:description",
        content: "Os 5 modelos padrão da cadência de prospecção, iguais para todos os hunters.",
      },
    ],
  }),
  component: Modelos,
});

const EXEMPLO = {
  name: "Mariana Souza",
  company: "Acme Indústria",
  sector: "Operações",
  job_title: "Gerente de Operações",
};

function Modelos() {
  const { data: templates } = useTemplates();
  const { data: profile } = useProfile();
  const hunter = {
    name: profile?.message_name?.trim() || profile?.display_name || "Seu Nome",
    gender: (profile?.gender === "f" ? "f" : "m") as "m" | "f",
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Modelos</h1>
        <p className="text-sm text-muted-foreground">
          Modelos padrão da equipe (somente leitura). Variáveis: [FIRST NAME], [EMPRESA], [CARGO],
          [DOR_DO_SETOR], [NOME], [CONSULTOR], [OBRIGADO], [JANELA] e [SAUDACAO]. Pré-visualização
          com o contato de exemplo {EXEMPLO.name} · {EXEMPLO.job_title} · {EXEMPLO.company} (setor{" "}
          {EXEMPLO.sector}).
        </p>
      </div>
      {STEPS.map((step) => {
        const t = templates?.[step.n];
        return (
          <Card key={step.n}>
            <CardHeader className="flex-row items-center gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ChannelBadge channel={step.channel}>{step.label}</ChannelBadge>
                <span className="text-xs font-mono text-muted-foreground">{t?.code}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Modelo</p>
                <div className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">
                  {t?.body ?? "Carregando..."}
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Pré-visualização</p>
                <div className="whitespace-pre-wrap rounded-md border bg-card p-3 text-sm">
                  {t ? renderTemplate(t.body, EXEMPLO, hunter) : ""}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
