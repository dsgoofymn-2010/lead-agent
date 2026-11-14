// POST /api/leads/:id/messages — write outreach messages for one lead.
// Body: { language?: "english" | "tamil" }

import { NextResponse } from "next/server";
import { getLeadById } from "@/lib/db";
import { generateMessages } from "@/lib/messages";

// The database client and Groq key need the Node.js runtime.
export const runtime = "nodejs";

// Give the retries room to finish on Vercel.
export const maxDuration = 30;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const leadId = Number(id);
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(leadId) || leadId < 1) {
    return NextResponse.json({ error: "Invalid lead id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const language = body?.language === "tamil" ? "tamil" : "english";

  try {
    const lead = await getLeadById(leadId);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const messages = await generateMessages(lead, { language });
    return NextResponse.json(messages);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Something went wrong on the server." },
      { status: 500 }
    );
  }
}
