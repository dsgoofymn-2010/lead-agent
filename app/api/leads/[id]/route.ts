// GET /api/leads/:id — load one saved lead.

import { NextResponse } from "next/server";
import { getLeadById } from "@/lib/db";

// The database client needs the Node.js runtime (not the Edge runtime).
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const leadId = Number(id);
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(leadId) || leadId < 1) {
    return NextResponse.json({ error: "Invalid lead id" }, { status: 400 });
  }

  try {
    const lead = await getLeadById(leadId);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    return NextResponse.json({ lead });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Something went wrong on the server." },
      { status: 500 }
    );
  }
}
