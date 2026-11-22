// Entrada de `sectorSaveCadence`, separada para dar para testar sem server function.
import { z } from "zod";
import { STEPS } from "./cadencia";
import { PERSONA_KEYS, isPersona, type Persona } from "./personas";

export const cadenceInputSchema = z.object({
  sectorId: z.string().uuid(),
  steps: z
    .array(
      z.object({
        step: z.number().int().min(1).max(STEPS.length),
        persona: z
          .string()
          .refine((v) => v === "" || isPersona(v), "Persona inválida")
          .transform((v) => v as Persona | "")
          .default(""),
        code: z.string().trim().max(20),
        body: z.string().max(4000),
      }),
    )
    .min(1)
    .max(STEPS.length * (PERSONA_KEYS.length + 1))
    // Duas linhas com a mesma (persona, etapa) fariam o upsert falhar ("ON CONFLICT DO UPDATE
    // command cannot affect row a second time").
    .refine(
      (steps) => new Set(steps.map((s) => `${s.persona}:${s.step}`)).size === steps.length,
      "Há etapas repetidas para a mesma persona",
    ),
});
