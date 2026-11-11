// Shared types used by both the server code and the pages.

export const CATEGORIES = [
  "salon",
  "clinic",
  "tuition centre",
  "restaurant",
  "tailor",
  "gym",
  "print shop",
  "photo studio",
  "other",
] as const;

export type WebsiteStatus = "none" | "weak" | "good" | "unknown";
export type LeadStatus = "new" | "contacted" | "replied" | "paid" | "rejected";

// One row in the "leads" table.
export interface Lead {
  id: number;
  name: string;
  category: string;
  city: string;
  address: string;
  phone: string | null;
  website: string | null;
  website_status: WebsiteStatus;
  email: string | null;
  whatsapp: string | null;
  rating: number | null;
  review_count: number | null;
  score: number;
  source: string;
  status: LeadStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// What the Google Places search gives us for each business.
export interface PlaceResult {
  name: string;
  address: string;
  phone: string | null;
  rating: number | null;
  reviewCount: number | null;
  website: string | null;
}
