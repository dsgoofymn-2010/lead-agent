// SAMPLE DATA, only shown when the page is opened as /?sample.
// It lets you see the results screen without a Google Places key.
// The businesses below are made up. Nothing here is saved to leads.db.

import type { Lead } from "./types";

type Row = [name: string, area: string, phone: string | null, website: string | null, rating: number | null, reviews: number | null];

const rows: Row[] = [
  ["Kavya Bridal Studio", "Cross Cut Road, Gandhipuram", "098422 31760", null, 4.7, 412],
  ["Green Trends Unisex Salon", "DB Road, RS Puram", "0422 254 1187", "https://greentrends.in", 4.3, 389],
  ["Sri Murugan Hair Cutting Saloon", "Oppanakara Street, Town Hall", "094433 50218", null, 4.4, 276],
  ["Naturals Salon", "Avinashi Road, Peelamedu", "0422 457 8890", "https://naturals.in", 4.2, 251],
  ["Lakme Salon", "Race Course Road", "0422 222 6014", "https://lakmesalon.in", 4.1, 233],
  ["Anu's Beauty Parlour", "Sathy Road, Saravanampatti", "097900 14482", null, 4.8, 198],
  ["Style Zone Men's Salon", "Thudiyalur Road, Kavundampalayam", "090037 66210", null, 4.5, 164],
  ["Rosy Ladies Beauty Care", "Nehru Street, Ram Nagar", "098940 27731", null, 4.6, 142],
  ["The Mane Room", "Trichy Road, Singanallur", "081244 90316", "https://instagram.com/themaneroom.cbe", 4.6, 128],
  ["Velvet Touch Spa & Salon", "Mettupalayam Road, Saibaba Colony", "093600 41175", null, 4.3, 117],
  ["Selvi Herbal Beauty Centre", "Marudhamalai Road, Vadavalli", "099445 08813", null, 4.9, 96],
  ["Kings Cut Gents Parlour", "Ukkadam Main Road", "096775 32049", null, 4.0, 88],
  ["Jasmine Bridal Makeover", "Kalingarayar Street, Ramanathapuram", "080158 77420", null, 4.7, 74],
  ["Toni & Guy", "Brookefields Mall, Krishnasamy Road", "0422 435 2201", "https://toniandguy.co.in", 4.4, 71],
  ["Arul Salon for Men", "Kamarajar Road, Podanur", "095855 61937", null, 4.2, 53],
  ["Priya Threading & Beauty", "Bharathi Park Road, Saibaba Colony", null, null, 4.5, 41],
  ["Classic Hair Studio", "Kovaipudur Main Road", "098652 04416", null, 3.9, 37],
  ["Glow Up Family Salon", "Vilankurichi Road, Peelamedu", "091596 22780", null, 4.6, 29],
  ["Blush & Brush Studio", "Sowripalayam Road", "063814 55093", "https://blushandbrush.in", 4.8, 22],
  ["Meena Beauty Corner", "Pollachi Road, Sundarapuram", "097152 39864", null, null, null],
];

// 6 of these were "already saved" in the sample story; the rest are new.
const ALREADY_SAVED = new Set([1, 3, 4, 13, 2, 9]);

export const SAMPLE_CITY = "Coimbatore";
export const SAMPLE_CATEGORY = "salon";

export const SAMPLE_LEADS: Lead[] = rows.map(([name, area, phone, website, rating, reviews], i) => ({
  id: i + 1,
  name,
  category: SAMPLE_CATEGORY,
  city: SAMPLE_CITY,
  address: `${area}, ${SAMPLE_CITY}, Tamil Nadu`,
  phone,
  website,
  website_status: website ? "unknown" : "none",
  email: null,
  whatsapp: null,
  rating,
  review_count: reviews,
  score: 0,
  source: "sample",
  status: "new",
  notes: null,
  created_at: "2026-11-11 18:20:00",
  updated_at: "2026-11-11 18:20:00",
}));

export const SAMPLE_RESPONSE = {
  leads: SAMPLE_LEADS,
  total: SAMPLE_LEADS.length,
  newCount: SAMPLE_LEADS.length - ALREADY_SAVED.size,
  duplicateCount: ALREADY_SAVED.size,
};
