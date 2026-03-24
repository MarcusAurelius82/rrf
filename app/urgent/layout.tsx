import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Urgent & Crisis Resources | REFUGEE_NODE",
  description: "Immediate crisis resources for refugees and asylum seekers in the United States. Emergency shelter, crisis hotlines, and urgent humanitarian aid.",
  openGraph: {
    title: "Urgent & Crisis Resources | REFUGEE_NODE",
    description: "Immediate crisis resources for refugees and asylum seekers in the US.",
  },
};

export default function UrgentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
