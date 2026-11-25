import { describe, expect, it } from "vitest";
import { cadenceInputSchema } from "./setores.schema";

const SETOR = "6f1c1c1e-1b9a-4f43-9c1e-0a8f6d5b2a10";
const passo = (step: number, persona?: string) => ({
  step,
  code: "X",
  body: "texto",
  ...(persona === undefined ? {} : { persona }),
});

describe("entrada de sectorSaveCadence", () => {
  it("sem persona vale como qualquer persona", () => {
    const r = cadenceInputSchema.parse({ sectorId: SETOR, steps: [passo(1)] });
    expect(r.steps[0]!.persona).toBe("");
  });
  it("aceita as quatro personas e qualquer persona na mesma etapa", () => {
    const steps = [
      "",
      "owner_processo",
      "owner_operacao",
      "patrocinador_executivo",
      "owner_tecnologia",
    ].map((p) => passo(1, p));
    expect(cadenceInputSchema.parse({ sectorId: SETOR, steps }).steps).toHaveLength(5);
  });
  it("recusa persona desconhecida", () => {
    expect(() => cadenceInputSchema.parse({ sectorId: SETOR, steps: [passo(1, "xyz")] })).toThrow();
  });
  it("recusa a mesma persona e etapa repetidas", () => {
    expect(() =>
      cadenceInputSchema.parse({
        sectorId: SETOR,
        steps: [passo(1, "owner_processo"), passo(1, "owner_processo")],
      }),
    ).toThrow(/repetidas/);
    // sem persona e com persona vazia são a mesma chave
    expect(() =>
      cadenceInputSchema.parse({ sectorId: SETOR, steps: [passo(2), passo(2, "")] }),
    ).toThrow(/repetidas/);
  });
  it("etapas fora de 1 a 5 e lista vazia são recusadas", () => {
    expect(() => cadenceInputSchema.parse({ sectorId: SETOR, steps: [passo(6)] })).toThrow();
    expect(() => cadenceInputSchema.parse({ sectorId: SETOR, steps: [] })).toThrow();
  });
});
