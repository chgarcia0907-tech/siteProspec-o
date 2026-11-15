import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/** Cartão com um nome editável e o botão de salvar (nome na plataforma, nome nas mensagens). */
export function NameCard({
  id,
  title,
  description,
  initial,
  required = false,
  saving,
  onSave,
  savedMessage,
}: {
  id: string;
  title: string;
  description: string;
  /** Valor salvo; `undefined` enquanto o perfil carrega. */
  initial: string | undefined;
  required?: boolean;
  saving: boolean;
  onSave: (value: string, done: { onSuccess: () => void; onError: (e: Error) => void }) => void;
  savedMessage: string;
}) {
  const [value, setValue] = useState("");
  useEffect(() => {
    if (initial !== undefined) setValue(initial);
  }, [initial]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Input
          id={id}
          aria-label={title}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button
          disabled={saving || (required && !value.trim())}
          onClick={() =>
            onSave(value, {
              onSuccess: () => toast.success(savedMessage),
              onError: (e) => toast.error(e.message),
            })
          }
        >
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}
