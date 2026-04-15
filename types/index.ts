export type ResourceCategory = "shelter" | "food" | "legal" | "medical" | "language";
export type ResourceStatus = "open" | "closed" | "closing_soon" | "appointment_only";
export type DocumentationRequired = "none" | "id_only" | "unknown";

export interface Resource {
  id: string;
  name: string;
  category: ResourceCategory;
  status: ResourceStatus;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  phone?: string;
  website?: string;
  hours?: Record<string, string>;
  languages?: string[];
  urgent: boolean;
  verified: boolean;
  documentation_required: DocumentationRequired | null;
  created_at: string;
  updated_at: string;
}

export interface SearchParams {
  query: string;
  state?: string;
  category?: ResourceCategory;
  lat?: number;
  lng?: number;
  radius_miles?: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}
