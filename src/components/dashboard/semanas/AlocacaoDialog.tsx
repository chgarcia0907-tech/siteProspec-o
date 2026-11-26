import { useState, type FormEvent } from "react";
import { IndustrySelect } from "@/components/IndustrySelect";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  alocacaoLimpa,
  erroAlocacao,
  erroDuranteSafra,
  semMeta,
  trocaDeSetor,
  type Alocacao,
  type AlocacaoForm,
} from "@/lib/alocacao";
import { formatBR } from "@/lib/cadencia";
import type { HunterDoCiclo, SetorOpcao } from "@/lib/dashboard.functions";
import { rotuloSafra, type Safra } from "@/lib/safras";
import { errorMessage } from "@/lib/utils";

type Comum = {
  safra: Safra;
  setores: readonly SetorOpcao[];
  /** Linhas da mesma safra (todas). */
  alocacoes: readonly Alocacao[];
  onSalvar: (id: string | null, f: AlocacaoForm) => Promise<void>;
  onClose: () => void;
};

const paiDe = (setores: readonly SetorOpcao[]) =>
  new Map(setores.filter((s) => s.parent_id).map((s) => [s.id, s.parent_id!]));

function useEnvio(
  onSalvar: () => Promise<void>,
  validar: () => string | null,
  onClose: () => void,
) {
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    const invalido = validar();
    if (invalido) return setErro(invalido);
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar();
      onClose();
    } catch (err) {
      setErro(errorMessage(err));
    } finally {
      setSalvando(false);
    }
  }
  return { erro, salvando, enviar };
}

function Erro({ erro }: { erro: string | null }) {
  return erro ? (
    <p role="alert" className="text-dense text-destructive-text">
      {erro}
    </p>
  ) : null;
}

/**
 * Alocar um hunter (ou editar a alocação) antes do início da safra: hunter, setor e subsetor,
 * dupla e metas. Com as duas metas em zero, o motivo é obrigatório. Com a safra em andamento
 * (`emAndamento`), só aloca quem está sem setor, a partir de um dia entre hoje e o domingo.
 */
