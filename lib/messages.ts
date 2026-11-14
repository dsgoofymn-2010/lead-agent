// Server-only helper: writes outreach messages for one lead with Groq.
// This module is only imported by app/api/leads/[id]/messages/route.ts, so
// GROQ_API_KEY never reaches the browser.

import type { Lead } from "./types";

// ---------- Easy-to-edit constants ----------

const SENDER_NAME = "";
const SENDER_ROLE = "founder";
const SIGNATURE_EMAIL = "Menefides\nDigital Innovation. Secure by Design.";
const SIGNATURE_WHATSAPP = "- Menefides";

const SYSTEM_PROMPT = `You write first-contact outreach messages for Menefides, a small startup that builds modern websites and provides cybersecurity services for local businesses in India.

You are given data about ONE specific business. Use ONLY the facts in that data. Never invent details (owner name, services, awards, social media, years in business, what their website looks like, or statistics). Never claim you visited or reviewed their website. Never say or imply that the business had a website earlier or stopped maintaining one.

STYLE REFERENCE — match its warm, respectful tone and flow, but do not copy it word for word, and never reuse its "had a website earlier" claim:
"""
Good evening sir!

I'm the founder of Menefides. We help businesses build modern websites and improve their online presence.

I recently came across Hotel Rainbow, Minjur, and noticed that you had a website earlier. I just wanted to know if you're still using it or if you've stopped maintaining it for some reason.

I thought of reaching out because I feel there's a good opportunity to give Hotel Rainbow a fresh online presence with a well-designed website where customers can easily explore your menu, view your food, find your location and contact you.

I actually have a few ideas for how your website could look, and I'd be happy to put together a small demo for you.

If you're interested, we'd love to have a quick chat whenever you're free.

Thank you!

Menefides
Digital Innovation. Secure by Design.
"""

Every email must follow this order:
a. Start with the provided greeting followed by " sir/madam," (for example, "Good evening sir/madam,"). Then this one-line introduction: "I'm the ${SENDER_ROLE} of Menefides. We help businesses build modern websites and improve their online presence."
b. Write "I recently came across {name}, {area}" and one observation that is TRUE from the data:
   - If has_website is false: say that no website is listed on their Google Maps profile.
   - If has_website is true: say you saw their website at {website_host}. Do not claim you reviewed it or that it has any problems.
   - Optionally mention their rating and review count as a compliment, only when both are present.
c. Explain why you are reaching out: 2 or 3 concrete things a website would give THIS type of business, written as customers doing things ("customers can easily explore your menu, view your food, find your location and contact you"). Tailor the benefits to the category. Examples: tuition centre or school: courses, fees, batch timings, results, an enquiry form; salon: services and prices, a photo gallery, online booking; hotel or restaurant: menu, food photos, location, table or order enquiries; gym: plans, timings, trainers, trial sign-up; clinic: doctors, timings, appointment requests. For other categories, infer sensible benefits. Do not make up statistics.
   If has_website is true, instead offer a free quick check of their website (speed, mobile view, SSL, basic security) and briefly explain why that matters for this type of business.
d. For no-website leads, include this offer in your own words: "I actually have a few ideas for how your website could look, and I'd be happy to put together a small demo for you." For has-website leads, offer a short report instead of a demo.
e. Include this closing line in your own words: "If you're interested, we'd love to have a quick chat whenever you're free."
f. End the body with "Thank you!"
Vary the wording between businesses so the messages do not look copy-pasted, but keep this order and a warm, respectful, human tone. No hype, no emojis. The email body must be about 120-170 words, not counting the signature. Do not include a signature, sign-off name, or company block in email_body; the code adds the signature.

WhatsApp: same flow but shorter. Start with the greeting and "sir/madam", introduce yourself as the ${SENDER_ROLE} of Menefides in one line, state the specific observation, give one or two benefits for this type of business (or the free website check for has-website leads), offer a small demo (or a free report), and end with a question. About 60-90 words, casual and polite, no emoji. Do not include a signature; the code adds it. End with a question before the signature.

If language is "tamil": write the same structure in natural spoken Tamil using Tamil script, translate the greeting naturally, and keep the business name and "Menefides" in English.

Output only a JSON object with exactly these keys: email_subject, email_body, whatsapp. email_subject must be a short, specific subject line with no hype and no emojis.`;

const DEFAULT_MODEL = "openai/gpt-oss-120b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// ---------- Types ----------

type Language = "english" | "tamil";

export interface GeneratedMessages {
  email: { subject: string; body: string };
  whatsapp: string;
  source: "ai" | "fallback";
  error?: string;
}

