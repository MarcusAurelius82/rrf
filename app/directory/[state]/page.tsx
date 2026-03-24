import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DirectoryClient } from "@/components/directory/DirectoryClient";
import { US_STATES, STATE_CODES, getStateName } from "@/lib/states";

interface Props {
  params: { state: string };
}

export function generateStaticParams() {
  return STATE_CODES.map(state => ({ state }));
}

export function generateMetadata({ params }: Props): Metadata {
  const code = params.state.toUpperCase();
  if (!US_STATES[code]) return { title: "Not Found" };
  const name = getStateName(code);
  return {
    title: `Refugee Resources in ${name} | REFUGEE_NODE`,
    description: `Find shelter, food, legal aid, medical care, and language services for refugees and asylum seekers in ${name}. Browse verified resources near you.`,
    openGraph: {
      title: `Refugee Resources in ${name} | REFUGEE_NODE`,
      description: `Verified humanitarian resources for refugees and asylum seekers in ${name}.`,
    },
  };
}

export default function DirectoryStatePage({ params }: Props) {
  const code = params.state.toUpperCase();
  if (!US_STATES[code]) notFound();
  return <DirectoryClient initialState={code} />;
}
