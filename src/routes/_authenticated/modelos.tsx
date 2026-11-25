import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { useProfile, useSectorCadences, useSectorTree, useTemplates } from "@/hooks/useCadencia";
import { STEPS, renderTemplate } from "@/lib/cadencia";
import { subsectorsOf, topSectors } from "@/lib/empresas";
import { resolveTemplate, templateOriginLabel, type TemplateLevel } from "@/lib/fila";
import { PERSONAS, isPersona, type Persona } from "@/lib/personas";
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

/** Selo de cada aba: de onde a mensagem vem. */
const NIVEL: Record<TemplateLevel, string> = {
  subsetor_persona: "própria do subsetor",
  subsetor: "própria do subsetor",
  setor_persona: "do setor",
  setor: "do setor",
  padrao: "padrão",
};

function Modelos() {
  const { data: templates } = useTemplates();
  const { data: profile } = useProfile();
  const { data: sectors } = useSectorTree();
  const { data: cadences } = useSectorCadences();
  const [sectorId, setSectorId] = useState("");
  const [subsectorId, setSubsectorId] = useState("");
  const [persona, setPersona] = useState<Persona | "">("");
  const [tab, setTab] = useState("1");
  const hunter = {
    name: profile?.message_name?.trim() || profile?.display_name || "Seu Nome",
    gender: (profile?.gender === "f" ? "f" : "m") as "m" | "f",
  };

  const all = sectors ?? [];
  const subsectors = sectorId ? subsectorsOf(all, sectorId).filter((s) => s.active) : [];
  const resolve = (step: (typeof STEPS)[number]) =>
    resolveTemplate({
      step,
      sectorId: sectorId || null,
      subsectorId: subsectorId || null,
      persona: persona || null,
      cadences,
      defaults: templates,
    });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Referência · somente leitura</p>
          <h1 className="mt-1 text-title font-bold">Modelos</h1>
          <p className="mt-2 max-w-3xl text-body text-muted-foreground">
            Cada etapa usa a primeira mensagem que existir, nesta ordem: subsetor e persona,
            subsetor, setor e persona, setor e, por fim, o modelo padrão da equipe. Escolha o setor,
            o subsetor e a persona para ver a cadência que um contato receberia.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-dense text-muted-foreground">
            Setor
            <NativeSelect
              aria-label="Setor"
              className="w-60"
              value={sectorId}
              onChange={(e) => {
                setSectorId(e.target.value);
                setSubsectorId("");
              }}
            >
              <option value="">Modelo padrão da equipe</option>
              {topSectors(all)
                .filter((s) => s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1 text-dense text-muted-foreground">
            Subsetor
            <NativeSelect
              aria-label="Subsetor"
              className="w-60"
              value={subsectorId}
              disabled={subsectors.length === 0}
              onChange={(e) => setSubsectorId(e.target.value)}
            >
              <option value="">Sem subsetor</option>
              {subsectors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1 text-dense text-muted-foreground">
            Persona
            <NativeSelect
              aria-label="Persona"
              className="w-60"
              value={persona}
              disabled={!sectorId}
              onChange={(e) => setPersona(isPersona(e.target.value) ? e.target.value : "")}
            >
              <option value="">Qualquer persona</option>
              {PERSONAS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap justify-start">
          {STEPS.map((step) => {
            const t = resolve(step);
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
                      t.level === "padrao" ? "text-subtle-foreground" : "text-success",
                    )}
                  >
                    {NIVEL[t.level]}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {STEPS.map((step) => {
          const t = resolve(step);
          return (
            <TabsContent key={step.n} value={String(step.n)}>
              <ModeloEtapa
                step={step}
                template={t}
                origin={t ? templateOriginLabel(t, all) : ""}
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
