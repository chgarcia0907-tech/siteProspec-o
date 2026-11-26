import { useState } from "react";
import { toast } from "sonner";
import { CompanyGenderToggle } from "@/components/CompanyGender";
import { IndustrySelect, type SectorChoice } from "@/components/IndustrySelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAddCompanies } from "@/hooks/useCadencia";
import { PorteSelect } from "./PorteSelect";
import { formatBR, todayISO, type CompanyGender } from "@/lib/cadencia";
import {
  normalizeCompany,
  parseCompanyLines,
  weekEndISO,
  weekStartISO,
  type Company,
  type Porte,
  type SectorNode,
} from "@/lib/empresas";
import { errorMessage } from "@/lib/utils";

/** Cadastro de uma ou várias empresas (uma por linha) com o mesmo setor e a mesma semana. */
export function CompanyForm({
  sectors,
  existing,
}: {
  /** `undefined` enquanto os setores carregam. */
  sectors: readonly SectorNode[] | undefined;
  existing: readonly Company[];
}) {
  const add = useAddCompanies();
  const [text, setText] = useState("");
  const [choice, setChoice] = useState<SectorChoice | null>(null);
  const [gender, setGender] = useState<CompanyGender>("feminino");
  const [porte, setPorte] = useState<Porte | null>(null);
  const [day, setDay] = useState(todayISO());
  const week = weekStartISO(day || todayISO());

  const known = new Set(existing.map((c) => normalizeCompany(c.name)));
  const names = parseCompanyLines(text);
  const fresh = names.filter((n) => !known.has(normalizeCompany(n)));
  const repeated = names.length - fresh.length;
  const noSectors = !!sectors && sectors.every((s) => !s.active || s.parent_id);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!choice) {
      toast.error("Escolha o setor da empresa");
      return;
    }
    if (fresh.length === 0) {
      toast.error("Nenhuma empresa nova para cadastrar");
      return;
    }
    add.mutate(
      fresh.map((name) => ({
        name,
        gender,
        sector_id: choice.sector_id,
        // A chave só vai quando há subsetor.
        ...(choice.subsector_id ? { subsector_id: choice.subsector_id } : {}),
        // O porte (opcional) vale para todas as empresas da lista.
        ...(porte ? { porte } : {}),
        week_start: week,
      })),
      {
        onSuccess: (n) => {
          toast.success(n === 1 ? "Empresa cadastrada" : `${n} empresas cadastradas`);
          setText("");
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cadastrar empresas</CardTitle>
      </CardHeader>
      <CardContent>
        {!sectors ? (
          <p className="text-dense text-muted-foreground">Carregando os setores…</p>
        ) : noSectors ? (
          <p className="text-dense text-muted-foreground">
            Nenhum setor cadastrado ainda. Peça ao administrador para criar os setores no Painel
            Admin.
          </p>
        ) : (
          <form className="grid gap-4" onSubmit={submit} aria-label="Cadastrar empresas">
            <div className="space-y-1.5">
              <Label htmlFor="empresas">Empresas (uma por linha)</Label>
              <Textarea
                id="empresas"
                rows={5}
                placeholder={"Ambev\nNatura\nGrupo Boticário"}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              {names.length > 0 && (
                <p className="text-caption text-muted-foreground">
                  {fresh.length} nova{fresh.length === 1 ? "" : "s"}
                  {repeated > 0 && ` · ${repeated} já cadastrada${repeated === 1 ? "" : "s"}`}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <div className="space-y-1.5">
                <Label>Setor</Label>
                <IndustrySelect
                  sectors={sectors}
                  sectorId={choice?.sector_id ?? ""}
                  subsectorId={choice?.subsector_id ?? null}
                  onChange={setChoice}
                  className="w-full"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="porte">Porte (opcional)</Label>
                <PorteSelect
                  id="porte"
                  label="Porte (opcional)"
                  value={porte}
                  onChange={setPorte}
                  className="w-full"
                />
                <p className="text-caption text-muted-foreground">
                  Número de funcionários; vale para todas as empresas da lista.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Concordância</Label>
                <div>
                  <CompanyGenderToggle value={gender} onChange={setGender} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="semana">Semana de prospecção</Label>
                <Input
                  id="semana"
                  type="date"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
                <p className="text-caption text-muted-foreground">
                  {formatBR(week)} a {formatBR(weekEndISO(week))}
                </p>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={add.isPending || fresh.length === 0 || !choice}
              >
                Cadastrar
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
