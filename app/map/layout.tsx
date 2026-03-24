import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Resource Map | REFUGEE_NODE",
  description: "Interactive map to find refugee and asylum seeker resources near you across the United States. Filter by shelter, food, legal aid, medical, and language services.",
  openGraph: {
    title: "Resource Map | REFUGEE_NODE",
    description: "Find humanitarian resources for refugees and asylum seekers across the US.",
  },
};

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
