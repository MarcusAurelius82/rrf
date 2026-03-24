"use client";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { UserButton, SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { SUPPORTED_LANGUAGES } from "@/lib/deepl";
import { ThemeToggle } from "./ThemeToggle";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function navigate(href: string) {
    router.push(href);
    setMobileMenuOpen(false);
  }

  return (
    <nav
      className="flex items-center justify-between h-[52px] px-4 md:px-5 border-b border-border bg-surface-0 flex-shrink-0 z-50 relative"
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-7 h-7 rounded-md bg-accent flex items-center justify-center text-sm"
          aria-hidden="true"
        >
          🧭
        </div>
        <span className="font-mono font-bold text-[13px] tracking-[0.05em] text-content-primary">REFUGEE_NODE</span>
      </div>

      {/* Desktop nav links */}
      <div className="hidden md:flex gap-1" role="menubar">
        {NAV_LINKS.map(link => (
          <button
            key={link.href}
            role="menuitem"
            onClick={() => navigate(link.href)}
            aria-current={pathname === link.href ? "page" : undefined}
            className={cn(
              "font-mono text-[11px] font-medium px-3 py-1.5 rounded-md tracking-[0.05em] border transition-all",
              pathname === link.href
                ? "text-content-primary border-border-active bg-surface-2"
                : "text-content-secondary border-transparent bg-transparent hover:text-content-primary hover:bg-surface-2",
              link.urgent && "text-red-500 hover:text-red-400"
            )}
          >
            {link.label}
          </button>
        ))}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <ThemeToggle />

        {/* Language picker */}
        <div className="relative">
          <button
            onClick={() => setLangOpen(o => !o)}
            aria-label={`Language: ${currentLang}. Click to change.`}
            aria-expanded={langOpen}
            aria-haspopup="listbox"
            className="flex items-center gap-1.5 font-mono text-[10px] font-semibold text-content-secondary px-2.5 py-1.5 rounded-md border border-border hover:border-border-active hover:text-content-primary transition-all"
          >
            <span aria-hidden="true">⟨Aあ⟩</span>
            <span>{currentLang}</span>
          </button>
          {langOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                aria-hidden="true"
                onClick={() => setLangOpen(false)}
              />
              <ul
                role="listbox"
                aria-label="Select language"
                className="absolute right-0 top-full mt-1 w-44 bg-surface-2 border border-border-active rounded-lg overflow-hidden shadow-xl z-50"
              >
                {[{ code: "EN", label: "English", flag: "🇺🇸" }, ...SUPPORTED_LANGUAGES].map(lang => (
                  <li key={lang.code} role="option" aria-selected={currentLang === lang.code}>
                    <button
                      onClick={() => { onLanguageChange?.(lang.code); setLangOpen(false); }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 font-mono text-[11px] text-content-secondary hover:bg-surface-3 hover:text-content-primary transition-all text-left",
                        currentLang === lang.code && "text-content-primary bg-surface-3"
                      )}
                    >
                      <span aria-hidden="true">{lang.flag}</span>
                      <span>{lang.label}</span>
                      {currentLang === lang.code && (
                        <span className="ml-auto text-accent" aria-hidden="true">✓</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Auth */}
        <SignedIn>
          <UserButton afterSignOutUrl="/map" appearance={{ baseTheme: undefined }} />
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="font-mono text-[10px] font-semibold text-content-secondary px-2.5 py-1.5 rounded-md border border-border hover:border-border-active hover:text-content-primary transition-all">
              SIGN IN
            </button>
          </SignInButton>
        </SignedOut>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col gap-1 p-1.5 rounded-md hover:bg-border transition-all"
          onClick={() => setMobileMenuOpen(o => !o)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-menu"
        >
          <span className={cn("w-4 h-[1.5px] bg-content-secondary transition-all", mobileMenuOpen && "rotate-45 translate-y-[4px]")} />
          <span className={cn("w-4 h-[1.5px] bg-content-secondary transition-all", mobileMenuOpen && "opacity-0")} />
          <span className={cn("w-4 h-[1.5px] bg-content-secondary transition-all", mobileMenuOpen && "-rotate-45 -translate-y-[4px]")} />
        </button>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 top-[52px] bg-black/50 z-40"
            aria-hidden="true"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            id="mobile-menu"
            className="md:hidden absolute top-full left-0 right-0 bg-surface-0 border-b border-border z-50 py-2"
            role="menu"
          >
            {NAV_LINKS.map(link => (
              <button
                key={link.href}
                role="menuitem"
                onClick={() => navigate(link.href)}
                aria-current={pathname === link.href ? "page" : undefined}
                className={cn(
                  "w-full text-left font-mono text-[12px] font-medium px-5 py-3 transition-all border-l-2",
                  pathname === link.href
                    ? "text-content-primary border-accent bg-surface-2"
                    : "text-content-secondary border-transparent hover:text-content-primary hover:bg-surface-1",
                  link.urgent && "text-red-500 hover:text-red-400"
                )}
              >
                {link.label}
              </button>
            ))}
          </div>
        </>
      )}
    </nav>
  );
}
