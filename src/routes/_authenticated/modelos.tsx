import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { useProfile, useSectorTemplates, useSectors, useTemplates } from "@/hooks/useCadencia";
import { STEPS, renderTemplate } from "@/lib/cadencia";
import { pickTemplate } from "@/lib/fila";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { EXEMPLO, ModeloEtapa } from "@/components/modelos/ModeloEtapa";
import { VARIAVEIS } from "@/components/templateVars";

export const Route = createFileRoute("/_authenticated/modelos")({
  head: () => ({
    meta: [
      { title: "Modelos de mensagem — Outbound NTec" },
      {
        name: "description",
        content:
          "Os modelos da cadência de prospecção: o padrão da equipe e as cadências de cada setor.",
      },
      { property: "og:title", content: "Modelos — Outbound NTec" },
      {
        property: "og:description",
        content:
          "Os modelos da cadência de prospecção: o padrão da equipe e as cadências de cada setor.",
      },
    ],
  }),
  component: Modelos,
});

function Modelos() {
  const { data: templates } = useTemplates();
  const { data: profile } = useProfile();
  const { data: sectors } = useSectors();
  const { data: sectorTemplates } = useSectorTemplates();
  const [sectorId, setSectorId] = useState("");
  const [tab, setTab] = useState("1");
  const hunter = {
    name: profile?.message_name?.trim() || profile?.display_name || "Seu Nome",
    gender: (profile?.gender === "f" ? "f" : "m") as "m" | "f",
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Referência · somente leitura</p>
          <h1 className="mt-1 text-title font-bold">Modelos</h1>
          <p className="mt-2 max-w-3xl text-body text-muted-foreground">
            Contatos de empresas cadastradas recebem a cadência do setor da empresa; etapas sem
            mensagem do setor usam o modelo padrão da equipe.
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
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap justify-start">
          {STEPS.map((step) => {
            const t = pickTemplate(step, sectorId || null, sectorTemplates, templates);
            return (
              <TabsTrigger key={step.n} value={String(step.n)} className="gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "size-2 rounded-full",
                    step.channel === "linkedin" ? "bg-linkedin" : "bg-whatsapp",
                  )}
                />
                {step.label}
                {sectorId && t && (
                  <span
                    className={cn(
                      "text-caption font-semibold",
                      t.fromSector ? "text-success" : "text-subtle-foreground",
                    )}
                  >
                    {t.fromSector ? "própria" : "padrão"}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {STEPS.map((step) => {
          const t = pickTemplate(step, sectorId || null, sectorTemplates, templates);
          return (
            <TabsContent key={step.n} value={String(step.n)}>
              <ModeloEtapa
                step={step}
                template={t}
                sectorChosen={!!sectorId}
                preview={t ? renderTemplate(t.body, EXEMPLO, hunter) : ""}
              />
            </TabsContent>
          );
        })}
      </Tabs>

      <section aria-label="Variáveis" className="space-y-2">
        <p className="text-dense font-semibold text-heading">Variáveis que os modelos aceitam</p>
        <div className="flex flex-wrap gap-2">
          {VARIAVEIS.map((v) => (
            <code
              key={v}
              className="rounded-sm bg-primary-soft px-2 py-0.5 font-mono text-caption text-primary-text-strong"
            >
              {v}
            </code>
          ))}
        </div>
      </section>
    </div>
  );
}
