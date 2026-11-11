// POST /api/search
// Body: { city: string, category: string, limit: number }
//
// Step 1: runs the Google Places search and saves each business as a lead.
// (Step 2 will add the website check, contact scraping, and scoring here.)

import { NextResponse } from "next/server";
import { searchPlaces, PlacesError } from "@/lib/places";
import { saveLead } from "@/lib/db";

// The database client needs the Node.js runtime (not the Edge runtime).
export const runtime = "nodejs";

export async function POST(request: Request) {
  // 1. Read and check the input.
  const body = await request.json().catch(() => null);
  const city = String(body?.city ?? "").trim();
  const category = String(body?.category ?? "").trim();
  const limit = Math.min(50, Math.max(1, Number(body?.limit) || 20));

  if (!city || !category) {
    return NextResponse.json({ error: "Please enter a city and a category." }, { status: 400 });
  }

  try {
    // 2. Ask Google for businesses.
    const places = await searchPlaces(city, category, limit);

    // 3. Save each one. Duplicates are refreshed, not saved twice.
    let newCount = 0;
    const leads = [];
    for (const place of places) {
      const { lead, isNew } = await saveLead({
        name: place.name,
        category,
        city,
        address: place.address,
        phone: place.phone,
        website: place.website,
        website_status: "unknown", // filled in properly in Step 2
        email: null,
        whatsapp: null,
        rating: place.rating,
        review_count: place.reviewCount,
        score: 0, // filled in properly in Step 2
      });
      if (isNew) newCount++;
      leads.push(lead);
    }

    return NextResponse.json({
      leads,
      total: leads.length,
      newCount,
      duplicateCount: leads.length - newCount,
    });
  } catch (err) {
    if (err instanceof PlacesError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    console.error(err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}
