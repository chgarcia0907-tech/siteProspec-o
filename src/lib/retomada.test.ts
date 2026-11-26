import { describe, expect, it } from "vitest";
import {
  concluirRetomada,
  desmarcarRetomada,
  diasDeAtraso,
  erroRetomada,
  marcarRetomada,
  retomadaDoDia,
  retomadaPendente,
  retomadasDoDia,
  textoRetomada,
} from "./retomada";

const HOJE = "2026-11-26";
const c = (o: { name?: string; retomar_em?: string | null; retomado_em?: string | null }) => ({
  name: o.name ?? "Lead",
  retomar_em: o.retomar_em ?? null,
  retomado_em: o.retomado_em ?? null,
});

describe("retomada pendente e do dia", () => {
  it("pendente com data e sem registro de retomado", () => {
    expect(retomadaPendente(c({ retomar_em: "2026-12-10" }))).toBe(true);
    expect(
      retomadaPendente(c({ retomar_em: "2026-12-10", retomado_em: "2026-12-10T12:00:00Z" })),
    ).toBe(false);
    expect(retomadaPendente(c({}))).toBe(false);
  });

  it("entra na fila no dia combinado e continua enquanto não for retomada", () => {
    expect(retomadaDoDia(c({ retomar_em: HOJE }), HOJE)).toBe(true);
    expect(retomadaDoDia(c({ retomar_em: "2026-11-20" }), HOJE)).toBe(true);
    expect(retomadaDoDia(c({ retomar_em: "2026-11-27" }), HOJE)).toBe(false);
  });

  it("a fila mostra as mais atrasadas primeiro", () => {
    const fila = retomadasDoDia(
      [
        c({ name: "Bia", retomar_em: HOJE }),
        c({ name: "Ana", retomar_em: HOJE }),
        c({ name: "Caio", retomar_em: "2026-11-20" }),
        c({ name: "Dani", retomar_em: "2026-12-01" }),
        c({ name: "Eva", retomar_em: "2026-11-01", retomado_em: "2026-11-02T10:00:00Z" }),
      ],
      HOJE,
    );
    expect(fila.map((x) => x.name)).toEqual(["Caio", "Ana", "Bia"]);
  });

  it("conta os dias de atraso e escreve o selo", () => {
    expect(diasDeAtraso(c({ retomar_em: "2026-11-23" }), HOJE)).toBe(3);
    expect(diasDeAtraso(c({ retomar_em: HOJE }), HOJE)).toBe(0);
    expect(textoRetomada(c({ retomar_em: "2026-11-25" }), HOJE)).toBe("Retomar: atrasada 1 dia");
    expect(textoRetomada(c({ retomar_em: HOJE }), HOJE)).toBe("Retomar hoje");
    expect(textoRetomada(c({ retomar_em: "2026-12-10" }), HOJE)).toBe("Retomar em 10/12");
    expect(textoRetomada(c({}), HOJE)).toBe("");
  });
});

describe("marcar, concluir e desmarcar", () => {
  it("data obrigatória, não antes de hoje, motivo opcional até 300 caracteres", () => {
    expect(erroRetomada("", "", HOJE)).toMatch(/Escolha o dia/);
    expect(erroRetomada("2026-11-25", "", HOJE)).toMatch(/antes de hoje/);
    expect(erroRetomada(HOJE, "", HOJE)).toBeNull();
    expect(erroRetomada("2026-12-10", "x".repeat(301), HOJE)).toMatch(/300/);
  });

  it("gera as alterações do contato", () => {
    expect(marcarRetomada("2026-12-10", "  Pediu para dezembro ")).toEqual({
      retomar_em: "2026-12-10",
      retomar_motivo: "Pediu para dezembro",
    });
    expect(marcarRetomada("2026-12-10", "   ")).toEqual({
      retomar_em: "2026-12-10",
      retomar_motivo: null,
    });
    expect(concluirRetomada(new Date("2026-12-10T13:00:00Z"))).toEqual({
      retomado_em: "2026-12-10T13:00:00.000Z",
    });
    expect(desmarcarRetomada()).toEqual({ retomar_em: null });
  });
});
