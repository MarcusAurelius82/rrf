"use client";
import useSWR from "swr";
import { Resource, ResourceCategory, ApiResponse } from "@/types";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useResources(state: string | null, category?: ResourceCategory | null) {
  const params = new URLSearchParams();
  if (state) params.set("state", state);
  if (category) params.set("category", category);

  const { data, error, isLoading } = useSWR<ApiResponse<Resource[]>>(
    state ? `/api/resources?${params}` : null,
    fetcher,
  );

  return {
    resources: data?.data ?? [],
    isLoading,
    error,
  };
}
