import { NativeSelect } from "@/components/ui/native-select";
import type { Overview } from "@/hooks/usePainel";
import type { Allocation } from "./shared";

/** Par de selects grupo → subgrupo; trocar o grupo limpa o subgrupo. */
export function GroupSubgroupSelect({
  groups,
  subsOf,
  value,
  onChange,
}: {
  groups: Overview["groups"];
  subsOf: (groupId: string) => Overview["subgroups"];
  value: Allocation;
  onChange: (v: Allocation) => void;
}) {
  const subs = value.groupId ? subsOf(value.groupId) : [];
  return (
    <>
      <NativeSelect
        aria-label="Grupo"
        value={value.groupId}
        onChange={(e) => onChange({ groupId: e.target.value, subgroupId: "" })}
      >
        <option value="">Sem grupo</option>
        {groups.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Subgrupo"
        value={value.subgroupId}
        disabled={!subs.length}
        onChange={(e) => onChange({ ...value, subgroupId: e.target.value })}
      >
        <option value="">Sem subgrupo</option>
        {subs.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </NativeSelect>
    </>
  );
}
