import { toCSV } from "./cadencia";

/** Baixa um CSV (separado por ";", com BOM para o Excel abrir com acentos). */
export function downloadCsv(filename: string, rows: string[][]) {
  const blob = new Blob(["﻿" + toCSV(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
