import { NextResponse } from "next/server";

import {
  syncUberEarningsFrom2026,
  UberSessionExpiredError,
  UberSessionMissingError,
} from "@/lib/integrations/uber-earnings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  try {
    return NextResponse.json(await syncUberEarningsFrom2026());
  } catch (error) {
    if (error instanceof UberSessionMissingError) {
      return NextResponse.json({ ok: false, provider: "uber", error: error.message }, { status: 401 });
    }

    if (error instanceof UberSessionExpiredError) {
      return NextResponse.json({ ok: false, provider: "uber", error: error.message }, { status: 401 });
    }

    console.error("Uber historical backfill failed.", error);

    return NextResponse.json(
      {
        ok: false,
        provider: "uber",
        error: "Import historique Uber impossible pour le moment.",
      },
      { status: 500 },
    );
  }
}
