import { useState } from "react";
import { toast } from "sonner";
import { CompanyGenderToggle } from "@/components/CompanyGender";
import { IndustrySelect } from "@/components/IndustrySelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAddCompanies } from "@/hooks/useCadencia";
import { formatBR, todayISO, type CompanyGender } from "@/lib/cadencia";
import {
  normalizeCompany,
  parseCompanyLines,
  weekEndISO,
  weekStartISO,
  type Company,
  type Sector,
} from "@/lib/empresas";
import { errorMessage } from "@/lib/utils";

/** Cadastro de uma ou várias empresas (uma por linha) com o mesmo setor e a mesma semana. */
export function CompanyForm({
  sectors,
  existing,
}: {
  sectors: readonly Sector[];
  existing: readonly Company[];
}) {
  const add = useAddCompanies();
  const [text, setText] = useState("");
  const [sectorId, setSectorId] = useState("");
  const [gender, setGender] = useState<CompanyGender>("feminino");
  const [day, setDay] = useState(todayISO());
  const week = weekStartISO(day || todayISO());

  const known = new Set(existing.map((c) => normalizeCompany(c.name)));
  const names = parseCompanyLines(text);
  const fresh = names.filter((n) => !known.has(normalizeCompany(n)));
  const repeated = names.length - fresh.length;
  const noSectors = sectors.every((s) => !s.active);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sectorId) {
      toast.error("Escolha o setor da empresa");
      return;
    }
    if (fresh.length === 0) {
      toast.error("Nenhuma empresa nova para cadastrar");
      return;
    }
    add.mutate(
      fresh.map((name) => ({ name, gender, sector_id: sectorId, week_start: week })),
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
        <CardTitle className="text-base">Cadastrar empresas</CardTitle>
      </CardHeader>
      <CardContent>
        {noSectors ? (
          <p className="text-sm text-muted-foreground">
            Nenhum setor cadastrado ainda. Peça ao administrador para criar os setores no Painel
            Admin.
          </p>
        ) : (
          <form className="grid gap-4 md:grid-cols-[1fr_auto]" onSubmit={submit}>
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
                <p className="text-xs text-muted-foreground">
                  {fresh.length} nova{fresh.length === 1 ? "" : "s"}
                  {repeated > 0 && ` · ${repeated} já cadastrada${repeated === 1 ? "" : "s"}`}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3 md:w-64">
              <div className="space-y-1.5">
                <Label>Setor</Label>
                <IndustrySelect
                  sectors={sectors}
                  value={sectorId}
                  onChange={setSectorId}
                  className="w-full"
                />
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
                <p className="text-xs text-muted-foreground">
                  {formatBR(week)} a {formatBR(weekEndISO(week))}
                </p>
              </div>
              <Button type="submit" disabled={add.isPending || fresh.length === 0 || !sectorId}>
                Cadastrar
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
