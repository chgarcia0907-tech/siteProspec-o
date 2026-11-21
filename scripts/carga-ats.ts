// Carga única da planilha "Registro de ATs - NTec" para o banco.
//
// Uso (CSVs baixados de cada aba: Arquivo → Fazer download → CSV):
//   bun run db:carga-ats --ats ATs.csv --historico Historico.csv --time Time.csv
//   bun run db:carga-ats --ats ATs.csv --historico Historico.csv --time Time.csv --gravar
//
// Sem --gravar só mostra o plano e os avisos. Com --gravar, precisa de SUPABASE_URL e
// SUPABASE_SERVICE_ROLE_KEY (os mesmos da Vercel) no ambiente. Pode rodar de novo: o time é
// atualizado pelo login e AT que já existe (mesmo card) fica como está, com o log intacto.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { fetchAll } from "../src/lib/fetch-all";
import {
  lerCSV,
  planoDeCarga,
  porCabecalho,
  type ContatoDoHunter,
  type Perfil,
} from "../src/lib/cargaAts";

function arg(nome: string): string | null {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

function csv(nome: string): Record<string, string>[] {
  const caminho = arg(nome);
  if (!caminho) {
    console.error(`Falta --${nome} <arquivo.csv>.`);
    process.exit(1);
  }
  return porCabecalho(lerCSV(readFileSync(caminho, "utf8")));
}

async function main() {
  const gravar = process.argv.includes("--gravar");
  const ats = csv("ats");
  const historico = csv("historico");
  const time = csv("time");

  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const chave = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (gravar && (!url || !chave)) {
    console.error("Para gravar, defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  const db = url && chave ? createClient(url, chave, { auth: { persistSession: false } }) : null;

  let perfis: Perfil[] = [];
  let contatos: ContatoDoHunter[] = [];
  if (db) {
    perfis = await fetchAll<Perfil>((de, ate) =>
      db.from("profiles").select("id, email").order("id").range(de, ate),
    );
    contatos = await fetchAll<ContatoDoHunter>((de, ate) =>
      db.from("contacts").select("id, user_id, name, company").order("id").range(de, ate),
    );
  } else {
    console.log(
      "Sem SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY: hunters e contatos não serão ligados.\n",
    );
  }

  const plano = planoDeCarga({ ats, historico, time, perfis, contatos });

  console.log(`Time: ${plano.time.length} pessoas`);
  console.log(`ATs: ${plano.ats.length}`);
  console.log(`Eventos: ${plano.eventos.length}\n`);
  console.table(
    plano.ats.map((a) => ({
      card: a.pipedrive_deal_id,
      empresa: a.empresa,
      prospect: a.prospect,
      hunter: a.hunter_login,
      conta: a.user_id ? "sim" : "não",
      cn: a.cn_login,
      contato: a.contact_id ? "sim" : "não",
      eventos: plano.eventos.filter((e) => e.pipedrive_deal_id === a.pipedrive_deal_id).length,
    })),
  );
  if (plano.avisos.length) {
    console.log(`\nAvisos (${plano.avisos.length}):`);
    for (const a of plano.avisos) console.log(`  - ${a}`);
  }

  if (!gravar || !db) {
    console.log("\nNada foi gravado. Confira o plano e rode de novo com --gravar.");
    return;
  }

  const t = await db.from("time_comercial").upsert(plano.time, { onConflict: "login" });
  if (t.error) throw t.error;

  const deals = plano.ats.map((a) => a.pipedrive_deal_id);
  const existentes = await db
    .from("ats")
    .select("pipedrive_deal_id")
    .in("pipedrive_deal_id", deals);
  if (existentes.error) throw existentes.error;
  const jaTem = new Set(
    (existentes.data as { pipedrive_deal_id: number }[]).map((r) => r.pipedrive_deal_id),
  );
  const novas = plano.ats.filter((a) => !jaTem.has(a.pipedrive_deal_id));

  let gravados = 0;
  for (const at of novas) {
    const ins = await db.from("ats").insert(at).select("id").single();
    if (ins.error) throw ins.error;
    const atId = (ins.data as { id: string }).id;
    // Um evento por vez: cada insert ganha seu created_at, que desempata eventos no mesmo minuto.
    for (const e of plano.eventos.filter((x) => x.pipedrive_deal_id === at.pipedrive_deal_id)) {
      const { pipedrive_deal_id: _deal, ...evento } = e;
      const ev = await db.from("at_eventos").insert({ ...evento, at_id: atId });
      if (ev.error) throw ev.error;
      gravados++;
    }
  }

  console.log(
    `\nGravado: ${plano.time.length} pessoas do time, ${novas.length} ATs novas e ${gravados} eventos.`,
  );
  if (jaTem.size) console.log(`Já estavam no banco (não mexi): ${[...jaTem].join(", ")}.`);

  const conf = await db
    .from("ats")
    .select("pipedrive_deal_id, empresa, status, agendada_atual")
    .in("pipedrive_deal_id", deals)
    .order("registrada_em");
  if (conf.error) throw conf.error;
  console.log("\nComo ficou no banco:");
  console.table(conf.data);
}

main().catch((e: unknown) => {
  console.error("Falhou:", e instanceof Error ? e.message : JSON.stringify(e));
  process.exit(1);
});
