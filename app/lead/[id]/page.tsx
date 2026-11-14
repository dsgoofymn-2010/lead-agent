"use client";

// Lead detail page (/lead/[id]). Shows one saved business plus AI-written
// email and WhatsApp outreach messages. The AI call happens on the server
// (app/api/leads/[id]/messages/route.ts); this page only fetches JSON.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Lead } from "@/lib/types";

type Language = "english" | "tamil";
type LoadState = "loading" | "ready" | "error" | "notfound";

interface LeadResponse {
  lead?: Lead;
  error?: string;
}

interface Messages {
  email: { subject: string; body: string };
  whatsapp: string;
  source: "ai" | "fallback";
  error?: string;
}

type MessagesResponse = Partial<Messages>;

function hostOf(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function whatsappLink(phone: string): string | null {
  const raw = phone.trim();
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 10) digits = "91" + digits;
  return `https://wa.me/${digits}`;
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  // Lead
  const [lead, setLead] = useState<Lead | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState("");

  // Messages
  const [language, setLanguage] = useState<Language>("english");
  const [emailTo, setEmailTo] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [source, setSource] = useState<"ai" | "fallback" | null>(null);
  const [fallbackError, setFallbackError] = useState("");
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  const [copied, setCopied] = useState<"email" | "whatsapp" | null>(null);
  const [copyError, setCopyError] = useState("");

  // StrictMode runs effects twice in development; this guard keeps the
  // initial Groq call (and its quota use) to one per lead.
  const startedRef = useRef<string | null>(null);
  const messagesRequest = useRef(0);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadMessages = useCallback(async (leadId: string, lang: Language) => {
    const requestId = ++messagesRequest.current;
    setMessagesLoading(true);
    setMessagesError("");
    setFallbackError("");

    try {
      const res = await fetch(`/api/leads/${leadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang }),
      });
      const data = (await res.json().catch(() => null)) as MessagesResponse | null;

      // A newer request (Regenerate clicked again) wins.
      if (requestId !== messagesRequest.current) return;

      if (!res.ok || !data?.email || !data.whatsapp) {
        setMessagesError(data?.error ?? "Could not write messages.");
        return;
      }

      setSubject(data.email.subject);
      setEmailBody(data.email.body);
      setWhatsapp(data.whatsapp);
      const nextSource = data.source ?? "ai";
      setSource(nextSource);
      setFallbackError(
        nextSource === "fallback" ? data.error ?? "unknown error" : ""
      );
    } catch {
      if (requestId !== messagesRequest.current) return;
      setMessagesError(
        "Could not reach the server. Is `npm run dev` still running?"
      );
    } finally {
      if (requestId === messagesRequest.current) setMessagesLoading(false);
    }
  }, []);

  const loadLead = useCallback(
    async (leadId: string) => {
      setLoadState("loading");
      messagesRequest.current += 1; // ignore any in-flight messages from a previous lead
      setLoadError("");
      setLead(null);
      setLanguage("english");
      setSource(null);
      setFallbackError("");
      setEmailTo("");
      setPhone("");
      setSubject("");
      setEmailBody("");
      setWhatsapp("");
      setMessagesError("");
      setCopyError("");

      try {
        const res = await fetch(`/api/leads/${leadId}`);
        const data = (await res.json().catch(() => null)) as LeadResponse | null;

        if (res.status === 404) {
          setLoadState("notfound");
          return;
        }
        if (!res.ok || !data?.lead) {
          setLoadState("error");
          setLoadError(data?.error ?? "Could not load this lead.");
          return;
        }

        setLead(data.lead);
        setEmailTo(data.lead.email ?? "");
        setPhone(data.lead.whatsapp || data.lead.phone || "");
        setLoadState("ready");
        await loadMessages(leadId, "english");
      } catch {
        setLoadState("error");
        setLoadError("Could not reach the server. Is `npm run dev` still running?");
      }
    },
    [loadMessages]
  );

  useEffect(() => {
    if (!id || startedRef.current === id) return;
    startedRef.current = id;
    void loadLead(id);
  }, [id, loadLead]);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  async function copy(kind: "email" | "whatsapp", text: string) {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopyError(
        "Could not copy to the clipboard. Select the text and copy it manually."
      );
    }
  }

  const waHref = whatsappLink(phone);

  return (
    <div className="frame">
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
          <Link className="nav-item" href="/">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" />
              <path d="m10.5 10.5 3.5 3.5" strokeLinecap="round" />
            </svg>
            Find leads
          </Link>
        </nav>

        <p className="sidebar-foot">Every result is saved to leads.db</p>
      </aside>

      <main className="sheet">
        <Link href="/" className="back-link">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M10 3 5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to results
        </Link>

        {loadState === "loading" && (
          <section
            className="detail-loading"
            aria-busy="true"
            aria-label="Loading business"
          >
            <span className="bar" style={{ width: 240, height: 22 }} />
            <div className="detail-skeleton-lines">
              <span className="bar" style={{ width: "70%" }} />
              <span className="bar" style={{ width: "50%" }} />
            </div>
            <p className="muted">Loading business…</p>
          </section>
        )}

        {loadState === "notfound" && (
          <div className="empty" style={{ marginTop: 24 }}>
            <b>Lead not found.</b> This lead is not in leads.db.{" "}
            <Link href="/">Go back and run a search.</Link>
          </div>
        )}

        {loadState === "error" && (
          <div className="error-block" role="alert">
            <p>{loadError}</p>
            <button
              type="button"
              className="btn-text"
              onClick={() => void loadLead(id)}
            >
              Retry
            </button>
          </div>
        )}

        {loadState === "ready" && lead && (
          <>
            <div className="detail-head">
              <h1>{lead.name}</h1>
              <p>{lead.address}</p>
            </div>

            <section className="detail-card" aria-label="Business details">
              <dl className="detail-facts">
                <div>
                  <dt>Phone</dt>
                  <dd>
                    {lead.phone ? (
                      <a href={`tel:${lead.phone.replace(/\s/g, "")}`}>
                        {lead.phone}
                      </a>
                    ) : (
                      <span className="dash">—</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Website</dt>
                  <dd>
                    {lead.website ? (
                      <a href={lead.website} target="_blank" rel="noreferrer">
                        {hostOf(lead.website)}
                      </a>
                    ) : (
                      <span className="pill pill-none">No website</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Rating</dt>
                  <dd>
                    {lead.rating != null ? (
                      `${lead.rating.toFixed(1)} / 5`
                    ) : (
                      <span className="dash">—</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Reviews</dt>
                  <dd>
                    {lead.review_count != null ? (
                      lead.review_count.toLocaleString("en-IN")
                    ) : (
                      <span className="dash">—</span>
                    )}
                  </dd>
                </div>
              </dl>
            </section>

            <div className="messages-head">
              <div>
                <h2>Outreach messages</h2>
                <p>Written for this business. Edit anything before sending.</p>
              </div>
              <div className="messages-actions">
                <label className="field">
                  <span>Language</span>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as Language)}
                  >
                    <option value="english">English</option>
                    <option value="tamil">Tamil</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={messagesLoading}
                  onClick={() => void loadMessages(id, language)}
                >
                  {messagesLoading ? "Writing…" : "Regenerate"}
                </button>
              </div>
            </div>

            {messagesLoading && (
              <section aria-busy="true" aria-label="Writing messages">
                <div className="message-grid">
                  {[0, 1].map((i) => (
                    <div key={i} className="message-card">
                      <span className="bar" style={{ width: 90, height: 18 }} />
                      <div className="message-skeleton">
                        <span className="bar" style={{ width: "35%" }} />
                        <span className="bar" style={{ width: "100%", height: 34 }} />
                        <span className="bar" style={{ width: "30%" }} />
                        <span className="bar" style={{ width: "100%", height: 110 }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="muted messages-loading-note">Writing messages…</p>
              </section>
            )}

            {!messagesLoading && messagesError && (
              <div className="error-block" role="alert">
                <p>{messagesError}</p>
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => void loadMessages(id, language)}
                >
                  Retry
                </button>
              </div>
            )}

            {!messagesLoading && source === "fallback" && (
              <p className="notice">
                AI unavailable ({fallbackError || "unknown error"}), showing a
                basic template.
              </p>
            )}

            {!messagesLoading && subject && (
              <div className="message-grid">
                <section className="message-card" aria-labelledby="email-heading">
                  <h2 id="email-heading">Email</h2>
                  <p className="message-sub">Cold outreach, ready to edit.</p>

                  <label className="message-field">
                    <span>To</span>
                    <input
                      type="email"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      placeholder="Add an email address"
                    />
                  </label>

                  <label className="message-field">
                    <span>Subject</span>
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </label>

                  <label className="message-field">
                    <span>Body</span>
                    <textarea
                      rows={11}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                    />
                  </label>

                  <div className="message-actions">
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() =>
                        void copy(
                          "email",
                          `Subject: ${subject}\n\n${emailBody}`
                        )
                      }
                    >
                      {copied === "email" ? "Copied" : "Copy"}
                    </button>
                    <a
                      className="btn-ghost"
                      href={`mailto:${emailTo}?subject=${encodeURIComponent(
                        subject
                      )}&body=${encodeURIComponent(emailBody)}`}
                    >
                      Open in email app
                    </a>
                  </div>
                </section>

                <section
                  className="message-card"
                  aria-labelledby="whatsapp-heading"
                >
                  <h2 id="whatsapp-heading">WhatsApp</h2>
                  <p className="message-sub">Short message, ready to edit.</p>

                  <label className="message-field">
                    <span>Phone number</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                    />
                  </label>

                  <label className="message-field">
                    <span>Message</span>
                    <textarea
                      rows={7}
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                    />
                  </label>

                  <div className="message-actions">
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => void copy("whatsapp", whatsapp)}
                    >
                      {copied === "whatsapp" ? "Copied" : "Copy"}
                    </button>
                    {waHref ? (
                      <a
                        className="btn-ghost"
                        href={waHref}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open WhatsApp
                      </a>
                    ) : (
                      <button type="button" className="btn-ghost" disabled>
                        Open WhatsApp
                      </button>
                    )}
                  </div>
                  {!phone.trim() && (
                    <p className="message-hint">
                      Add a phone number to open WhatsApp.
                    </p>
                  )}
                </section>
              </div>
            )}

            {copyError && (
              <p className="message-hint" role="alert">
                {copyError}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
