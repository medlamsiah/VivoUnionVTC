import { NextRequest, NextResponse } from "next/server";

import { syncUberEarningsLast24h } from "@/lib/integrations/uber-earnings";
import { scrapeWeeklyRevenuesResult } from "@/lib/integrations/weekly-revenues";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await scrapeWeeklyRevenuesResult();
    let uberResult: Awaited<ReturnType<typeof syncUberEarningsLast24h>> | null = null;
    let uberError: string | null = null;

    try {
      uberResult = await syncUberEarningsLast24h();
    } catch (error) {
      uberError = error instanceof Error ? error.message : "Synchro Uber echouee.";
      console.warn("Scheduled Uber sync failed.", error);
    }

    return NextResponse.json({
      ok: true,
      driversCount: result.drivers.length,
      syncStatuses: result.syncStatuses,
      uber: uberResult
        ? uberResult
        : {
            ok: false,
            error: uberError,
          },
      syncedAt: new Date().toLocaleString("fr-FR"),
    });
  } catch (error) {
    console.error("Scheduled platform sync failed.", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Scheduled sync failed.",
      },
      { status: 500 },
    );
  }
}

function isAuthorizedCronRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const authorization = request.headers.get("authorization");
  return authorization === `Bearer ${cronSecret}`;
}
