"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { CATEGORY_CONFIG } from "@/lib/utils";
import { ResourceCategory } from "@/types";

interface ReportModalProps {
  onClose: () => void;
  selectedState?: string | null;
}

interface FormState {
  name: string;
  category: ResourceCategory | "";
  address: string;
  city: string;
  phone: string;
  notes: string;
}

const INITIAL: FormState = { name: "", category: "", address: "", city: "", phone: "", notes: "" };

export function ReportModal({ onClose, selectedState }: ReportModalProps) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const overlayRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus first input on open
  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set(field: keyof FormState, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.category || !form.address || !form.city) return;
    setStatus("submitting");
    try {
      const res = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          state: selectedState ?? "NY",
          status: "open",
          urgent: false,
          verified: false,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("success");
      setTimeout(onClose, 1800);
    } catch {
      setStatus("error");
    }
  }

  const isSubmitting = status === "submitting";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="w-full max-w-md bg-[#111] border border-white/[0.12] rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <div>
            <div className="font-mono text-[9px] text-[#444] tracking-[0.12em] mb-0.5">SUBMIT</div>
            <h2 id="modal-title" className="font-mono text-[13px] font-bold text-white tracking-[0.05em]">
              REPORT MISSING RESOURCE
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 flex items-center justify-center rounded-md text-[#555] hover:text-white hover:bg-white/[0.08] transition-all"
          >
            ✕
          </button>
        </div>

        {status === "success" ? (
          <div className="px-5 py-10 flex flex-col items-center gap-3 text-center">
            <div className="text-4xl">✓</div>
            <div className="font-mono text-[11px] font-bold text-[#22c55e] tracking-[0.1em]">SUBMITTED</div>
            <p className="font-sans text-[12px] text-[#888]">
              Thank you. Your submission will be reviewed and added shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Resource name */}
              <Field label="RESOURCE NAME *">
                <input
                  ref={firstInputRef}
                  type="text"
                  value={form.name}
                  onChange={e => set("name", e.target.value)}
                  placeholder="e.g. Community Shelter of Brooklyn"
                  required
                  className={inputCls}
                />
              </Field>

              {/* Category */}
              <Field label="CATEGORY *">
                <select
                  value={form.category}
                  onChange={e => set("category", e.target.value as ResourceCategory)}
                  required
                  className={cn(inputCls, "cursor-pointer")}
                >
                  <option value="">Select category…</option>
                  {(Object.keys(CATEGORY_CONFIG) as ResourceCategory[]).map(cat => (
                    <option key={cat} value={cat}>{CATEGORY_CONFIG[cat].label}</option>
                  ))}
                </select>
              </Field>

              {/* Address */}
              <Field label="STREET ADDRESS *">
                <input
                  type="text"
                  value={form.address}
                  onChange={e => set("address", e.target.value)}
                  placeholder="123 Main St"
                  required
                  className={inputCls}
                />
              </Field>

              {/* City */}
              <Field label="CITY *">
                <input
                  type="text"
                  value={form.city}
                  onChange={e => set("city", e.target.value)}
                  placeholder="New York"
                  required
                  className={inputCls}
                />
              </Field>

              {/* Phone */}
              <Field label="PHONE (OPTIONAL)">
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => set("phone", e.target.value)}
                  placeholder="(212) 555-0100"
                  className={inputCls}
                />
              </Field>

              {/* Notes */}
              <Field label="ADDITIONAL NOTES">
                <textarea
                  value={form.notes}
                  onChange={e => set("notes", e.target.value)}
                  placeholder="Hours, languages served, special requirements…"
                  rows={3}
                  className={cn(inputCls, "resize-none")}
                />
              </Field>

              {status === "error" && (
                <p className="font-mono text-[9px] text-red-400 tracking-[0.08em]">
                  ⚠ Submission failed. Please try again.
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-white/[0.08] flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 font-mono text-[10px] font-semibold text-[#666] border border-white/[0.08] rounded-md hover:text-white hover:border-white/15 hover:bg-white/[0.04] transition-all"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !form.name || !form.category || !form.address || !form.city}
                className={cn(
                  "flex-1 py-2 font-mono text-[10px] font-bold tracking-[0.08em] rounded-md transition-all",
                  isSubmitting || !form.name || !form.category || !form.address || !form.city
                    ? "bg-[#2563eb]/40 text-white/40 cursor-not-allowed"
                    : "bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
                )}
              >
                {isSubmitting ? "SUBMITTING…" : "SUBMIT RESOURCE"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-mono text-[9px] text-[#555] tracking-[0.1em] mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full bg-[#0a0a0a] border border-white/[0.08] rounded-md px-3 py-2 font-mono text-[11px] text-white placeholder-[#333] outline-none focus:border-white/20 focus-visible:ring-1 focus-visible:ring-white/10 transition-all";
