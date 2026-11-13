import { CompanyGenderToggle } from "@/components/CompanyGender";
import { FunnelBadge, FunnelControl } from "@/components/Funnel";
import { InlineInput } from "@/components/InlineInput";
import { SectorSelect } from "@/components/SectorSelect";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  STATUS_LABEL,
  STEPS,
  computedStatus,
  formatBR,
  funnelIndex,
  plannedDates,
  todayISO,
  type Contact,
  type ContactStatus,
  type Holidays,
  type Offsets,
} from "@/lib/cadencia";
import { CONTACT_STATUSES } from "@/lib/contatos";
import { cn } from "@/lib/utils";

/** Linha editável de um contato: dados, etapas da cadência, situação e funil. */
export function ContactRow({
  contact: c,
  offsets,
  holidays,
  selected,
  onToggle,
  onPatch,
  onStatus,
}: {
  contact: Contact;
  offsets: Offsets;
  holidays: Holidays;
  selected: boolean;
  onToggle: () => void;
  onPatch: (changes: Partial<Contact>) => void;
  onStatus: (s: ContactStatus) => void;
}) {
  const planned = plannedDates(c, offsets, holidays);
  const status = computedStatus(c);
  const [step1, ...nextSteps] = STEPS;

  return (
    <TableRow className="align-middle">
      <TableCell>
        <Checkbox checked={selected} onCheckedChange={onToggle} />
      </TableCell>
      <TableCell className="font-medium whitespace-nowrap">
        <InlineInput
          value={c.name}
          placeholder="Nome"
          onCommit={(v) => v.trim() && onPatch({ name: v.trim() })}
        />
      </TableCell>
      <TableCell className="max-w-[260px] truncate text-muted-foreground">
        {c.headline || "—"}
      </TableCell>
      <TableCell>
        <InlineInput
          value={c.job_title}
          placeholder="Cargo"
          onCommit={(v) => onPatch({ job_title: v })}
        />
        {c.headline && (
          <p
            className="mt-0.5 max-w-[240px] truncate text-[11px] text-muted-foreground"
            title={c.headline}
          >
            {c.headline}
          </p>
        )}
      </TableCell>
      <TableCell>
        <SectorSelect
          value={c.sector}
          onChange={(v) => onPatch({ sector: v })}
          className="h-7 w-40 text-xs"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <InlineInput
            value={c.company}
            placeholder="Empresa"
            onCommit={(v) => onPatch({ company: v })}
          />
          <CompanyGenderToggle
            value={c.company_gender ?? "feminino"}
            onChange={(g) => onPatch({ company_gender: g })}
          />
        </div>
      </TableCell>
      <TableCell>
        <InlineInput
          value={c.phone}
          placeholder="(11) 90000-0000"
          onCommit={(v) => onPatch({ phone: v })}
        />
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {formatBR(c.connected_at)}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="flex items-center gap-1">
          <Input
            type="date"
            className="h-7 w-32 text-xs"
            value={c.step1_date ?? ""}
            onChange={(e) => onPatch({ step1_date: e.target.value || null })}
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => onPatch({ step1_date: todayISO(), [step1!.sentField]: todayISO() })}
          >
            Enviei hoje
          </Button>
          <StepCheck
            checked={!!c[step1!.sentField]}
            onToggle={(v) =>
              onPatch({
                [step1!.sentField]: v ? todayISO() : null,
                ...(v && !c.step1_date ? { step1_date: todayISO() } : {}),
              })
            }
          />
        </div>
      </TableCell>
      {nextSteps.map((s) => (
        <TableCell key={s.n} className="whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <span
              className={cn("text-xs", c[s.sentField] ? "text-muted-foreground line-through" : "")}
            >
              {formatBR(planned[s.n])}
            </span>
            <StepCheck
              checked={!!c[s.sentField]}
              onToggle={(v) => onPatch({ [s.sentField]: v ? todayISO() : null })}
            />
          </div>
        </TableCell>
      ))}
      <TableCell>
        {funnelIndex(c) >= 0 ? (
          <FunnelBadge contact={c} />
        ) : (
          <Select value={status} onValueChange={(v) => onStatus(v as ContactStatus)}>
            <SelectTrigger className="h-7 w-[150px] text-xs">
              <SelectValue asChild>
                <span>
                  <StatusBadge status={status} />
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CONTACT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </TableCell>
      <TableCell>
        <FunnelControl contact={c} onPatch={onPatch} />
      </TableCell>
    </TableRow>
  );
}

function StepCheck({ checked, onToggle }: { checked: boolean; onToggle: (v: boolean) => void }) {
  return <Checkbox checked={checked} onCheckedChange={(v) => onToggle(!!v)} title="Enviado" />;
}
