import { describe, expect, it } from "vitest";
import {
  buscaDosFiltros,
  filtrosDaBusca,
  filtrosPadrao,
  hunterIdsByName,
  parseIndicadoresBusca,
  resumoFiltros,
  temFiltroAtivo,
  type IndicadoresBusca,
} from "./indicadores";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const G1 = "bbbbbbbb-0000-4000-8000-000000000001";
const P1 = "aaaaaaaa-0000-4000-8000-000000000001";
const TODAY = "2026-11-12";

const options = {
  periods: [{ id: P1, name: "Ciclo 1" }],
  groups: [{ id: G1, name: "Squad Azul" }],
  subgroups: [],
  hunters: [{ id: U1, name: "Hunter Um" }],
  sectors: [],
};

describe("parseIndicadoresBusca", () => {
  it("aceita todos os campos válidos", () => {
    const raw = {
      intervalo: "livre",
      de: "2026-11-01",
      ate: "2026-11-10",
      periodo: P1,
      grupo: G1,
      subgrupo: G1,
      hunter: U1,
      setor: U2,
      canal: "linkedin",
      detalhe: "funil",
      ordem: "late",
      sentido: "asc",
      aberto: U2,
    };
    expect(parseIndicadoresBusca(raw)).toEqual(raw);
  });

  it("remove valores iguais ao padrão", () => {
    expect(
      parseIndicadoresBusca({
        intervalo: "semana",
        canal: "todos",
        detalhe: "execucao",
        ordem: "total",
        sentido: "desc",
      }),
    ).toEqual({});
    expect(parseIndicadoresBusca({ ordem: "hunter", sentido: "asc" })).toEqual({ ordem: "hunter" });
    expect(parseIndicadoresBusca({ ordem: "hunter", sentido: "desc" })).toEqual({
      ordem: "hunter",
      sentido: "desc",
    });
  });

  it("descarta valores inválidos", () => {
    expect(
      parseIndicadoresBusca({
        intervalo: "xyz",
        grupo: "abc",
        canal: "email",
        detalhe: "foo",
        ordem: "drop table",
        sentido: "up",
        aberto: "x",
      }),
    ).toEqual({});
  });

  it("descarta datas inconsistentes junto com o intervalo", () => {
    expect(
      parseIndicadoresBusca({ intervalo: "livre", de: "2026-11-20", ate: "2026-11-01" }),
    ).toEqual({});
    expect(parseIndicadoresBusca({ intervalo: "livre", de: "2026-11-01" })).toEqual({});
    expect(parseIndicadoresBusca({ intervalo: "periodo" })).toEqual({});
    expect(
      parseIndicadoresBusca({ intervalo: "livre", de: "2026-13-40", ate: "2026-13-41" }),
    ).toEqual({});
    expect(
      parseIndicadoresBusca({ intervalo: "livre", de: "2026-02-30", ate: "2026-03-01" }),
    ).toEqual({});
    expect(
      parseIndicadoresBusca({ intervalo: "livre", de: "2026-02-01", ate: "2026-02-30" }),
    ).toEqual({});
  });

  it("ignora de/ate quando o intervalo é um atalho", () => {
    expect(
      parseIndicadoresBusca({ intervalo: "mes", de: "2026-11-01", ate: "2026-11-02" }),
    ).toEqual({ intervalo: "mes" });
  });

  it("descarta tipos estranhos", () => {
    expect(
      parseIndicadoresBusca({
        grupo: 123,
        hunter: [U1],
        setor: { a: 1 },
        canal: ["linkedin"],
        intervalo: 1,
        aberto: null,
      }),
    ).toEqual({});
  });
});

describe("filtrosDaBusca", () => {
  it("padrão é a semana atual", () => {
    expect(filtrosDaBusca({}, TODAY)).toMatchObject({
      preset: "semana",
      from: "2026-11-09",
      to: "2026-11-15",
      channel: "todos",
      groupId: null,
    });
  });

  it("calcula os atalhos em relação a hoje", () => {
    expect(filtrosDaBusca({ intervalo: "semana_passada" }, TODAY)).toMatchObject({
      from: "2026-11-02",
      to: "2026-11-08",
    });
    expect(filtrosDaBusca({ intervalo: "mes" }, TODAY)).toMatchObject({
      from: "2026-11-01",
      to: "2026-11-30",
    });
    expect(filtrosDaBusca({ intervalo: "semana" }, "2026-11-20")).toMatchObject({
      from: "2026-11-16",
      to: "2026-11-22",
    });
  });

  it("usa as datas da URL em livre e periodo", () => {
    const b: IndicadoresBusca = { intervalo: "livre", de: "2026-11-01", ate: "2026-11-10" };
    expect(filtrosDaBusca(b, TODAY)).toMatchObject({
      preset: "livre",
      from: "2026-11-01",
      to: "2026-11-10",
    });
    expect(filtrosDaBusca({ ...b, intervalo: "periodo" }, TODAY).preset).toBe("periodo");
  });
});

