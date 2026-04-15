"use client";
import { ResourceStatus } from "@/types";
import { STATUS_CONFIG } from "@/lib/utils";
import { useT, UIKey } from "@/contexts/TranslationContext";

const STATUS_KEY: Record<ResourceStatus, UIKey> = {
  open:             "OPEN",
  closed:           "CLOSED",
  closing_soon:     "CLOSING_SOON",
  appointment_only: "APPT_ONLY",
};

export function StatusBadge({ status }: { status: ResourceStatus }) {
  const t = useT();
  const { color } = STATUS_CONFIG[status];
  return (
    <span
      className="inline-block font-mono text-[8px] font-bold tracking-[0.1em] px-2 py-0.5 rounded border"
      style={{ color, borderColor: color + "30", background: color + "10" }}
    >
      {t(STATUS_KEY[status])}
    </span>
  );
}