export interface GenerateMessageOptions {
  language?: Language;
}

interface GroqMessages {
  email_subject: string;
  email_body: string;
  whatsapp: string;
}

type GroqOutcome =
  | { ok: true; messages: GroqMessages }
  | { ok: false; error: string };

interface Greeting {
  english: string;
  tamil: string;
}

// ---------- Small helpers ----------

function greetingNow(): Greeting {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");

  if (hour < 12) return { english: "Good morning", tamil: "காலை வணக்கம்" };
  if (hour < 17) return { english: "Good afternoon", tamil: "மதிய வணக்கம்" };
  return { english: "Good evening", tamil: "மாலை வணக்கம்" };
}

function areaOf(lead: Lead): string {
  const city = lead.city.trim();
  const address = lead.address.trim();
  if (!address) return city || "your area";

  const cityIndex = city
    ? address.toLowerCase().lastIndexOf(city.toLowerCase())
    : -1;

  if (cityIndex > 0) {
    const beforeCity = address.slice(0, cityIndex).replace(/[,\s]+$/, "");
    const parts = beforeCity
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }

  return city || address;
}

function hostOf(website: string | null): string | null {
  if (!website) return null;
  try {
    return new URL(website).hostname.replace(/^www\./i, "");
  } catch {
    const host = website
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .trim();
    return host || null;
  }
}

function emailSignature(): string {
  return SENDER_NAME ? `${SENDER_NAME}\n${SIGNATURE_EMAIL}` : SIGNATURE_EMAIL;
}

function whatsappSignature(): string {
  return SENDER_NAME
    ? `${SENDER_NAME}\n${SIGNATURE_WHATSAPP}`
    : SIGNATURE_WHATSAPP;
}

function appendEmailSignature(body: string): string {
  return `${body.trim()}\n\n${emailSignature()}`;
}

