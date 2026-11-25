import { ChannelBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StepDef } from "@/lib/cadencia";
import type { TemplateLevel } from "@/lib/fila";

/** Contato fictício usado na pré-visualização dos modelos. */
export const EXEMPLO = {
  name: "Mariana Souza",
  company: "Acme Indústria",
  sector: "Operações",
  job_title: "Gerente de Operações",
};

/** Uma etapa da cadência: o modelo (com as variáveis destacadas) e a pré-visualização ao lado. */
export function ModeloEtapa({
  step,
  template: t,
  origin,
  sectorChosen,
  preview,
}: {
  step: StepDef;
  template: { code: string; body: string; level: TemplateLevel } | null | undefined;
  /** De onde a mensagem vem (`templateOriginLabel`), ex.: "Varejo · Patrocinador Executivo". */
  origin: string;
  /** Um setor está escolhido (mostra a origem e quando a etapa cai no modelo padrão). */
  sectorChosen: boolean;
  preview: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <ChannelBadge channel={step.channel}>{step.label}</ChannelBadge>
            <span className="font-mono text-dense text-muted-foreground">{t?.code}</span>
          </CardTitle>
          {sectorChosen && t && (
            <span className="text-caption text-subtle-foreground">
              {t.level === "padrao" ? "sem mensagem do setor: usa o modelo padrão" : origin}
            </span>
          )}
        </CardHeader>
        <CardContent>
          <p className="mb-1.5 text-caption font-semibold text-muted-foreground">Modelo</p>
          <div
            aria-label={`Modelo ${step.label}`}
            className="min-h-32 rounded-lg border bg-surface-inset p-4 font-mono text-dense whitespace-pre-wrap"
          >
            {t ? <ComVariaveis texto={t.body} /> : "Carregando…"}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Pré-visualização</CardTitle>
          <p className="text-dense text-muted-foreground">
            Com o contato de exemplo {EXEMPLO.name}, {EXEMPLO.job_title} na {EXEMPLO.company} (área{" "}
            {EXEMPLO.sector}).
          </p>
        </CardHeader>
        <CardContent>
          <div
            aria-label={`Pré-visualização ${step.label}`}
            className="min-h-32 rounded-lg border bg-card p-4 text-body whitespace-pre-wrap text-heading"
          >
            {t ? preview : ""}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Texto do modelo com as variáveis ([FIRST NAME], [EMPRESA]...) destacadas. */
function ComVariaveis({ texto }: { texto: string }) {
  return texto.split(/(\[[A-Z_ +]+\])/).map((parte, i) =>
    /^\[[A-Z_ +]+\]$/.test(parte) ? (
      <span key={i} className="text-primary">
        {parte}
      </span>
    ) : (
      parte
    ),
  );
}
