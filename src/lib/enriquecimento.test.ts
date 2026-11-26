import { describe, expect, it } from "vitest";
import {
  areaFromTitle,
  autoFillPatch,
  autoFillSummary,
  companyFromHeadline,
  groupPatches,
  nivelDoCargo,
  suggestCompany,
} from "./enriquecimento";

describe("empresa pelo headline", () => {
  it.each([
    ["Gerente Comercial na Ambev", "Ambev", "feminino"],
    ["Head de Produto no iFood | Ex-Nubank", "iFood", "masculino"],
    ["CEO @ Vellore", "Vellore", "feminino"],
    ["CTO @Nuvemshop", "Nuvemshop", "feminino"],
    ["Sales Manager at Bild", "Bild", "feminino"],
    ["Gerente de Vendas do Grupo Boticário", "Grupo Boticário", "masculino"],
    ["Diretora da Área de RH da Natura", "Natura", "feminino"],
    ["Gerente na Ambev em São Paulo", "Ambev", "feminino"],
    ["Analista de Dados na XP Inc. | Python | SQL", "XP Inc", "feminino"],
    [
      "Coordenadora de TI no Hospital Sírio-Libanês, São Paulo",
      "Hospital Sírio-Libanês",
      "masculino",
    ],
    ["Ex-Google | Engenheira de Software no Itaú Unibanco", "Itaú Unibanco", "masculino"],
    ["Johnson & Johnson | Gerente na Johnson & Johnson", "Johnson & Johnson", "feminino"],
    ["Analista na 99", "99", "feminino"],
  ])("%s", (headline, name, gender) => {
    expect(companyFromHeadline(headline)).toEqual({ name, gender });
  });

  it.each([
    "CEO",
    "Diretor Financeiro | ESG | Report GRI",
    "Especialista em Vendas B2B",
    "Ajudo empresas a crescer no digital",
    "Analista na área de dados",
    "Estudante de Engenharia na USP",
    "Aberto a oportunidades na área comercial",
    "Ex-gerente na Ambev",
    "Consultor no mercado financeiro",
    "Gerente na empresa de logística da família há mais de vinte anos de mercado",
    "contato: joao@empresa.com",
    "",
  ])("sem empresa clara: %s", (headline) => {
    expect(companyFromHeadline(headline)).toBeNull();
  });
});

describe("área pelo cargo", () => {
  it.each([
    ["Engenheiro de Software", "Tecnologia / TI"],
    ["CTO", "Tecnologia / TI"],
    ["Gerente de TI", "Tecnologia / TI"],
    ["Cientista de Dados", "Tecnologia / TI"],
    ["IT Manager", "Tecnologia / TI"],
    ["Tech Recruiter", "RH"],
    ["Analista de Recursos Humanos", "RH"],
    ["HRBP", "RH"],
    ["Head de Gente e Gestão", "RH"],
    ["Gerente de Marketing de Produto", "Marketing"],
    ["Product Marketing Manager", "Marketing"],
    ["Coordenadora de Comunicação", "Marketing"],
    ["Diretor Comercial e de Marketing", "Comercial / Vendas"],
    ["Executiva de Contas", "Comercial / Vendas"],
    ["SDR", "Comercial / Vendas"],
    ["Customer Success Manager", "Comercial / Vendas"],
    ["Product Owner", "Produto / Inovação"],
    ["Gerente de Inovação", "Produto / Inovação"],
    ["UX Designer", "Produto / Inovação"],
    ["Gerente de Operações", "Operações"],
    ["Coordenador de Logística", "Operações"],
    ["Engenheira de Produção", "Operações"],
    ["Supply Chain Manager", "Operações"],
  ])("%s → %s", (cargo, area) => expect(areaFromTitle(cargo)).toBe(area));

  it("usa o headline quando o cargo não diz a área", () => {
    expect(areaFromTitle("Gerente", "Gerente | Vendas B2B | SaaS")).toBe("Comercial / Vendas");
  });

  it.each(["CEO", "Sócio-fundador", "Diretor Financeiro", "Mídia e entretenimento", "", "Gerente"])(
    "sem área: %s",
    (cargo) => expect(areaFromTitle(cargo)).toBeNull(),
  );
});