function appendWhatsAppSignature(text: string): string {
  return `${text.trim()}\n\n${whatsappSignature()}`;
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function isGroqMessages(value: unknown): value is GroqMessages {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GroqMessages>;
  return (
    typeof candidate.email_subject === "string" &&
    candidate.email_subject.trim().length > 0 &&
    typeof candidate.email_body === "string" &&
    candidate.email_body.trim().length > 0 &&
    typeof candidate.whatsapp === "string" &&
    candidate.whatsapp.trim().length > 0
  );
}

// ---------- Fallback template building blocks ----------

interface BenefitText {
  email: string;
  whatsapp: string;
}

interface BenefitCopy {
  english: BenefitText;
  tamil: BenefitText;
}

function benefitsFor(category: string): BenefitCopy {
  const c = category.toLowerCase();

  if (/(salon|beauty|spa|hair)/.test(c)) {
    return {
      english: {
        email:
          "customers easily explore your services and prices, browse a photo gallery of your work, and book appointments online",
        whatsapp:
          "customers see your services and prices, view photos of your work, and book appointments online",
      },
      tamil: {
        email:
          "customers உங்கள் services மற்றும் prices-ஐ பார்க்கலாம், உங்கள் work-இன் photos gallery பார்க்கலாம், online-ல் appointment book செய்யலாம்",
        whatsapp:
          "customers services, prices, work photos பார்க்கலாம், online booking செய்யலாம்",
      },
    };
  }

  if (/(clinic|doctor|dental|hospital|medical)/.test(c)) {
    return {
      english: {
        email:
          "patients see the doctors and timings, request appointments online, and find your location",
        whatsapp:
          "patients see doctors and timings, request appointments, and find your location",
      },
      tamil: {
        email:
          "patients doctors மற்றும் timings பார்க்கலாம், appointment request செய்யலாம், உங்கள் location-ஐ எளிதாக கண்டுபிடிக்கலாம்",
        whatsapp:
          "patients doctors, timings பார்க்கலாம், appointment request செய்யலாம்",
      },
    };
  }

  if (/(tuition|school|coaching|academy|college|institute)/.test(c)) {
    return {
      english: {
        email:
          "parents see your courses, fees and batch timings, check results, and send an enquiry",
        whatsapp:
          "parents see courses, fees and batch timings, check results, and send an enquiry",
      },
      tamil: {
        email:
          "parents courses, fees, batch timings பார்க்கலாம், results பார்க்கலாம், enquiry அனுப்பலாம்",
        whatsapp:
          "parents courses, fees, batch timings, results பார்க்கலாம், enquiry அனுப்பலாம்",
      },
    };
  }

  if (/(restaurant|hotel|cafe|food|catering|bakery)/.test(c)) {
    return {
      english: {
        email:
          "customers explore your menu, view food photos, find your location, and send table or order enquiries",
        whatsapp:
          "customers see your menu and food photos, find your location, and send table or order enquiries",
      },
      tamil: {
        email:
          "customers menu, food photos பார்க்கலாம், உங்கள் location கண்டுபிடிக்கலாம், table அல்லது order enquiries அனுப்பலாம்",
        whatsapp:
          "customers menu, food photos பார்க்கலாம், location கண்டுபிடிக்கலாம், table/order enquiries அனுப்பலாம்",
      },
    };
  }

  if (/(gym|fitness|yoga)/.test(c)) {
    return {
      english: {
        email:
          "customers see your plans and timings, meet your trainers, and sign up for a trial",
        whatsapp:
          "customers see plans, timings and trainers, and sign up for a trial",
      },
      tamil: {
        email:
          "customers plans, timings, trainers பார்க்கலாம், trial-க்கு sign up செய்யலாம்",
        whatsapp:
          "customers plans, timings, trainers பார்க்கலாம், trial sign up செய்யலாம்",
      },
    };
  }

  return {
    english: {
      email:
        "customers learn about your services, find your location, and contact you easily",
      whatsapp:
        "customers learn about your services, find your location, and contact you easily",
    },
    tamil: {
      email:
        "customers உங்கள் services பற்றி தெரிந்து கொள்ளலாம், உங்கள் location கண்டுபிடிக்கலாம், எளிதாக contact செய்யலாம்",
      whatsapp:
        "customers services, location மற்றும் contact விவரங்களை பார்க்கலாம்",
    },
  };
}

// ---------- Groq ----------

const MAX_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 15_000;
const TOTAL_BUDGET_MS = 28_000;
const RETRY_DELAYS_MS = [1_000, 2_500];
const RETRY_JITTER_MS = 400;
const MIN_ATTEMPT_MS = 500;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function failureReason(status: number): string {
  if (status === 400) return "bad request";
  if (status === 401) return "invalid API key";
  if (status === 403) return "permission denied";
  if (status === 404) return "model not found";
  if (status === 429) return "rate limited";
  if (status >= 500) return "server error";
  return "request failed";
}

type RequestResult =
  | { ok: true; messages: GroqMessages }
  | { ok: false; kind: "retryable"; status: number }
  | { ok: false; kind: "network" }
  | { ok: false; kind: "timeout" }
  | { ok: false; kind: "budget" }
  | { ok: false; kind: "fatal"; error: string };

type TemporaryFailure =
  | { kind: "retryable"; status: number }
  | { kind: "network" }
  | { kind: "timeout" };

function retryDelay(attempt: number): number {
  const base =
    RETRY_DELAYS_MS[attempt - 1] ??
    RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
  return base + Math.floor(Math.random() * RETRY_JITTER_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestGroq(
  apiKey: string,
  requestBody: unknown,
  deadline: number
): Promise<RequestResult> {
  const remaining = deadline - Date.now();
  if (remaining <= MIN_ATTEMPT_MS) return { ok: false, kind: "budget" };

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(Math.min(ATTEMPT_TIMEOUT_MS, remaining)),
    });

    if (!res.ok) {
      if (RETRYABLE_STATUSES.has(res.status)) {
        return { ok: false, kind: "retryable", status: res.status };
      }
      return {
        ok: false,
        kind: "fatal",
        error: `Groq returned ${res.status}: ${failureReason(res.status)}`,
      };
    }

    const data = await res.json().catch(() => null);
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      return { ok: false, kind: "fatal", error: "Empty response from model" };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFences(text));
    } catch {
      return { ok: false, kind: "fatal", error: "Invalid JSON from model" };
    }

    if (!isGroqMessages(parsed)) {
      return {
        ok: false,
        kind: "fatal",
        error: "Invalid message format from model",
      };
    }

    return { ok: true, messages: parsed };
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      return Date.now() >= deadline
        ? { ok: false, kind: "budget" }
        : { ok: false, kind: "timeout" };
    }
    return { ok: false, kind: "network" };
  }
}

function temporaryFailureMessage(failure: TemporaryFailure): string {
  if (failure.kind === "retryable") {
    if (failure.status === 429) {
      return "Groq rate limited (429), please try Regenerate";
    }
    return `Groq server busy (${failure.status}), please try Regenerate`;
  }
  if (failure.kind === "timeout") return "Timed out";
  return "Could not reach Groq, please try Regenerate";
}

