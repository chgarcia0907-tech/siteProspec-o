import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("mantém o tamanho do design system junto com a cor do texto", () => {
    expect(cn("text-kpi text-heading")).toBe("text-kpi text-heading");
    expect(cn("text-dense", "text-heading")).toBe("text-dense text-heading");
    // Escala das páginas públicas (o nome no rodapé e o título de cartaz).
    expect(cn("text-mark", "text-primary-foreground")).toBe("text-mark text-primary-foreground");
    expect(cn("text-display text-heading")).toBe("text-display text-heading");
    // Números de destaque da tela Início.
    expect(cn("text-giant", "text-heading")).toBe("text-giant text-heading");
    expect(cn("text-big text-destructive-text")).toBe("text-big text-destructive-text");
  });

  it("um tamanho novo substitui o anterior; uma cor nova substitui a anterior", () => {
    expect(cn("text-dense", "text-caption")).toBe("text-caption");
    expect(cn("text-muted-foreground", "text-heading")).toBe("text-heading");
  });
});
