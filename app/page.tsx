"use client";
// The Search page (/). "use client" means this page runs in the browser,
// which we need for the form, the loading state, and showing results.
// Open /?sample to see the results screen with made-up sample businesses.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, type Lead } from "@/lib/types";
import { SAMPLE_CATEGORY, SAMPLE_CITY, SAMPLE_RESPONSE } from "@/lib/sample-leads";

interface SearchResponse {
  leads: Lead[];
  total: number;
  newCount: number;
  duplicateCount: number;
  error?: string;
}

interface Search {
  city: string;
  category: string;
  limit: number;
}

type Tab = "none" | "has" | "all";
type Sort = "reviews" | "rating" | "name";

const hasSite = (l: Lead) => Boolean(l.website);

// Plural for the finding line: "salons", "tuition centres".
function plural(word: string, n: number) {
  if (n === 1) return word;
  if (/(s|sh|ch|x)$/.test(word)) return word + "es";
  if (/[^aeiou]y$/.test(word)) return word.slice(0, -1) + "ies";
  return word + "s";
}

// Drop the city and state every row shares: the title already names the city.
function shortAddress(address: string, city?: string) {
  if (!city) return address;
  const i = address.toLowerCase().lastIndexOf(", " + city.toLowerCase());
  return i > 0 ? address.slice(0, i) : address;
}