export function AlocacaoDialog({
  safra,
  setores,
  alocacoes,
  hunters,
  duplas,
  inicial,
  editando,
  emAndamento,
  onSalvar,
  onClose,
}: Comum & {
  hunters: readonly HunterDoCiclo[];
  duplas: readonly string[];
  inicial: AlocacaoForm;
  editando: Alocacao | null;
  /** Safra já começou: dias possíveis para a alocação valer (de hoje ao domingo). */
  emAndamento: { hoje: string; dias: readonly string[] } | null;
}) {
  const [f, setF] = useState<AlocacaoForm>(inicial);
  const outras = alocacoes.filter((a) => a.id !== editando?.id);
  const { erro, salvando, enviar } = useEnvio(
    () => onSalvar(editando?.id ?? null, alocacaoLimpa(f)),
    () =>
      erroAlocacao(f, safra, outras, paiDe(setores)) ??
      (emAndamento ? erroDuranteSafra(f, safra.id, outras, emAndamento.hoje) : null),
    onClose,
  );
  // Com a safra em andamento, quem já tem setor só troca de setor (outro diálogo).
  const alocados = new Set(alocacoes.map((a) => a.user_id));
  const escolhiveis = emAndamento ? hunters.filter((h) => !alocados.has(h.id)) : hunters;
  const nome = hunters.find((h) => h.id === f.user_id)?.name;
  const zerada = semMeta({
    meta_empresas: f.meta_empresas || 0,
    meta_contatos: f.meta_contatos || 0,
  });
  const numero = (v: number) => (Number.isNaN(v) ? "" : v);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editando ? `Editar alocação de ${nome ?? "hunter"}` : "Alocar hunter"}
          </DialogTitle>
          <DialogDescription>
            {rotuloSafra(safra.numero)}, semana de {formatBR(safra.inicio)}. As metas valem para a
            safra inteira.
            {emAndamento &&
              " Safra em andamento: só os contatos criados a partir do dia escolhido entram no setor."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="space-y-4" noValidate>
          {!editando && (
            <div className="space-y-1.5">
              <Label htmlFor="aloc-hunter">Hunter</Label>
              <NativeSelect
                id="aloc-hunter"
                className="w-full"
                value={f.user_id}
                onChange={(e) => setF({ ...f, user_id: e.target.value })}
              >
                <option value="" disabled>
                  Escolha o hunter…
                </option>
                {escolhiveis.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          {emAndamento && (
            <div className="space-y-1.5">
              <Label htmlFor="aloc-desde">A partir de</Label>
              <NativeSelect
                id="aloc-desde"
                className="w-full"
                value={f.vigente_desde}
                onChange={(e) => setF({ ...f, vigente_desde: e.target.value })}
              >
                {emAndamento.dias.map((d) => (
                  <option key={d} value={d}>
                    {formatBR(d)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="aloc-setor">Setor alocado</Label>
            <IndustrySelect
              id="aloc-setor"
              label="Setor alocado"
              placeholder="Escolha o setor…"
              className="w-full"
              sectors={setores}
              sectorId={f.sector_id}
              subsectorId={f.subsector_id}
              onChange={(c) => setF({ ...f, ...c })}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="aloc-dupla">Dupla (opcional)</Label>
              <Input
                id="aloc-dupla"
                list="aloc-duplas"
                maxLength={20}
                value={f.dupla ?? ""}
                onChange={(e) => setF({ ...f, dupla: e.target.value })}
              />
              <datalist id="aloc-duplas">
                {duplas.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aloc-empresas">Meta de empresas</Label>
              <Input
                id="aloc-empresas"
                type="number"
                min={0}
                className="tabular-nums"
                value={numero(f.meta_empresas)}
                onChange={(e) => setF({ ...f, meta_empresas: e.target.valueAsNumber })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aloc-contatos">Meta de contatos</Label>
              <Input
                id="aloc-contatos"
                type="number"
                min={0}
                className="tabular-nums"
                value={numero(f.meta_contatos)}
                onChange={(e) => setF({ ...f, meta_contatos: e.target.valueAsNumber })}
              />
            </div>
          </div>
          {zerada && (
            <div className="space-y-1.5">
              <Label htmlFor="aloc-motivo">Motivo da semana sem prospecção</Label>
              <Input
                id="aloc-motivo"
                maxLength={200}
                placeholder="Ex.: semana de provas"
                value={f.motivo_meta_zero ?? ""}
                onChange={(e) => setF({ ...f, motivo_meta_zero: e.target.value })}
              />
              <p className="text-caption text-muted-foreground">
                Com as metas em zero, o hunter não entra nos alertas de esforço desta safra.
              </p>
            </div>
          )}
          <Erro erro={erro} />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? "Salvando…" : editando ? "Salvar alocação" : "Alocar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Troca de setor com a safra em andamento: só setor, subsetor e o dia em que passa a valer (de
 * hoje ao domingo). Metas e dupla seguem as da alocação atual.
 */
export function TrocaSetorDialog({
  safra,
  setores,
  alocacoes,
  atual,
  nomeHunter,
  dias,
  onSalvar,
  onClose,
}: Comum & { atual: Alocacao; nomeHunter: string; dias: readonly string[] }) {
  const [setor, setSetor] = useState({
    sector_id: atual.sector_id,
    subsector_id: atual.subsector_id,
  });
  const [desde, setDesde] = useState(dias[0] ?? "");
  const nova = trocaDeSetor(atual, setor, desde);
  const { erro, salvando, enviar } = useEnvio(
    () => onSalvar(null, nova!),
    () =>
      !nova
        ? "Escolha um setor diferente do atual."
        : erroAlocacao(nova, safra, alocacoes, paiDe(setores)),
    onClose,
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Trocar setor de {nomeHunter}</DialogTitle>
          <DialogDescription>
            Os contatos criados a partir do dia escolhido entram no setor novo; os de antes
            continuam no atual. Metas e dupla não mudam.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="troca-setor">Setor alocado</Label>
            <IndustrySelect
              id="troca-setor"
              label="Setor alocado"
              className="w-full"
              sectors={setores}
              sectorId={setor.sector_id}
              subsectorId={setor.subsector_id}
              onChange={setSetor}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="troca-desde">A partir de</Label>
            <NativeSelect
              id="troca-desde"
              className="w-full"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            >
              {dias.map((d) => (
                <option key={d} value={d}>
                  {formatBR(d)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Erro erro={erro} />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? "Salvando…" : "Trocar setor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
