import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Dashboard | REFUGEE_NODE",
  description: "Admin dashboard for managing and reviewing refugee resource listings across the United States.",
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