async function askGroq(
  lead: Lead,
  language: Language,
  deadline: number
): Promise<GroqOutcome> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("GROQ_API_KEY is missing. Using fallback messages.");
    return { ok: false, error: "Missing GROQ_API_KEY" };
  }

  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;
  const greeting = greetingNow().english;
  const leadFacts = {
    name: lead.name,
    category: lead.category,
    city: lead.city,
    area: areaOf(lead),
    rating: lead.rating,
    review_count: lead.review_count,
    has_website: Boolean(lead.website),
    website_host: hostOf(lead.website),
    greeting,
    language,
  };

  const requestBody = {
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(leadFacts) },
    ],
    temperature: 0.8,
    max_tokens: 2000,
    response_format: { type: "json_object" },
  };

  let lastFailure: TemporaryFailure | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const result = await requestGroq(apiKey, requestBody, deadline);

    if (result.ok) return { ok: true, messages: result.messages };

    if (result.kind === "budget") {
      console.error("Groq time budget exhausted.");
      return { ok: false, error: "Timed out" };
    }

    if (result.kind === "fatal") {
      console.error(
        `Groq attempt ${attempt}/${MAX_ATTEMPTS} failed: ${result.error}.`
      );
      return { ok: false, error: result.error };
    }

    lastFailure = result;

    if (result.kind === "retryable") {
      console.error(
        `Groq attempt ${attempt}/${MAX_ATTEMPTS} failed with status ${result.status}.`
      );
    } else if (result.kind === "timeout") {
      console.error(`Groq attempt ${attempt}/${MAX_ATTEMPTS} timed out.`);
    } else {
      console.error(
        `Groq attempt ${attempt}/${MAX_ATTEMPTS} failed with a network error.`
      );
    }

    if (attempt < MAX_ATTEMPTS) {
      const delay = retryDelay(attempt);
      if (Date.now() + delay + MIN_ATTEMPT_MS > deadline) {
        console.error("Groq time budget exhausted before the next attempt.");
        return { ok: false, error: "Timed out" };
      }
      await sleep(delay);
    }
  }

  return {
    ok: false,
    error: lastFailure
      ? temporaryFailureMessage(lastFailure)
      : "Could not reach Groq, please try Regenerate",
  };
}

// ---------- Fallback ----------

