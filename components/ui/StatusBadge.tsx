import { ResourceStatus } from "@/types";
import { STATUS_CONFIG } from "@/lib/utils";

export function StatusBadge({ status }: { status: ResourceStatus }) {
  const { label, color } = STATUS_CONFIG[status];
  return (
    <span
      className="inline-block font-mono text-[8px] font-bold tracking-[0.1em] px-2 py-0.5 rounded border"
      style={{ color, borderColor: color + "30", background: color + "10" }}
    >
      {label}
    </span>
  );
}
