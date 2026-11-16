import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ChannelBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VARIAVEIS } from "@/components/templateVars";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProfile, useTemplates } from "@/hooks/useCadencia";
import { STEPS, renderTemplate } from "@/lib/cadencia";
import type { Sector, SectorTemplates, TemplateText } from "@/lib/empresas";
import { sectorDelete, sectorSave, sectorSaveCadence } from "@/lib/setores.functions";
import { cn, errorMessage } from "@/lib/utils";
import type { Ask } from "@/components/useConfirm";

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
  const [tab, setTab] = useState("1");
  const bodies = useRef<Record<number, HTMLTextAreaElement | null>>({});
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

  /** Um botão só (DESIGN.md, seção 7): grava os dados do setor e as 5 mensagens. */
  const saveAll = () =>
    run(async () => {
      await save({
        data: { id: sector.id, name: name.trim(), active, sort: Number(sort) || 0 },
      });
      await saveCadence({
        data: {
          sectorId: sector.id,
          steps: STEPS.map((s) => ({ step: s.n, ...draft[s.n]! })),
        },
      });
      await qc.invalidateQueries({ queryKey: ["sectors"] });
      await qc.invalidateQueries({ queryKey: ["sector_templates"] });
    }, "Setor e cadência salvos");

  /** Insere a variável onde está o cursor na mensagem da etapa aberta. */
  function insertVar(n: number, v: string) {
    const el = bodies.current[n];
    const body = draft[n]!.body;
    const at = el ? el.selectionStart : body.length;
    const end = el ? el.selectionEnd : body.length;
    setStep(n, { body: body.slice(0, at) + v + body.slice(end) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + v.length, at + v.length);
    });
  }

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
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle>{sector.name}</CardTitle>
            <CardDescription>
              {companies === 1
                ? "1 empresa usa este setor"
                : `${companies} empresas usam este setor`}
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="destructive-ghost"
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
            <Trash2 strokeWidth={1.75} aria-hidden />
            Excluir setor
          </Button>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="sn">Nome</Label>
            <Input
              id="sn"
              className="w-64"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
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
          <label className="flex h-9 cursor-pointer items-center gap-2 text-dense">
            <Checkbox checked={active} onCheckedChange={(v) => setActive(v === true)} />
            Ativo (aparece para os hunters)
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle>Cadência do setor</CardTitle>
            <CardDescription>
              Etapa sem mensagem própria usa o modelo padrão da equipe.
            </CardDescription>
          </div>
          <Button size="sm" variant="secondary" onClick={copyDefaults}>
            Preencher vazias com o padrão
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="h-auto flex-wrap justify-start">
              {STEPS.map((s) => {
                const propria = !!draft[s.n]!.body.trim();
                return (
                  <TabsTrigger key={s.n} value={String(s.n)} className="gap-2">
                    <span
                      aria-hidden
                      className={cn(
                        "size-2 rounded-full",
                        s.channel === "linkedin" ? "bg-linkedin" : "bg-whatsapp",
                      )}
                    />
                    {s.label}
                    <span
                      className={cn(
                        "text-caption font-semibold",
                        propria ? "text-success" : "text-subtle-foreground",
                      )}
                    >
                      {propria ? "própria" : "padrão"}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {STEPS.map((s) => {
              const t = draft[s.n]!;
              return (
                <TabsContent key={s.n} value={String(s.n)}>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <ChannelBadge channel={s.channel}>{s.label}</ChannelBadge>
                        <Input
                          aria-label={`Código da mensagem ${s.label}`}
                          placeholder="Código (ex.: VAR-IN01)"
                          className="h-8 w-44 font-mono"
                          value={t.code}
                          onChange={(e) => setStep(s.n, { code: e.target.value })}
                        />
                      </div>
                      <Textarea
                        ref={(el) => {
                          bodies.current[s.n] = el;
                        }}
                        aria-label={`Mensagem ${s.label}`}
                        rows={9}
                        placeholder={defaults?.[s.n]?.body}
                        value={t.body}
                        onChange={(e) => setStep(s.n, { body: e.target.value })}
                      />
                      <div className="space-y-1.5">
                        <p className="text-caption text-subtle-foreground">
                          Clique numa variável para inseri-la no cursor:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {VARIAVEIS.map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => insertVar(s.n, v)}
                              className="rounded-sm bg-primary-soft px-2 py-0.5 font-mono text-caption text-primary-text-strong hover:bg-primary/25 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-caption font-semibold text-muted-foreground">
                        Pré-visualização{!t.body.trim() && " (modelo padrão)"}
                      </p>
                      <div className="min-h-48 rounded-lg border bg-surface-inset p-4 text-body whitespace-pre-wrap text-heading">
                        {renderTemplate(
                          t.body.trim() ? t.body : (defaults?.[s.n]?.body ?? ""),
                          exemplo,
                          hunter,
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button disabled={busy || !name.trim()} onClick={saveAll}>
          Salvar setor e cadência
        </Button>
      </div>
    </div>
  );
}