function fallbackMessages(
  lead: Lead,
  language: Language,
  error: string
): GeneratedMessages {
  const greeting = greetingNow();
  const area = areaOf(lead);
  const hasWebsite = Boolean(lead.website);
  const host = hostOf(lead.website) ?? "your website";
  const benefits = benefitsFor(lead.category);
  const benefit = language === "tamil" ? benefits.tamil : benefits.english;

  if (language === "tamil") {
    const ratingLine =
      lead.rating != null && lead.review_count != null
        ? ` உங்களுக்கு ${lead.rating.toFixed(
            1
          )} rating, ${lead.review_count.toLocaleString(
            "en-IN"
          )} Google reviews இருக்கிறது — மிகவும் நல்லது.`
        : "";

    const observation = hasWebsite
      ? `சமீபத்தில் ${lead.name}, ${area} பற்றி பார்த்தேன், உங்கள் website ${host}-ல் இருப்பதை பார்த்தேன்.${ratingLine}`
      : `சமீபத்தில் ${lead.name}, ${area} பற்றி பார்த்தேன். உங்கள் Google Maps profile-ல் website எதுவும் இல்லை என்று கவனித்தேன்.${ratingLine}`;

    const reason = hasWebsite
      ? `நான் தொடர்பு கொள்ள காரணம், உங்கள் website-க்கு ஒரு free quick check செய்து தருகிறோம் — speed, mobile view, SSL, basic security. உங்கள் ${lead.category} business-க்கு இது visitors-க்கு நம்பிக்கை கொடுக்கவும், அவர்கள் உங்களை contact செய்யவும் உதவும்.`
      : `நான் தொடர்பு கொள்ள காரணம், ஒரு website இருந்தால் ${benefit.email}. இது புதிய customers உங்களை எளிதாக கண்டுபிடிக்கவும், உங்களை contact செய்யவும் உதவும்.`;

    const offer = hasWebsite
      ? "இந்த check பற்றி ஒரு சிறிய report அனுப்பலாம்."
      : "உங்கள் website எப்படி இருக்கலாம் என்று எனக்கு சில ideas இருக்கின்றன. ஒரு சிறிய demo தயார் செய்து தர சந்தோஷப்படுகிறேன்.";

    const emailBody = `${greeting.tamil} sir/madam,

நான் Menefides-இன் ${SENDER_ROLE}. நாங்கள் businesses-க்கு modern websites உருவாக்கி, அவர்களின் online presence-ஐ மேம்படுத்த உதவுகிறோம்.

${observation}

${reason}

${offer}

உங்களுக்கு ஆர்வம் இருந்தால், எப்போது நேரம் இருந்தாலும் ஒரு சிறிய chat செய்யலாம்.

நன்றி!`;

    const whatsappBody = hasWebsite
      ? `${greeting.tamil} sir/madam, நான் Menefides-இன் ${SENDER_ROLE}. ${observation} உங்கள் website-க்கு free quick check (speed, mobile view, SSL, basic security) செய்து தருகிறோம். உங்கள் ${lead.category} business-க்கு இது visitors-க்கு நம்பிக்கை கொடுக்கவும், contact செய்யவும் உதவும். ஒரு சிறிய report அனுப்பலாம். ஒரு quick chat செய்யலாமா?`
      : `${greeting.tamil} sir/madam, நான் Menefides-இன் ${SENDER_ROLE}. ${observation} ஒரு website இருந்தால் ${benefit.whatsapp}. புதிய customers உங்களை online-ல் எளிதாக கண்டுபிடிக்கவும் உதவும். ஒரு சிறிய demo தயார் செய்து தரலாம். ஒரு quick chat செய்யலாமா?`;

    return {
      email: {
        subject: hasWebsite
          ? `${lead.name} website-க்கு ஒரு quick check`
          : `${lead.name} business-க்கு ஒரு website idea`,
        body: appendEmailSignature(emailBody),
      },
      whatsapp: appendWhatsAppSignature(whatsappBody),
      source: "fallback",
      error,
    };
  }

  const ratingLine =
    lead.rating != null && lead.review_count != null
      ? ` Your ${lead.rating.toFixed(1)} rating from ${lead.review_count.toLocaleString(
          "en-IN"
        )} Google reviews is impressive.`
      : "";

  const observation = hasWebsite
    ? `I recently came across ${lead.name}, ${area}, and saw your website at ${host}.${ratingLine}`
    : `I recently came across ${lead.name}, ${area}, and noticed that no website is listed on your Google Maps profile.${ratingLine}`;

  const reason = hasWebsite
    ? `I thought of reaching out because we offer a free quick check of your website covering speed, mobile view, SSL and basic security. For your ${lead.category} business, a fast, mobile-friendly and secure website helps visitors trust you, stay longer, and get in touch more easily.`
    : `I thought of reaching out because a website would let ${benefit.email}. It would also make it easier for new customers nearby to find you online.`;

  const offer = hasWebsite
    ? "I'd be happy to send you a short report with what we find, with no obligation."
    : "I actually have a few ideas for how your website could look, and I'd be happy to put together a small demo for you.";

  const emailBody = `${greeting.english} sir/madam,

I'm the ${SENDER_ROLE} of Menefides. We help businesses build modern websites and improve their online presence.

${observation}

${reason}

${offer}

If you're interested, we'd love to have a quick chat whenever you're free.

Thank you!`;

  const whatsappBody = hasWebsite
    ? `${greeting.english} sir/madam, I'm the ${SENDER_ROLE} of Menefides. ${observation} We offer a free quick check of your website covering speed, mobile view, SSL and basic security. For your ${lead.category} business, this helps visitors trust you and get in touch. I'd be happy to send a short report. Would you be open to a quick chat?`
    : `${greeting.english} sir/madam, I'm the ${SENDER_ROLE} of Menefides. ${observation} A website would let ${benefit.whatsapp}. It would also help new customers find you online. I'd be happy to put together a small demo. Would you be open to a quick chat?`;

  return {
    email: {
      subject: hasWebsite
        ? `A quick website check for ${lead.name}`
        : `A website idea for ${lead.name}`,
      body: appendEmailSignature(emailBody),
    },
    whatsapp: appendWhatsAppSignature(whatsappBody),
    source: "fallback",
    error,
  };
}

// ---------- Public API ----------

export async function generateMessages(
  lead: Lead,
  opts?: GenerateMessageOptions
): Promise<GeneratedMessages> {
  const language: Language = opts?.language === "tamil" ? "tamil" : "english";
  const deadline = Date.now() + TOTAL_BUDGET_MS;

  try {
    const outcome = await askGroq(lead, language, deadline);

    if (outcome.ok) {
      return {
        email: {
          subject: outcome.messages.email_subject.trim(),
          body: appendEmailSignature(outcome.messages.email_body),
        },
        whatsapp: appendWhatsAppSignature(outcome.messages.whatsapp),
        source: "ai",
      };
    }

    return fallbackMessages(lead, language, outcome.error);
  } catch (err) {
    console.error("Message generation failed:", err);
    return fallbackMessages(lead, language, "Unexpected error");
  }
}