function hostOf(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
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
  const [searched, setSearched] = useState<Search | null>(null);
  const [recent, setRecent] = useState<(Search & { found: number })[]>([]);
  const [isSample, setIsSample] = useState(false);

  // Result view
  const [tab, setTab] = useState<Tab>("none");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<Sort>("reviews");

  // /?sample shows sample data so the screen can be seen without an API key.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("sample")) {
      setCity(SAMPLE_CITY);
      setCategory(SAMPLE_CATEGORY);
      setIsSample(true);
      setSearched({ city: SAMPLE_CITY, category: SAMPLE_CATEGORY, limit: 20 });
      setResult(SAMPLE_RESPONSE);
    }
  }, []);

  async function runSearch(search: Search) {
    setLoading(true);
    setError(null);
    setResult(null);
    setIsSample(false);
    setSearched(search);
    setTab("none");
    setFilter("");

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(search),
      });
      const data: SearchResponse = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Search failed.");
      } else {
        setResult(data);
        setRecent((prev) =>
          [
            { ...search, found: data.total },
            ...prev.filter((r) => !(r.city === search.city && r.category === search.category)),
          ].slice(0, 6),
        );
      }
    } catch {
      setError("Could not reach the server. Is `npm run dev` still running?");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // stop the browser from reloading the page
    // If "other" is chosen, search for whatever the user typed instead.
    const searchCategory = category === "other" ? customCategory.trim() : category;
    runSearch({ city: city.trim(), category: searchCategory, limit });
  }

  // Counts come from the rows, so every figure on screen agrees.
  const leads = useMemo(() => result?.leads ?? [], [result]);
  const noSite = leads.filter((l) => !hasSite(l));
  const counts = { none: noSite.length, has: leads.length - noSite.length, all: leads.length };

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const rows = leads.filter((l) => {
      if (tab === "none" && hasSite(l)) return false;
      if (tab === "has" && !hasSite(l)) return false;
      return !q || l.name.toLowerCase().includes(q) || l.address.toLowerCase().includes(q);
    });
    return [...rows].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "rating") return (b.rating ?? -1) - (a.rating ?? -1);
      return (b.review_count ?? -1) - (a.review_count ?? -1);
    });
  }, [leads, tab, filter, sort]);

  const noun = searched ? plural(searched.category, counts.all) : "";

  return (
    <div className="frame">
      {/* ---------- Sidebar: product, nav, this session's searches ---------- */}
      <aside className="sidebar">
        <div className="brand">
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
            <rect width="28" height="28" rx="7" fill="var(--accent)" />
            <path d="M14 6.5a5.5 5.5 0 0 0-5.5 5.5c0 4.1 5.5 9.5 5.5 9.5s5.5-5.4 5.5-9.5A5.5 5.5 0 0 0 14 6.5Z" fill="#fff" />
            <circle cx="14" cy="12" r="2" fill="var(--accent)" />
          </svg>
          <div>
            <div className="brand-name">Menefides</div>
            <div className="brand-sub">Lead finder</div>
          </div>
        </div>

        <nav className="nav nav-section" aria-label="Main">
          <Link className="nav-item" href="/" aria-current="page">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" />
              <path d="m10.5 10.5 3.5 3.5" strokeLinecap="round" />
            </svg>
            Find leads
          </Link>
        </nav>

        <div className="nav-section">
          <div className="nav-group">Searched this session</div>
          {recent.length === 0 ? (
            <p className="recent-empty">Your searches will be listed here so you can run them again.</p>
          ) : (
            <div className="recent">
              {recent.map((r) => (
                <button
                  key={`${r.city}-${r.category}`}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setCity(r.city);
                    setCategory((CATEGORIES as readonly string[]).includes(r.category) ? r.category : "other");
                    setCustomCategory(r.category);
                    setLimit(r.limit);
                    runSearch(r);
                  }}
                >
                  <span>
                    {r.category}, {r.city}
                  </span>
                  <span className="count">{r.found}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="sidebar-foot">Every result is saved to leads.db</p>
      </aside>

      {/* ---------- The sheet ---------- */}
      <main className="sheet">
        <div className="title-row">
          <h1>Find leads</h1>
          {result && searched && counts.all > 0 ? (
            <p>
              <b>
                {counts.none} of {counts.all}
              </b>{" "}
              {noun} in {searched.city} have no website.
            </p>
          ) : (
            <p>Search Google Maps for local businesses and see which ones have no website.</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="search">
          <label className="field field-city">
            <span>City</span>
            <input required value={city} onChange={(e) => setCity(e.target.value)} placeholder="Coimbatore" />
          </label>

          <label className="field field-cat">
            <span>Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          {category === "other" && (
            <label className="field field-cat">
              <span>Type of business</span>
              <input
                required
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="bakery"
              />
            </label>
          )}

          <label className="field field-limit">
            <span>Results</span>
            <input
              type="number"
              min={1}
              max={50}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              aria-describedby="limit-hint"
            />
          </label>
          <span id="limit-hint" className="sr-only">
            Up to 50 results per search.
          </span>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Searching…" : "Find leads"}
          </button>
        </form>

        {isSample && (
          <p className="sample-note">Sample businesses for preview. Nothing here was saved. Run a search to see real results.</p>
        )}

        {/* ---------- Error, inside the block that failed ---------- */}
        {error && (
          <div className="error-block" role="alert">
            <p>{error}</p>
            {searched && (
              <button type="button" className="btn-text" onClick={() => runSearch(searched)}>
                Retry
              </button>
            )}
          </div>
        )}

        {/* ---------- First run ---------- */}
        {!loading && !error && !result && (
          <div className="empty">
            <b>No search yet.</b> Pick a city and a kind of business. The ones with no website are listed first:
            those are the people to call.
          </div>
        )}

        {/* ---------- Zero results ---------- */}
        {result && counts.all === 0 && searched && (
          <div className="empty">
            <b>
              Google found no {plural(searched.category, 2)} in {searched.city}.
            </b>{" "}
            Check the spelling of the city, or try a nearby town.
          </div>
        )}

        {/* ---------- Loading: the final layout with grey bars ---------- */}
        {loading && (
          <section className="results" aria-busy="true" aria-label="Searching Google Maps">
            <p className="muted">Searching Google Maps for {searched?.category} in {searched?.city}…</p>
            <table className="table">
              <tbody>
                {Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    <td className="biz c-biz">
                      <span className="bar" style={{ width: 180 + ((i * 37) % 90) }} />
                      <div style={{ marginTop: 8 }}>
                        <span className="bar" style={{ width: 240, height: 10 }} />
                      </div>
                    </td>
                    <td className="c-phone"><span className="bar" style={{ width: 96 }} /></td>
                    <td className="c-site"><span className="bar" style={{ width: 84 }} /></td>
                    <td className="num c-rating"><span className="bar" style={{ width: 56 }} /></td>
                    <td className="c-call"><span className="bar" style={{ width: 48, height: 30 }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ---------- Results ---------- */}
        {result && counts.all > 0 && (
          <section className="results" aria-labelledby="coverage-h">
            <div className="coverage">
              <div>
                <h2 id="coverage-h">Website coverage</h2>
                <div className="coverage-figure" style={{ marginTop: 6 }}>
                  {counts.none}
                  <small>with no website</small>
                </div>
              </div>
              <div className="coverage-meta">
                {result.newCount} new · {result.duplicateCount} already saved, refreshed
              </div>
              <div className="strip" role="img" aria-label={`${counts.none} of ${counts.all} have no website`}>
                {[...noSite, ...leads.filter(hasSite)].map((l) => (
                  <i key={l.id} className={hasSite(l) ? "" : "none"} title={l.name} />
                ))}
              </div>
              <div className="legend">
                <span><i className="none" /> No website {counts.none}</span>
                <span><i /> Has a website {counts.has}</span>
              </div>
            </div>

            <div className="tabs" role="tablist" aria-label="Filter by website">
              {(
                [
                  ["none", "No website"],
                  ["has", "Has a website"],
                  ["all", "All"],
                ] as [Tab, string][]
              ).map(([id, label]) => (
                <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)}>
                  {label}
                  <span className="n">{counts[id]}</span>
                </button>
              ))}
            </div>

            <div className="toolbar">
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by name or area"
                aria-label="Filter by name or area"
              />
              <div className="toolbar-right">
                <span>
                  {visible.length} {visible.length === 1 ? "business" : "businesses"}
                </span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
                  <option value="reviews">Most reviews</option>
                  <option value="rating">Highest rating</option>
                  <option value="name">Name</option>
                </select>
              </div>
            </div>

            {visible.length === 0 ? (
              <div className="empty">No businesses match “{filter}” in this view.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th className="biz">Business</th>
                    <th>Phone</th>
                    <th>Website</th>
                    <th className="num">Rating</th>
                    <th>
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((lead) => (
                    <tr key={lead.id}>
                      <td className="biz c-biz">
                        <div className="biz-name">
                          {isSample ? (
                            lead.name
                          ) : (
                            <Link href={`/lead/${lead.id}`} className="biz-link">
                              {lead.name}
                            </Link>
                          )}
                        </div>
                        <div className="biz-addr">{shortAddress(lead.address, searched?.city)}</div>
                      </td>
                      <td className="phone c-phone">{lead.phone ?? <span className="dash">—</span>}</td>
                      <td className="site c-site">
                        {lead.website ? (
                          <a href={lead.website} target="_blank" rel="noreferrer">
                            {hostOf(lead.website)}
                          </a>
                        ) : (
                          <span className="pill pill-none">No website</span>
                        )}
                      </td>
                      <td className="num c-rating">
                        {lead.rating != null ? lead.rating.toFixed(1) : <span className="dash">—</span>}
                        {lead.review_count != null && (
                          <span className="muted"> ({lead.review_count.toLocaleString("en-IN")})</span>
                        )}
                      </td>
                      <td className="c-call">
                        {lead.phone ? (
                          <a className="btn-ghost" href={`tel:${lead.phone.replace(/\s/g, "")}`} aria-label={`Call ${lead.name}`}>
                            Call
                          </a>
                        ) : (
                          <span className="dash">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
