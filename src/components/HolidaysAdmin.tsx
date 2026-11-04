import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminAddHoliday, adminRemoveHoliday } from "@/lib/admin.functions";
import { useHolidayList } from "@/hooks/useCadencia";
import { formatBR } from "@/lib/cadencia";

type Fail = { status: string; remaining?: number; lockedUntil?: string };

export function HolidaysAdmin({
  password,
  onFail,
}: {
  password: string;
  onFail: (r: Fail) => void;
}) {
  const qc = useQueryClient();
  const add = useServerFn(adminAddHoliday);
  const remove = useServerFn(adminRemoveHoliday);
  const { data: list } = useHolidayList();
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const byYear = useMemo(() => {
    const m = new Map<string, { date: string; name: string }[]>();
    for (const h of list ?? []) {
      const y = h.date.slice(0, 4);
      if (!m.has(y)) m.set(y, []);
      m.get(y)!.push(h);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [list]);

  async function run(fn: () => Promise<{ status: string }>, ok: string) {
    setBusy(true);
    try {
      const r = await fn();
      if (r.status === "ok") {
        toast.success(ok);
        qc.invalidateQueries({ queryKey: ["holidays"] });
        return true;
      }
      onFail(r as Fail);
      return false;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Feriados</p>
      <p className="text-xs text-muted-foreground">
        Feriados não contam como dia útil na cadência. Inclua emendas, recessos e anos futuros.
      </p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => add({ data: { password, date, name } }), "Feriado salvo")) {
            setDate("");
            setName("");
          }
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="h-date">Data</Label>
          <Input id="h-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="h-name">Nome</Label>
          <Input id="h-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button size="sm" type="submit" disabled={busy || !date || !name.trim()}>
          Adicionar
        </Button>
      </form>
      {byYear.map(([year, items]) => (
        <div key={year} className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground">{year}</p>
          <ul className="divide-y rounded-md border text-sm">
            {items.map((h) => (
              <li key={h.date} className="flex items-center justify-between gap-2 px-3 py-1.5">
                <span>
                  <span className="tabular-nums text-muted-foreground">{formatBR(h.date)}</span> — {h.name}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label={`Remover ${h.name}`}
                  disabled={busy}
                  onClick={() => run(() => remove({ data: { password, date: h.date } }), "Feriado removido")}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
