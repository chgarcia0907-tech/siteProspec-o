import { createFileRoute } from "@tanstack/react-router";
import { AdminArea } from "@/components/configuracoes/AdminArea";
import { GenderCard } from "@/components/configuracoes/GenderCard";
import { IntervalsCard } from "@/components/configuracoes/IntervalsCard";
import { NameCard } from "@/components/configuracoes/NameCard";
import { useProfile, useSaveDisplayName, useSaveMessageName } from "@/hooks/useCadencia";

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

function Configuracoes() {
  const { data: profile } = useProfile();
  const saveName = useSaveDisplayName();
  const saveMsgName = useSaveMessageName();

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Referência</p>
        <h1 className="mt-1 text-title font-bold">Configurações</h1>
        <p className="mt-2 text-body text-muted-foreground">
          Seus nomes, como as mensagens falam de você e os intervalos da cadência.
        </p>
      </header>
      <div className="grid grid-cols-2 items-start gap-6">
        <div className="space-y-6">
          <NameCard
            id="nome-completo"
            title="Nome na plataforma"
            description="Exibido nos relatórios da equipe."
            initial={profile ? (profile.display_name ?? "") : undefined}
            required
            saving={saveName.isPending}
            onSave={(v, done) => saveName.mutate(v, done)}
            savedMessage="Nome salvo"
          />
          <NameCard
            id="nome-mensagens"
            title="Nome nas mensagens"
            description="Assinatura nas mensagens ([NOME] ou [NOME + SOBRENOME]). Se vazio, usa o nome da plataforma."
            initial={profile ? (profile.message_name ?? "") : undefined}
            saving={saveMsgName.isPending}
            onSave={(v, done) => saveMsgName.mutate(v, done)}
            savedMessage="Nome das mensagens salvo"
          />
          <GenderCard gender={profile?.gender} />
        </div>
        <IntervalsCard />
      </div>
      <AdminArea />
    </div>
  );
}
