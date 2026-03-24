import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ResourceCategory, ResourceStatus } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CATEGORY_CONFIG: Record<ResourceCategory, {
  label: string;
  icon: string;
  color: string;
  bg: string;
}> = {
  shelter:  { label: "SHELTER",  icon: "🏠", color: "#3b82f6", bg: "rgba(59,130,246,0.12)"  },
  food:     { label: "FOOD",     icon: "🍽", color: "#22c55e", bg: "rgba(34,197,94,0.12)"   },
  legal:    { label: "LEGAL",    icon: "⚖",  color: "#a855f7", bg: "rgba(168,85,247,0.12)"  },
  medical:  { label: "MEDICAL",  icon: "🏥", color: "#ef4444", bg: "rgba(239,68,68,0.12)"   },
  language: { label: "LANGUAGE", icon: "◈",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
};

export const STATUS_CONFIG: Record<ResourceStatus, {
  label: string;
  color: string;
}> = {
  open:             { label: "OPEN",             color: "#22c55e" },
  closed:           { label: "CLOSED",           color: "#ef4444" },
  closing_soon:     { label: "CLOSING SOON",     color: "#f59e0b" },
  appointment_only: { label: "APPOINTMENT ONLY", color: "#888888" },
};

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}