describe("nível pelo cargo", () => {
  it.each([
    ["CEO", "c_level"],
    ["CTO", "c_level"],
    ["Sócio-fundador", "c_level"],
    ["Sócio-diretor", "c_level"],
    ["Co-founder & CEO", "c_level"],
    ["Vice-presidente de Operações", "c_level"],
    ["Diretor Comercial e de Marketing", "diretoria"],
    ["Diretor Financeiro", "diretoria"],
    ["Superintendente de Operações", "diretoria"],
    ["Gerente de TI", "gerencia"],
    ["IT Manager", "gerencia"],
    ["Head de Gente e Gestão", "gerencia"],
    ["Customer Success Manager", "gerencia"],
    ["Gestora de Facilities", "gerencia"],
    ["Coordenadora de Comunicação", "coordenacao"],
    ["Coordenador de Logística", "coordenacao"],
    ["Supervisor de Produção", "coordenacao"],
    ["Líder de Qualidade", "coordenacao"],
    ["Analista de Recursos Humanos", "analista"],
    ["Engenheira de Produção", "analista"],
    ["Engenheiro de Software", "analista"],
    ["Executiva de Contas", "analista"],
    ["Especialista em Supply Chain", "analista"],
    ["Estagiária de Marketing", "estagio"],
    ["Trainee de Engenharia", "estagio"],
  ])("%s → %s", (cargo, nivel) => expect(nivelDoCargo(cargo)).toBe(nivel));

  it("product owner e tech lead não dizem o nível", () => {
    expect(nivelDoCargo("Product Owner")).toBeNull();
    expect(nivelDoCargo("Tech Lead")).toBeNull();
    expect(nivelDoCargo("Senior Product Owner")).toBeNull();
  });

  it("não confunde assistente de diretoria nem presidência com o cargo do chefe", () => {
    expect(nivelDoCargo("Assistente de Diretoria")).toBe("analista");
    expect(nivelDoCargo("Assistente da Presidência")).toBe("analista");
  });

  it("usa o headline quando o cargo não diz o nível", () => {
    expect(nivelDoCargo("", "Gerente de Operações | Logística")).toBe("gerencia");
    expect(nivelDoCargo("Operações", "Diretor na Ambev")).toBe("diretoria");
  });

  it.each(["", "Mídia e entretenimento", "UX Designer", "SDR"])("sem nível: %s", (cargo) =>
    expect(nivelDoCargo(cargo)).toBeNull(),
  );
});

describe("preenchimento automático", () => {
  const companies = [
    { id: "amb", name: "Ambev" },
    { id: "xp", name: "XP Investimentos" },
  ];
  const c = (over: Partial<Parameters<typeof autoFillPatch>[0]>) => ({
    headline: "",
    job_title: "",
    company: "",
    company_id: null,
    company_gender: "feminino" as const,
    sector: "",
    ...over,
  });

  it("prefere a empresa cadastrada citada no headline", () => {
    expect(suggestCompany("Gerente de Marketing na Ambev", companies)).toEqual({
      company_id: "amb",
    });
    expect(suggestCompany("Gerente no Itaú", companies)).toEqual({
      company: "Itaú",
      company_gender: "masculino",
    });
    expect(suggestCompany("Gerente", companies)).toBeNull();
  });

  it("preenche empresa e área vazias", () => {
    expect(
      autoFillPatch(
        c({ headline: "Gerente de Marketing no Itaú", job_title: "Gerente de Marketing" }),
        companies,
      ),
    ).toEqual({ company: "Itaú", company_gender: "masculino", sector: "Marketing" });
  });

  it("nunca troca o que o hunter já preencheu", () => {
    const filled = c({
      headline: "Gerente de Marketing no Itaú",
      job_title: "Gerente de Marketing",
      company: "Banco Itaú",
      sector: "RH",
    });
    expect(autoFillPatch(filled, companies)).toBeNull();
    expect(autoFillPatch(c({ company_id: "xp", headline: "CTO na Ambev" }), companies)).toEqual({
      sector: "Tecnologia / TI",
    });
  });

  it("vincula a empresa escrita à mão igual a uma cadastrada", () => {
    expect(autoFillPatch(c({ company: "ambev " }), companies)).toEqual({ company_id: "amb" });
  });

  it("resume e agrupa as alterações", () => {
    const items = [
      { id: "1", patch: { sector: "RH" } },
      { id: "2", patch: { company_id: "amb", sector: "RH" } },
      { id: "3", patch: { sector: "RH" } },
      { id: "4", patch: { sector: "RH", company_id: "amb" } },
      { id: "5", patch: { company: "Itaú", company_gender: "masculino" as const } },
    ];
    expect(autoFillSummary(items.map((i) => i.patch))).toEqual({
      contacts: 5,
      linked: 2,
      named: 1,
      areas: 4,
    });
    expect(groupPatches(items).map((g) => g.ids)).toEqual([["1", "3"], ["2", "4"], ["5"]]);
  });
});
