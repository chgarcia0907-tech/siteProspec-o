import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("mantém o tamanho do design system junto com a cor do texto", () => {
    expect(cn("text-kpi text-heading")).toBe("text-kpi text-heading");
    expect(cn("text-dense", "text-heading")).toBe("text-dense text-heading");
  });

  it("um tamanho novo substitui o anterior; uma cor nova substitui a anterior", () => {
    expect(cn("text-dense", "text-caption")).toBe("text-caption");
    expect(cn("text-muted-foreground", "text-heading")).toBe("text-heading");
  });
});
