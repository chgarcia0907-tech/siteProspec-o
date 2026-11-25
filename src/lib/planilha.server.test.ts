import { describe, expect, it } from "vitest";
import { CONTATOS_HEADER, contatoExtraCells } from "./planilha.server";

describe("cabeçalho do CSV de contatos", () => {
  it("mantém as colunas existentes, com os mesmos nomes e a mesma ordem", () => {
    // A planilha lê por posição: mudar algo aqui quebra quem já usa o IMPORTDATA.
    expect(CONTATOS_HEADER.slice(0, -2)).toEqual([
      "Hunter",
      "Nome",
      "Cargo/Headline",
      "Cargo na empresa",
      "Empresa",
      "Setor",
      "Telefone",
      "Data da conexão",
      "LinkedIn 1 prevista",
      "LinkedIn 1 enviada",
      "WhatsApp 1 prevista",
      "WhatsApp 1 enviada",
      "LinkedIn 2 prevista",
      "LinkedIn 2 enviada",
      "WhatsApp 2 prevista",
      "WhatsApp 2 enviada",
      "LinkedIn 3 prevista",
      "LinkedIn 3 enviada",
      "Status",
      "AT marcada",
      "Lead",
      "Proposta marcada",
      "Aprovação verbal",
      "Projeto vendido",
      "Importado em",
      "Período",
      "Grupo",
      "Subgrupo",
    ]);
  });

  it("acrescenta Subsetor e Persona só no fim", () => {
    expect(CONTATOS_HEADER.slice(-2)).toEqual(["Subsetor", "Persona"]);
    expect(CONTATOS_HEADER.slice(-3)[0]).toBe("Subgrupo");
  });
});

describe("células de subsetor e persona", () => {
  const sectorName = new Map([
    ["met", "Metalurgia"],
    ["ind", "Indústria"],
  ]);
  const companyById = new Map([
    ["co1", { subsector_id: "met" }],
    ["co2", { subsector_id: null }],
  ]);
  const ct = (over: Record<string, unknown>) => ({
    company_id: null,
    persona: null,
    job_title: "Diretor de TI",
    headline: "",
    ...over,
  });

  it("sem empresa: subsetor vazio e persona sugerida pelo cargo", () => {
    expect(contatoExtraCells(ct({}) as never, companyById, sectorName)).toEqual([
      "",
      "Owner da Tecnologia",
    ]);
  });
  it("com empresa e subsetor: o nome do subsetor", () => {
    expect(contatoExtraCells(ct({ company_id: "co1" }) as never, companyById, sectorName)[0]).toBe(
      "Metalurgia",
    );
  });
  it("empresa sem subsetor ou sumida: vazio", () => {
    expect(contatoExtraCells(ct({ company_id: "co2" }) as never, companyById, sectorName)[0]).toBe(
      "",
    );
    expect(contatoExtraCells(ct({ company_id: "x" }) as never, companyById, sectorName)[0]).toBe(
      "",
    );
  });
  it("a persona gravada vale no lugar da sugerida", () => {
    expect(
      contatoExtraCells(ct({ persona: "owner_processo" }) as never, companyById, sectorName)[1],
    ).toBe("Owner do Processo");
  });
});
