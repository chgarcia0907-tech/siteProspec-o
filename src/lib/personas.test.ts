import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PERSONAS,
  PERSONA_LABEL,
  PERSONA_RULES,
  contactPersona,
  isPersona,
  matchPersona,
  suggestPersona,
} from "./personas";

describe("suggestPersona", () => {
  it.each([
    ["Diretor de TI", "owner_tecnologia"],
    ["Coordenador de Logística", "owner_operacao"],
    ["", "owner_operacao"],
    ["Consultor", "owner_operacao"],
  ])("%j → %s", (cargo, esperado) => {
    expect(suggestPersona(cargo)).toBe(esperado);
  });

  it.each([
    // tecnologia
    ["CIO", "owner_tecnologia"],
    ["Chief Technology Officer - CTO", "owner_tecnologia"],
    ["Analista de Sistemas", "owner_tecnologia"],
    ["Especialista em Tecnologia", "owner_tecnologia"],
    ["Tech Lead", "owner_tecnologia"],
    ["ARQUITETA de Soluções", "owner_tecnologia"],
    ["Gerente de Desenvolvimento", "owner_tecnologia"],
    // patrocinador
    ["CEO", "patrocinador_executivo"],
    ["CFO", "patrocinador_executivo"],
    ["Presidente", "patrocinador_executivo"],
    ["Vice-Presidente Comercial", "patrocinador_executivo"],
    ["VP de Vendas", "patrocinador_executivo"],
    ["Diretora Financeira", "patrocinador_executivo"],
    ["Sócia", "patrocinador_executivo"],
    ["Sócios Fundadores", "patrocinador_executivo"],
    ["Cofundador", "patrocinador_executivo"],
    ["Fundadora", "patrocinador_executivo"],
    ["Owner", "patrocinador_executivo"],
    // operação
    ["Gerente de Compras", "owner_operacao"],
    ["Head de Vendas", "owner_operacao"],
    ["Gestora Comercial", "owner_operacao"],
    ["Encarregado de Turno", "owner_operacao"],
    ["Coordenadora de Produção", "owner_operacao"],
    ["Coordenador de Manutenção", "owner_operacao"],
    ["Coordenador de Engenharia", "owner_operacao"],
    // processo
    ["Analista Financeiro", "owner_processo"],
    ["Assistente Administrativo", "owner_processo"],
    ["Especialista em Compras", "owner_processo"],
    ["Supervisor de Produção", "owner_processo"],
    ["Líder de Time", "owner_processo"],
    ["Coordenador de Marketing", "owner_processo"],
  ])("%j → %s (palavras, acento, caixa e feminino)", (cargo, esperado) => {
    expect(suggestPersona(cargo)).toBe(esperado);
  });

  it("segue a prioridade tecnologia → patrocinador → operação → processo", () => {
    expect(suggestPersona("CTO & Co-founder")).toBe("owner_tecnologia");
    expect(suggestPersona("Gerente de Sistemas")).toBe("owner_tecnologia");
    expect(suggestPersona("Head de Tecnologia")).toBe("owner_tecnologia");
    expect(suggestPersona("Coordenador de TI")).toBe("owner_tecnologia");
    expect(suggestPersona("Diretor de Operações")).toBe("patrocinador_executivo");
    expect(suggestPersona("COO")).toBe("patrocinador_executivo");
    expect(suggestPersona("Gerente de Projetos")).toBe("owner_operacao");
  });

  it("casa palavra inteira", () => {
    expect(matchPersona("Estatística")).toBeNull();
    expect(matchPersona("Logística")).toBeNull();
    expect(matchPersona("Gestão de TIme")).toBeNull();
    expect(matchPersona("VPN")).toBeNull();
    expect(matchPersona("Diretoria")).toBeNull();
    expect(matchPersona("Ceo")).toBe("patrocinador_executivo");
    expect(matchPersona("Gestor de TI, Financeiro")).toBe("owner_tecnologia");
  });

  it("trata os casos ambíguos", () => {
    // "desenvolvimento" de negócios não é tecnologia.
    expect(suggestPersona("Desenvolvimento de Negócios")).toBe("owner_operacao");
    expect(suggestPersona("Gerente de Desenvolvimento Comercial")).toBe("owner_operacao");
    expect(suggestPersona("Business Development")).toBe("owner_operacao");
    // Product/process owner não é o dono do negócio.
    expect(matchPersona("Product Owner")).toBeNull();
    expect(matchPersona("Process Owner")).toBeNull();
    expect(suggestPersona("Product Owner")).toBe("owner_operacao");
    // Sem palavra de tecnologia: cai no padrão.
    expect(suggestPersona("Engenheiro de Software")).toBe("owner_operacao");
  });

  it("trata acento solto (texto decomposto) como o acento junto", () => {
    expect(suggestPersona("Li\u0301der de Time")).toBe("owner_processo");
    expect(suggestPersona("Dire\u0301tor de TI")).toBe("owner_tecnologia");
  });

  it("usa o headline quando o cargo não diz nada", () => {
    expect(suggestPersona("", "Diretor de TI | Transformação digital")).toBe("owner_tecnologia");
    expect(suggestPersona("Consultor", "Sócio na Alfa")).toBe("patrocinador_executivo");
    expect(suggestPersona("Analista", "Diretor de TI")).toBe("owner_processo");
    expect(suggestPersona("", "")).toBe("owner_operacao");
  });
});

