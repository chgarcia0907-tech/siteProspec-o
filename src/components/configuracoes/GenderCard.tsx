import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSaveGender } from "@/hooks/useCadencia";

/** Gênero do hunter, que define [CONSULTOR] e [OBRIGADO] nas mensagens. Salva ao trocar. */
export function GenderCard({ gender }: { gender: string | undefined }) {
  const save = useSaveGender();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gênero para as mensagens</CardTitle>
        <CardDescription>
          Define [CONSULTOR] (consultor/consultora) e [OBRIGADO] (obrigado/obrigada).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Select
          value={gender === "f" ? "f" : "m"}
          onValueChange={(v) =>
            save.mutate(v as "m" | "f", {
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
  );
}
