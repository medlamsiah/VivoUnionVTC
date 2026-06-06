import { NextResponse } from "next/server";

import {
  syncUberEarningsLast24h,
  syncUberEarningsRange,
  UberSessionExpiredError,
  UberSessionMissingError,
} from "@/lib/integrations/uber-earnings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const startDate = parseOptionalDate(body?.startDate);
    const endDate = parseOptionalDate(body?.endDate);
    const result = startDate && endDate
      ? await syncUberEarningsRange(startDate, endDate)
      : await syncUberEarningsLast24h();

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UberSessionMissingError) {
      return NextResponse.json({ ok: false, provider: "uber", error: error.message }, { status: 401 });
    }

    if (error instanceof UberSessionExpiredError) {
      return NextResponse.json({ ok: false, provider: "uber", error: error.message }, { status: 401 });
    }

    console.error("Uber earnings sync failed.", error);

    return NextResponse.json(
      {
        ok: false,
        provider: "uber",
        error: "Synchronisation Uber impossible pour le moment.",
      },
      { status: 500 },
    );
  }
}

function parseOptionalDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
