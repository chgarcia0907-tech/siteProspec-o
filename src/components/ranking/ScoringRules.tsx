import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FUNNEL, FUNNEL_MAX_POINTS } from "@/lib/cadencia";

/** Regulamento da pontuação (as etapas e pontos do funil vêm do FUNNEL). */
export function ScoringRules() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Como a pontuação é calculada</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>
          <b>Etapas do funil (cumulativas):</b>{" "}
          {FUNNEL.map((f) => `${f.label} +${f.points}`).join(" · ")}. Um projeto vendido soma{" "}
          {FUNNEL_MAX_POINTS} pontos.
        </p>
        <p>
          <b>Data que conta para a AT:</b> o dia em que o hunter registrou a AT na plataforma (não o
          dia da reunião, que continua salvo para consulta).
        </p>
        <p>
          <b>1º AT do período:</b> +5 pontos, uma única vez, para quem registrou a primeira AT do
          período (não entra no ranking semanal).
        </p>
        <p>
          <b>Ciclo da equipe:</b> contam todos os contatos dos membros, pela data em que cada etapa
          foi registrada. O ranking de cada semana usa as mesmas regras, só com o que aconteceu
          naquela semana.
        </p>
        <p>
          <b>Mais ATs da semana:</b> +6 pontos para quem registrou mais ATs em cada semana (segunda
          a domingo, horário de São Paulo). Empatados ganham todos; semanas sem AT não dão bônus. A
          semana atual é parcial.
        </p>
        <p>
          <b>Taxa de conversão:</b> ATs ÷ contatos com LinkedIn 1 enviada (0 se não houver envios).
        </p>
        <p>
          <b>Pontuação final:</b> 0,7 × total de pontos + 0,3 × o número da taxa de conversão (7%
          conta como 7), com 1 casa decimal.
        </p>
      </CardContent>
    </Card>
  );
}
