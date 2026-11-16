import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChannelBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveSettings, useSettings } from "@/hooks/useCadencia";
import { DEFAULT_OFFSETS, STEPS, type Offsets } from "@/lib/cadencia";

const KEYS: (keyof Offsets)[] = ["offset1", "offset2", "offset3", "offset4", "offset5"];

/** Intervalos da cadência em dias úteis, um por etapa de `STEPS`. */
export function IntervalsCard() {
  const { data: settings } = useSettings();
  const save = useSaveSettings();
  const [form, setForm] = useState<Offsets>(DEFAULT_OFFSETS);
  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Intervalos da cadência (dias úteis)</CardTitle>
        <CardDescription>
          Padrão: 0, 1, 2, 3 e 4 dias úteis. Fins de semana não contam, e cada etapa é contada a
          partir do envio da anterior.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {STEPS.map((step, i) => (
          <div key={step.n} className="flex items-center gap-4">
            <div className="w-32">
              <ChannelBadge channel={step.channel}>{step.label}</ChannelBadge>
            </div>
            <Label htmlFor={`o${step.n}`} className="text-muted-foreground">
              D+
            </Label>
            <Input
              id={`o${step.n}`}
              type="number"
              min={0}
              className="w-24"
              value={form[KEYS[i]!]}
              onChange={(e) => setForm({ ...form, [KEYS[i]!]: Number(e.target.value) })}
            />
            <span className="text-sm text-muted-foreground">dias úteis</span>
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={() =>
              save.mutate(form, {
                onSuccess: () => toast.success("Intervalos salvos"),
                onError: (e) => toast.error(e.message),
              })
            }
            disabled={save.isPending}
          >
            Salvar
          </Button>
          <Button variant="outline" onClick={() => setForm(DEFAULT_OFFSETS)}>
            Restaurar padrão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
