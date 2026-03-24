import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/lib/theme";
import "./globals.css";

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://refugee-node.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "REFUGEE_NODE — Find Resources Near You",
    template: "%s | REFUGEE_NODE",
  },
  description: "Humanitarian resource finder for refugees and asylum seekers in the United States. Find shelter, food, legal aid, medical care, and language services nearby.",
  openGraph: {
    type: "website",
    siteName: "REFUGEE_NODE",
    title: "REFUGEE_NODE — Find Resources Near You",
    description: "Humanitarian resource finder for refugees and asylum seekers in the United States.",
    url: BASE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "REFUGEE_NODE — Find Resources Near You",
    description: "Humanitarian resource finder for refugees and asylum seekers in the United States.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      {/* suppressHydrationWarning prevents mismatch when ThemeProvider sets data-theme on mount */}
      <html lang="en" suppressHydrationWarning className={`${ibmPlexMono.variable} ${ibmPlexSans.variable}`}>
        <body className="bg-surface-0 text-content-primary antialiased">
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