describe("contactPersona", () => {
  const base = { job_title: "Diretor de TI", headline: "" };
  it("sem persona gravada, sugere pelo cargo", () => {
    expect(contactPersona({ ...base, persona: null })).toEqual({
      persona: "owner_tecnologia",
      suggested: true,
    });
  });
  it("com persona gravada, mesmo igual à sugestão, está confirmada", () => {
    expect(contactPersona({ ...base, persona: "owner_tecnologia" })).toEqual({
      persona: "owner_tecnologia",
      suggested: false,
    });
    expect(contactPersona({ ...base, persona: "owner_processo" }).persona).toBe("owner_processo");
  });
});

describe("lista de personas", () => {
  it("tem as 4 personas, com rótulo", () => {
    expect(PERSONAS.map((p) => p.key)).toEqual([
      "owner_processo",
      "owner_operacao",
      "patrocinador_executivo",
      "owner_tecnologia",
    ]);
    expect(PERSONA_LABEL.patrocinador_executivo).toBe("Patrocinador Executivo");
    expect(isPersona("owner_processo")).toBe(true);
    expect(isPersona("")).toBe(false);
    expect(isPersona(null)).toBe(false);
  });
});

/**
 * Guarda do par TS/SQL: `public.match_persona` repete as regras de `PERSONA_RULES`. Se uma palavra
 * mudar aqui sem migração nova, este teste falha. Confere as palavras e a prioridade, não a
 * semântica do SQL.
 */
describe("par com o SQL (match_persona)", () => {
  const dir = join(process.cwd(), "supabase", "migrations");
  // A migração mais recente que define match_persona vale (uma posterior pode redefini-la).
  const file = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .reverse()
    .find((f) => readFileSync(join(dir, f), "utf8").includes("FUNCTION public.match_persona"));
  const sql = file ? readFileSync(join(dir, file), "utf8") : "";
  const body = sql.slice(sql.indexOf("FUNCTION public.match_persona"));
  const bound = (words: string[]) => `(^|[^a-z0-9])(${words.join("|")})([^a-z0-9]|$)`;

  it("encontra a migração", () => {
    expect(file).toBeTruthy();
  });

  for (const rule of PERSONA_RULES) {
    it(`carrega as palavras de ${rule.persona}`, () => {
      expect(body).toContain(bound(rule.words));
      if (rule.strip) expect(body).toContain(`(${rule.strip.join("|")})`);
      if (rule.contextual) {
        expect(body).toContain(bound(rule.contextual.words));
        expect(body).toContain(`(${rule.contextual.when.join("|")})`);
      }
      expect(body).toContain(`RETURN '${rule.persona}'`);
    });
  }

  it("mantém a ordem de prioridade", () => {
    const pos = PERSONA_RULES.map((r) => body.indexOf(`RETURN '${r.persona}'`));
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
    expect(pos.every((p) => p >= 0)).toBe(true);
  });

  it("tira acento solto no SQL, sem depender de normalize()", () => {
    expect(body).toContain("[\\u0300-\\u036f]");
  });

  it("devolve owner_operacao como padrão em suggest_persona", () => {
    const todas = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .join("\n");
    expect(todas).toContain("public.match_persona(headline), 'owner_operacao'");
  });
});
