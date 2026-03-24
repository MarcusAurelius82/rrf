"use client";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { UserButton, SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { SUPPORTED_LANGUAGES } from "@/lib/deepl";

const NAV_LINKS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Map",       href: "/map"       },
  { label: "Directory", href: "/directory" },
  { label: "Urgent",    href: "/urgent",   urgent: true },
];

interface NavbarProps {
  onLanguageChange?: (lang: string) => void;
  currentLang?: string;
}

export function Navbar({ onLanguageChange, currentLang = "EN" }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [langOpen, setLangOpen] = useState(false);

  return (
    <nav className="flex items-center justify-between h-[52px] px-5 border-b border-white/[0.08] bg-[#0a0a0a] flex-shrink-0 z-50">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md bg-[#2563eb] flex items-center justify-center text-sm">🧭</div>
        <span className="font-mono font-bold text-[13px] tracking-[0.05em]">REFUGEE_NODE</span>
      </div>

      {/* Nav links */}
      <div className="flex gap-1">
        {NAV_LINKS.map(link => (
          <button
            key={link.href}
            onClick={() => router.push(link.href)}
            className={cn(
              "font-mono text-[11px] font-medium px-3 py-1.5 rounded-md tracking-[0.05em] border transition-all",
              pathname === link.href
                ? "text-white border-white/15 bg-[#1a1a1a]"
                : "text-[#888] border-transparent bg-transparent hover:text-white hover:bg-[#1a1a1a]",
              link.urgent && "text-red-500 hover:text-red-400"
            )}
          >
            {link.label}
          </button>
        ))}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Language picker */}
        <div className="relative">
          <button
            onClick={() => setLangOpen(o => !o)}
            className="flex items-center gap-1.5 font-mono text-[10px] font-semibold text-[#888] px-2.5 py-1.5 rounded-md border border-white/[0.08] hover:border-white/15 hover:text-white transition-all"
          >
            <span>⟨Aあ⟩</span>
            <span>{currentLang}</span>
          </button>
          {langOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-[#1a1a1a] border border-white/[0.12] rounded-lg overflow-hidden shadow-xl z-50">
              {[{ code: "EN", label: "English", flag: "🇺🇸" }, ...SUPPORTED_LANGUAGES].map(lang => (
                <button
                  key={lang.code}
                  onClick={() => { onLanguageChange?.(lang.code); setLangOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 font-mono text-[11px] text-[#888] hover:bg-[#222] hover:text-white transition-all text-left",
                    currentLang === lang.code && "text-white bg-[#222]"
                  )}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                  {currentLang === lang.code && <span className="ml-auto text-[#2563eb]">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Auth */}
        <SignedIn>
          <UserButton afterSignOutUrl="/map" appearance={{ baseTheme: undefined }} />
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="font-mono text-[10px] font-semibold text-[#888] px-2.5 py-1.5 rounded-md border border-white/[0.08] hover:border-white/15 hover:text-white transition-all">
              SIGN IN
            </button>
          </SignInButton>
        </SignedOut>
      </div>
    </nav>
  );
}
