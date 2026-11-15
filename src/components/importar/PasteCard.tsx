import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Área para colar a página de conexões do LinkedIn, com o filtro por data de conexão. */
export function PasteCard({
  text,
  onText,
  fromDate,
  onFromDate,
}: {
  text: string;
  onText: (v: string) => void;
  fromDate: string;
  onFromDate: (v: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Texto copiado do LinkedIn</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          rows={12}
          className="font-mono text-xs"
          placeholder={
            "Foto do perfil de Kenny Tan Mei\nKenny Tan Mei\nGraduando em Engenharia Elétrica\nConexão feita em 28 de setembro de 2026\nMensagem"
          }
          value={text}
          onChange={(e) => onText(e.target.value)}
        />
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="from">Importar apenas conexões feitas a partir de</Label>
            <Input
              id="from"
              type="date"
              className="w-48"
              value={fromDate}
              onChange={(e) => onFromDate(e.target.value)}
            />
          </div>
          <Button variant="ghost" onClick={() => onFromDate("")}>
            Sem filtro de data
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
