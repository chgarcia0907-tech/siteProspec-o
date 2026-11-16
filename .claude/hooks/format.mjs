// Hook PostToolUse (Edit|Write): formata com o prettier do projeto o arquivo que o Claude editou.
// Lê o JSON do evento no stdin; ignora arquivos fora do projeto ou que o prettier não conhece.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const file = JSON.parse(input || "{}").tool_input?.file_path;
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const prettier = path.join(root, "node_modules", ".bin", "prettier");
const rel = file ? path.relative(root, file) : "";

if (file && existsSync(file) && existsSync(prettier) && rel && !rel.startsWith("..")) {
  execFileSync(prettier, ["--write", "--ignore-unknown", file], { cwd: root, stdio: "ignore" });
}
