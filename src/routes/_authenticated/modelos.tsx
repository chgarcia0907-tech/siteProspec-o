import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { useProfile, useSectorTemplates, useSectors, useTemplates } from "@/hooks/useCadencia";
import { STEPS, renderTemplate } from "@/lib/cadencia";
import { pickTemplate } from "@/lib/fila";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChannelBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/_authenticated/modelos")({
  head: () => ({
    meta: [
      { title: "Modelos de mensagem — Cadência Outbound" },
      {
        name: "description",
        content:
          "Os modelos da cadência de prospecção: o padrão da equipe e as cadências de cada setor.",
      },
      { property: "og:title", content: "Modelos — Cadência Outbound" },
      {
        property: "og:description",
        content:
          "Os modelos da cadência de prospecção: o padrão da equipe e as cadências de cada setor.",
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
  const { data: sectors } = useSectors();
  const { data: sectorTemplates } = useSectorTemplates();
  const [sectorId, setSectorId] = useState("");
  const hunter = {
    name: profile?.message_name?.trim() || profile?.display_name || "Seu Nome",
    gender: (profile?.gender === "f" ? "f" : "m") as "m" | "f",
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Modelos</h1>
        <p className="text-sm text-muted-foreground">
          Modelos da equipe (somente leitura). Contatos de empresas cadastradas recebem a cadência
          do setor da empresa; etapas sem mensagem do setor usam o modelo padrão. Variáveis: [FIRST
          NAME], [EMPRESA], [CARGO], [DOR_DO_SETOR], [NOME], [CONSULTOR], [OBRIGADO], [JANELA] e
          [SAUDACAO]. Pré-visualização com o contato de exemplo {EXEMPLO.name} · {EXEMPLO.job_title}{" "}
          · {EXEMPLO.company} (setor {EXEMPLO.sector}).
        </p>
      </div>
      <NativeSelect
        aria-label="Cadência"
        className="w-72"
        value={sectorId}
        onChange={(e) => setSectorId(e.target.value)}
      >
        <option value="">Modelo padrão da equipe</option>
        {(sectors ?? [])
          .filter((s) => s.active)
          .map((s) => (
            <option key={s.id} value={s.id}>
              Setor: {s.name}
            </option>
          ))}
      </NativeSelect>
      {STEPS.map((step) => {
        const t = pickTemplate(step, sectorId || null, sectorTemplates, templates);
        return (
          <Card key={step.n}>
            <CardHeader className="flex-row items-center gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ChannelBadge channel={step.channel}>{step.label}</ChannelBadge>
                <span className="text-xs font-mono text-muted-foreground">{t?.code}</span>
                {sectorId && t && !t.fromSector && (
                  <span className="text-xs font-normal text-muted-foreground">
                    (sem mensagem do setor — modelo padrão)
                  </span>
                )}
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