describe("buscaDosFiltros", () => {
  it("padrão devolve todas as chaves indefinidas", () => {
    const r = buscaDosFiltros(filtrosPadrao(TODAY));
    expect(Object.keys(r).sort()).toEqual(
      ["ate", "canal", "de", "grupo", "hunter", "intervalo", "periodo", "setor", "subgrupo"].sort(),
    );
    expect(Object.values(r).every((v) => v === undefined)).toBe(true);
  });

  it("ida e volta mantém a busca", () => {
    const casos: IndicadoresBusca[] = [
      {},
      { intervalo: "semana_passada", grupo: G1, canal: "whatsapp" },
      { intervalo: "livre", de: "2026-11-01", ate: "2026-11-10", hunter: U1, periodo: P1 },
      { intervalo: "periodo", de: "2026-10-01", ate: "2026-11-12", setor: U2, subgrupo: G1 },
    ];
    for (const b of casos) {
      expect(parseIndicadoresBusca(buscaDosFiltros(filtrosDaBusca(b, TODAY)))).toEqual(b);
    }
  });

  it("remover um filtro apaga a chave antiga ao mesclar", () => {
    expect(buscaDosFiltros({ ...filtrosPadrao(TODAY), groupId: G1 }).grupo).toBe(G1);
    const r = buscaDosFiltros({ ...filtrosPadrao(TODAY), groupId: null });
    expect("grupo" in r).toBe(true);
    expect(r.grupo).toBeUndefined();
    // Guarda de tipos: o resultado pode ser mesclado na busca (exactOptionalPropertyTypes).
    const antiga: IndicadoresBusca = { grupo: G1, aberto: U2, detalhe: "funil" };
    const merged: IndicadoresBusca = { ...antiga, ...r, detalhe: undefined, aberto: undefined };
    expect(merged.grupo).toBeUndefined();
    expect(merged.detalhe).toBeUndefined();
    expect(merged.aberto).toBeUndefined();
    const base: IndicadoresBusca = {
      ...parseIndicadoresBusca({}),
      ...buscaDosFiltros(filtrosPadrao(TODAY)),
    };
    expect(temFiltroAtivo(base)).toBe(false);
  });
});

describe("temFiltroAtivo", () => {
  it("só conta filtros", () => {
    expect(temFiltroAtivo({})).toBe(false);
    expect(temFiltroAtivo({ detalhe: "funil", ordem: "late", aberto: U1 })).toBe(false);
    expect(temFiltroAtivo({ canal: "linkedin" })).toBe(true);
    expect(temFiltroAtivo({ intervalo: "hoje" })).toBe(true);
  });
});

describe("resumoFiltros", () => {
  it("padrão mostra só o intervalo", () => {
    expect(resumoFiltros(filtrosPadrao(TODAY), options)).toEqual(["Esta semana"]);
  });

  it("lista os filtros na ordem", () => {
    const f = filtrosDaBusca(
      { intervalo: "semana_passada", grupo: G1, hunter: U1, canal: "linkedin" },
      TODAY,
    );
    expect(resumoFiltros(f, options)).toEqual([
      "Semana passada",
      "Squad Azul",
      "Hunter Um",
      "Só LinkedIn",
    ]);
  });

  it("mostra período escolhido, período inteiro e datas livres", () => {
    expect(
      resumoFiltros(
        filtrosDaBusca(
          { intervalo: "periodo", de: "2026-10-01", ate: "2026-11-12", periodo: P1 },
          TODAY,
        ),
        options,
      ),
    ).toEqual(["Período inteiro", "Ciclo 1"]);
    expect(
      resumoFiltros(
        filtrosDaBusca(
          { intervalo: "livre", de: "2026-11-01", ate: "2026-11-10", canal: "whatsapp" },
          TODAY,
        ),
        options,
      ),
    ).toEqual(["01/11 a 10/11", "Só WhatsApp"]);
    expect(
      resumoFiltros(
        filtrosDaBusca({ intervalo: "livre", de: "2026-12-20", ate: "2027-01-05" }, TODAY),
        options,
      ),
    ).toEqual(["20/12/2026 a 05/01/2027"]);
  });

  it("id fora das opções vira rótulo de removido", () => {
    const f = filtrosDaBusca(
      { grupo: U2, setor: U2, subgrupo: U2, hunter: U2, periodo: U2 },
      TODAY,
    );
    expect(resumoFiltros(f, options)).toEqual([
      "Esta semana",
      "Período removido",
      "Grupo removido",
      "Subgrupo removido",
      "Hunter removido",
      "Setor removido",
    ]);
  });
});

describe("hunterIdsByName", () => {
  it("mapeia nomes únicos e ignora repetidos", () => {
    const m = hunterIdsByName([
      { hunter_id: U1, hunter: "Hunter Um" },
      { hunter_id: U2, hunter: "Ana" },
      { hunter_id: "x", hunter: "Ana" },
      { hunter_id: "y", hunter: "" },
    ]);
    expect(m.has("")).toBe(false);
    expect(m.get("Hunter Um")).toBe(U1);
    expect(m.has("Ana")).toBe(false);
  });
});
