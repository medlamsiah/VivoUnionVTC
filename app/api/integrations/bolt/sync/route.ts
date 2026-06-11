import { NextResponse } from "next/server";

import { syncBoltLast24hKeepingCache } from "@/lib/integrations/bolt-scraper";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST() {
  try {
    return NextResponse.json(await syncBoltLast24hKeepingCache());
  } catch (error) {
    console.error("Bolt 24h sync failed.", error);

    return NextResponse.json(
      {
        ok: false,
        provider: "bolt",
        error: error instanceof Error ? error.message : "Synchronisation Bolt 24h impossible.",
      },
      { status: 500 },
    );
  }
}
