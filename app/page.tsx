"use client";
// The Search page (/). "use client" means this page runs in the browser,
// which we need for the form, the loading state, and showing results.

import { useState } from "react";
import { CATEGORIES, type Lead } from "@/lib/types";

interface SearchResponse {
  leads: Lead[];
  total: number;
  newCount: number;
  duplicateCount: number;
  error?: string;
}

export default function SearchPage() {
  // Form fields
  const [city, setCity] = useState("");
  const [category, setCategory] = useState<string>("salon");
  const [customCategory, setCustomCategory] = useState(""); // used when "other" is picked
  const [limit, setLimit] = useState(20);

  // Request state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // stop the browser from reloading the page
    setLoading(true);
    setError(null);
    setResult(null);

    // If "other" is chosen, search for whatever the user typed instead.
    const searchCategory = category === "other" ? customCategory.trim() : category;

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, category: searchCategory, limit }),
      });
      const data: SearchResponse = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Search failed.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Could not reach the server. Is `npm run dev` still running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold">Find leads</h1>
      <p className="mt-1 text-sm text-gray-500">
        Search Google Maps for local businesses. Results are saved to your leads list.
      </p>

      {/* ---------- Search form ---------- */}
      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 rounded-lg border p-4 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          City
          <input
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Coimbatore"
            className="rounded border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded border px-3 py-2"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        {category === "other" && (
          <label className="flex flex-col gap-1 text-sm">
            Type of business
            <input
              required
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="e.g. bakery"
              className="rounded border px-3 py-2"
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm">
          Result limit (max 50)
          <input
            type="number"
            min={1}
            max={50}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded border px-3 py-2"
          />
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Searching…" : "Find leads"}
          </button>
        </div>
      </form>

      {/* ---------- Loading, error, and results ---------- */}
      {loading && (
        <p className="mt-6 animate-pulse text-sm text-gray-500">
          Searching Google Places… this can take a few seconds.
        </p>
      )}

      {error && (
        <div className="mt-6 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {result && (
        <section className="mt-6">
          <p className="text-sm">
            Found <b>{result.total}</b> businesses. <b>{result.newCount}</b> new,{" "}
            <b>{result.duplicateCount}</b> already saved (refreshed).
          </p>

          <div className="mt-3 overflow-x-auto rounded border">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                <tr>
                  <th className="p-2">Name</th>
                  <th className="p-2">Phone</th>
                  <th className="p-2">Website</th>
                  <th className="p-2">Rating</th>
                  <th className="p-2">Address</th>
                </tr>
              </thead>
              <tbody>
                {result.leads.map((lead) => (
                  <tr key={lead.id} className="border-t align-top">
                    <td className="p-2 font-medium">{lead.name}</td>
                    <td className="p-2 whitespace-nowrap">{lead.phone ?? "—"}</td>
                    <td className="p-2 max-w-48 truncate">
                      {lead.website ? (
                        <a href={lead.website} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                          {lead.website}
                        </a>
                      ) : (
                        <span className="text-red-600">No website</span>
                      )}
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      {lead.rating ?? "—"} {lead.review_count != null && `(${lead.review_count})`}
                    </td>
                    <td className="p-2 text-gray-500">{lead.address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
