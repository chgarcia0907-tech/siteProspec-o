import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useProfile,
  useSaveDisplayName,
  useSaveMessageName,
  useSaveGender,
  useSaveSettings,
  useSettings,
} from "@/hooks/useCadencia";
import { DEFAULT_OFFSETS, STEPS, type Offsets } from "@/lib/cadencia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChannelBadge } from "@/components/StatusBadge";
import { AdminArea } from "@/components/AdminArea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Cadência Outbound" },
      {
        name: "description",
        content: "Defina os intervalos em dias entre os toques da cadência.",
      },
      { property: "og:title", content: "Configurações — Cadência Outbound" },
      {
        property: "og:description",
        content: "Defina os intervalos em dias entre os toques da cadência.",
      },
    ],
  }),
  component: Configuracoes,
});

const KEYS: (keyof Offsets)[] = ["offset1", "offset2", "offset3", "offset4", "offset5"];

function Configuracoes() {
  const { data: settings } = useSettings();
  const save = useSaveSettings();
  const [form, setForm] = useState<Offsets>(DEFAULT_OFFSETS);
  const { data: profile } = useProfile();
  const saveName = useSaveDisplayName();
  const [name, setName] = useState("");
  const saveMsgName = useSaveMessageName();
  const [msgName, setMsgName] = useState("");
  const saveGender = useSaveGender();

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);
  useEffect(() => {
    if (profile) {
      setName(profile.display_name ?? "");
      setMsgName(profile.message_name ?? "");
    }
  }, [profile]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Seus nomes e intervalos da cadência.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nome na plataforma</CardTitle>
          <CardDescription>Exibido no ranking e relatórios da equipe.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            id="nome-completo"
            aria-label="Nome na plataforma"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            disabled={saveName.isPending || !name.trim()}
            onClick={() =>
              saveName.mutate(name, {
                onSuccess: () => toast.success("Nome salvo"),
                onError: (e) => toast.error(e.message),
              })
            }
          >
            Salvar
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nome nas mensagens</CardTitle>
          <CardDescription>
            Assinatura nas mensagens ([NOME] ou [NOME + SOBRENOME]). Se vazio, usa o nome da
            plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            id="nome-mensagens"
            aria-label="Nome nas mensagens"
            value={msgName}
            onChange={(e) => setMsgName(e.target.value)}
          />
          <Button
            disabled={saveMsgName.isPending}
            onClick={() =>
              saveMsgName.mutate(msgName, {
                onSuccess: () => toast.success("Nome das mensagens salvo"),
                onError: (e) => toast.error(e.message),
              })
            }
          >
            Salvar
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gênero para as mensagens</CardTitle>
          <CardDescription>
            Define [CONSULTOR] (consultor/consultora) e [OBRIGADO] (obrigado/obrigada).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={profile?.gender === "f" ? "f" : "m"}
            onValueChange={(v) =>
              saveGender.mutate(v as "m" | "f", {
                onSuccess: () => toast.success("Gênero salvo"),
                onError: (e) => toast.error(e.message),
              })
            }
          >
            <SelectTrigger className="w-48" aria-label="Gênero para as mensagens">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="m">Masculino</SelectItem>
              <SelectItem value="f">Feminino</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
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
      <AdminArea />
    </div>
  );
}
