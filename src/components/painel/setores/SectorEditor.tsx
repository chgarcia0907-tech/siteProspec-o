import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ChannelBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProfile, useTemplates } from "@/hooks/useCadencia";
import { STEPS, renderTemplate } from "@/lib/cadencia";
import type { Sector, SectorTemplates, TemplateText } from "@/lib/empresas";
import { sectorDelete, sectorSave, sectorSaveCadence } from "@/lib/setores.functions";
import { errorMessage } from "@/lib/utils";
import type { Ask } from "../useConfirm";

const TAGS =
  "[FIRST NAME], [EMPRESA], [NA_EMPRESA], [A_EMPRESA], [DA_EMPRESA], [CARGO], [DOR_DO_SETOR], [NOME], [CONSULTOR], [OBRIGADO], [JANELA], [SAUDACAO]";

type Draft = Record<number, TemplateText>;

/** Edição de um setor (nome, ordem, ativo) e das 5 mensagens da sua cadência. */
export function SectorEditor({
  sector,
  templates,
  companies,
  ask,
  onDeleted,
}: {
  sector: Sector;
  templates: SectorTemplates[string] | undefined;
  companies: number;
  ask: Ask;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const { data: defaults } = useTemplates();
  const { data: profile } = useProfile();
  const save = useServerFn(sectorSave);
  const saveCadence = useServerFn(sectorSaveCadence);
  const del = useServerFn(sectorDelete);
  const [name, setName] = useState(sector.name);
  const [sort, setSort] = useState(String(sector.sort));
  const [active, setActive] = useState(sector.active);
  const [draft, setDraft] = useState<Draft>(
    () =>
      Object.fromEntries(
        STEPS.map((s) => [s.n, templates?.[s.n] ?? { code: "", body: "" }]),
      ) as Draft,
  );
  const [busy, setBusy] = useState(false);
  const hunter = {
    name: profile?.message_name?.trim() || profile?.display_name || "Seu Nome",
    gender: (profile?.gender === "f" ? "f" : "m") as "m" | "f",
  };
  const exemplo = {
    name: "Mariana Souza",
    company: "Acme",
    job_title: "Gerente de Operações",
    sector: "Operações",
  };

  const setStep = (n: number, p: Partial<TemplateText>) =>
    setDraft((d) => ({ ...d, [n]: { ...d[n]!, ...p } }));

  async function run(fn: () => Promise<unknown>, msg: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(msg);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const saveInfo = () =>
    run(async () => {
      await save({
        data: { id: sector.id, name: name.trim(), active, sort: Number(sort) || 0 },
      });
      await qc.invalidateQueries({ queryKey: ["sectors"] });
    }, "Setor salvo");

  const saveSteps = () =>
    run(async () => {
      await saveCadence({
        data: {
          sectorId: sector.id,
          steps: STEPS.map((s) => ({ step: s.n, ...draft[s.n]! })),
        },
      });
      await qc.invalidateQueries({ queryKey: ["sector_templates"] });
    }, "Cadência salva");

  function copyDefaults() {
    setDraft((d) => {
      const next = { ...d };
      for (const s of STEPS) {
        const def = defaults?.[s.n];
        if (def && !next[s.n]!.body.trim()) next[s.n] = { code: def.code, body: def.body };
      }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Setor</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="sn">Nome</Label>
            <Input
              id="sn"
              className="w-64"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="so">Ordem</Label>
            <Input
              id="so"
              type="number"
              min={0}
              className="w-20"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            />
          </div>
          <label className="flex h-9 items-center gap-2 text-sm">
            <Checkbox checked={active} onCheckedChange={(v) => setActive(v === true)} />
            Ativo (aparece para os hunters)
          </label>
          <Button size="sm" disabled={busy || !name.trim()} onClick={saveInfo}>
            Salvar setor
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-destructive"
            disabled={busy}
            onClick={() =>
              companies > 0
                ? toast.error(
                    `Setor usado por ${companies} empresa(s). Desmarque "Ativo" para tirá-lo da lista.`,
                  )
                : ask({
                    title: `Excluir o setor ${sector.name}?`,
                    desc: "O setor e a cadência dele são apagados.",
                    word: "EXCLUIR",
                    action: "Excluir setor",
                    run: async () => {
                      await del({ data: { id: sector.id } });
                      await qc.invalidateQueries({ queryKey: ["sectors"] });
                      await qc.invalidateQueries({ queryKey: ["sector_templates"] });
                      onDeleted();
                    },
                  })
            }
          >
            Excluir setor
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Cadência do setor</h2>
        <p className="text-xs text-muted-foreground">
          Variáveis: {TAGS}. Etapa vazia usa o modelo padrão.
        </p>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={copyDefaults}>
            Preencher vazias com o padrão
          </Button>
          <Button size="sm" disabled={busy} onClick={saveSteps}>
            Salvar cadência
          </Button>
        </div>
      </div>

      {STEPS.map((s) => {
        const t = draft[s.n]!;
        return (
          <Card key={s.n}>
            <CardHeader className="flex-row items-center gap-2 pb-2">
              <ChannelBadge channel={s.channel}>{s.label}</ChannelBadge>
              <Input
                aria-label={`Código da mensagem ${s.label}`}
                placeholder="Código (ex.: VAR-IN01)"
                className="h-7 w-44 font-mono text-xs"
                value={t.code}
                onChange={(e) => setStep(s.n, { code: e.target.value })}
              />
              {!t.body.trim() && (
                <span className="text-xs text-muted-foreground">usa o modelo padrão</span>
              )}
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Textarea
                aria-label={`Mensagem ${s.label}`}
                rows={9}
                className="text-sm"
                placeholder={defaults?.[s.n]?.body}
                value={t.body}
                onChange={(e) => setStep(s.n, { body: e.target.value })}
              />
              <div className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">
                {renderTemplate(
                  t.body.trim() ? t.body : (defaults?.[s.n]?.body ?? ""),
                  exemplo,
                  hunter,
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
