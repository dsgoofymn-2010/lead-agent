// Google Places search.
//
// We use the "Places API (New)" Text Search endpoint. It can return the phone
// number and website in the same call, so we don't need extra "details" requests.
// Docs: https://developers.google.com/maps/documentation/places/web-service/text-search

import type { PlaceResult } from "./types";

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

// Only ask Google for the fields we use. This is required by the API,
// and asking for fewer fields keeps the cost down.
const FIELD_MASK = [
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
  "nextPageToken",
].join(",");

// Google returns at most 20 results per page.
const PAGE_SIZE = 20;

// A special error type so the API route can show a friendly message.
export class PlacesError extends Error {
  constructor(message: string, public httpStatus: number = 500) {
    super(message);
  }
}

// The shape of one place in Google's response (only the fields we asked for).
interface GooglePlace {
  displayName?: { text: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
}

/**
 * Search Google Places for "<category> in <city>".
 * Fetches more pages if needed, up to `limit` results.
 */
export async function searchPlaces(
  city: string,
  category: string,
  limit: number
): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new PlacesError(
      "GOOGLE_PLACES_API_KEY is missing. Add it to .env.local and restart the dev server.",
      500
    );
  }

  const results: PlaceResult[] = [];
  let pageToken: string | undefined = undefined;

  // Keep fetching pages until we have enough results or Google has no more.
  do {
    const body: Record<string, unknown> = {
      textQuery: `${category} in ${city}`,
      pageSize: Math.min(PAGE_SIZE, limit - results.length),
      regionCode: "IN", // bias results to India
      languageCode: "en",
    };
    if (pageToken) body.pageToken = pageToken;

    let res: Response;
    try {
      res = await fetch(SEARCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new PlacesError("Could not reach Google. Check your internet connection.", 502);
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new PlacesError(explainGoogleError(res.status, data), res.status);
    }

    const places: GooglePlace[] = data.places ?? [];
    for (const p of places) {
      results.push({
        name: p.displayName?.text ?? "(no name)",
        address: p.formattedAddress ?? "",
        // Prefer the international format (+91 ...) because it works for WhatsApp later.
        phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? null,
        rating: p.rating ?? null,
        reviewCount: p.userRatingCount ?? null,
        website: p.websiteUri ?? null,
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken && results.length < limit);

  return results.slice(0, limit);
}

// Turn Google's error response into a message a person can act on.
function explainGoogleError(
  httpStatus: number,
  data: { error?: { message?: string; status?: string } }
): string {
  const status = data.error?.status ?? "";
  const message = data.error?.message ?? "Unknown error";

  if (httpStatus === 429 || status === "RESOURCE_EXHAUSTED") {
    return "Google Places quota exceeded. Wait a bit, or check your quota and billing in Google Cloud Console.";
  }
  if (httpStatus === 403 || status === "PERMISSION_DENIED") {
    return `Google refused the request. Make sure "Places API (New)" is enabled for your project and billing is set up. (${message})`;
  }
  if (message.toLowerCase().includes("api key")) {
    return `Your Google API key looks invalid. Check GOOGLE_PLACES_API_KEY in .env.local. (${message})`;
  }
  return `Google Places error (${httpStatus}): ${message}`;
}
