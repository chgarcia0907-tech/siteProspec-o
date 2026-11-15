// Supabase simulado para os testes de ponta a ponta: auth, PostgREST (filtros usados pelo app,
// paginação de 1.000 linhas) e RPC. Os dados vêm de ./fixtures.mjs; as escritas são registradas
// e podem ser lidas em GET /__mutations. POST /__reset volta ao estado inicial e
// POST /__seed?n=60 acrescenta n contatos simples ao hunter logado.
import http from "node:http";
import { RPC, SERVICE_KEY, U1, USER, initialDb, seedContacts } from "./fixtures.mjs";

const PORT = Number(process.env.MOCK_SUPABASE_PORT ?? 54399);
let db = initialDb();
let mutations = [];

function matchOne(r, k, v) {
  const m = /^(not\.)?(eq|neq|is|in|gte|lte|gt|lt|ilike)\.(.*)$/.exec(v);
  if (!m) return true;
  const [, neg, op, raw] = m;
  const x = r[k];
  let ok;
  if (op === "eq") ok = String(x) === raw;
  else if (op === "neq") ok = String(x) !== raw;
  else if (op === "is") ok = raw === "null" ? x == null : String(x) === raw;
  else if (op === "in")
    ok = raw
      .replace(/^\(|\)$/g, "")
      .split(",")
      .map((s) => s.replace(/"/g, ""))
      .includes(String(x));
  else if (op === "ilike")
    ok = new RegExp(`^${raw.replace(/%/g, ".*")}$`, "i").test(String(x ?? ""));
  else if (x == null) ok = false;
  else
    ok =
      op === "gte"
        ? String(x) >= raw
        : op === "lte"
          ? String(x) <= raw
          : op === "gt"
            ? String(x) > raw
            : String(x) < raw;
  return neg ? !ok : ok;
}

/** or=(a.op.v,b.op.v,and(c.op.v,d.op.v)) */
function matchOr(r, expr) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of expr.replace(/^\(|\)$/g, "")) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur) parts.push(cur);
  const cond = (p) => {
    const i = p.indexOf(".");
    return matchOne(r, p.slice(0, i), p.slice(i + 1));
  };
  return parts.some((part) =>
    part.startsWith("and(") ? part.slice(4, -1).split(",").every(cond) : cond(part),
  );
}

function filterRows(rows, params) {
  let out = rows;
  for (const [k, v] of params) {
    if (k === "or") out = out.filter((r) => matchOr(r, v));
    else if (!["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k))
      out = out.filter((r) => matchOne(r, k, v));
  }
  return out;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "*",
    "access-control-expose-headers": "content-range",
    ...headers,
  });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

http
  .createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
      if (req.method === "OPTIONS") return send(res, 204);
      if (url.pathname === "/__mutations") return send(res, 200, mutations);
      if (url.pathname === "/__reset") {
        db = initialDb();
        mutations = [];
        return send(res, 200, { ok: true });
      }
      if (url.pathname === "/__seed") {
        db.contacts.push(...seedContacts(Number(url.searchParams.get("n") ?? 60)));
        return send(res, 200, { ok: true });
      }
      if (url.pathname === "/auth/v1/user") return send(res, 200, USER);
      if (url.pathname.startsWith("/auth/v1/")) return send(res, 200, {});

      const rpc = /^\/rest\/v1\/rpc\/(\w+)$/.exec(url.pathname);
      if (rpc) return send(res, 200, RPC[rpc[1]] ?? null);
      const t = /^\/rest\/v1\/(\w+)$/.exec(url.pathname);
      if (!t) return send(res, 404, { message: "not found" });
      const table = t[1];

      if (req.method !== "GET" && req.method !== "HEAD") {
        mutations.push({
          method: req.method,
          table,
          query: decodeURIComponent(url.search),
          body: raw,
        });
        return send(res, 201, []);
      }
      // RLS simplificado: com a chave pública, o hunter logado só vê os próprios contatos.
      const isService = (req.headers.authorization ?? "") === `Bearer ${SERVICE_KEY}`;
      let rows = db[table] ?? [];
      if (table === "contacts" && !isService) rows = rows.filter((r) => r.user_id === U1);
      rows = filterRows(rows, url.searchParams);
      if ((req.headers.accept ?? "").includes("vnd.pgrst.object")) {
        if (rows.length !== 1) return send(res, 406, { code: "PGRST116", message: "no rows" });
        return send(res, 200, rows[0]);
      }
      const total = rows.length;
      const off = Number(url.searchParams.get("offset") ?? 0);
      const lim = Math.min(Number(url.searchParams.get("limit") ?? 1000), 1000);
      rows = rows.slice(off, off + lim);
      return send(res, 200, rows, { "content-range": `${off}-${off + rows.length - 1}/${total}` });
    });
  })
  .listen(PORT, "127.0.0.1", () => console.log(`Supabase simulado em http://127.0.0.1:${PORT}`));
