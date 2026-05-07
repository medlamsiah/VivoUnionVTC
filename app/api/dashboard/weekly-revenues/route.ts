import { NextResponse } from "next/server";

import {
  buildDriverWeeklyDashboardRows,
  listDriverWeeklyLocationSettings,
  listLocationTypePricings,
} from "@/lib/driver-weekly-settings";
import { readWeeklyRevenuesSnapshot, scrapeWeeklyRevenuesResult } from "@/lib/integrations/weekly-revenues";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  try {
    let result = readWeeklyRevenuesSnapshot();

    // On a fresh production deployment there is no snapshot yet.
    // In that case, try one live sync so the admin is immediately usable.
    if (result.drivers.length === 0) {
      try {
        result = await withTimeout(scrapeWeeklyRevenuesResult(), 120_000);
      } catch (syncError) {
        console.warn("Weekly revenues snapshot missing and live sync failed.", syncError);
      }
    }

    const [locationSettings, locationTypePricings] = await Promise.all([
      listDriverWeeklyLocationSettings(),
      listLocationTypePricings(),
    ]);
    const drivers = buildDriverWeeklyDashboardRows(result.drivers, locationSettings, locationTypePricings);
    return NextResponse.json({ ...result, drivers });
  } catch (error) {
    console.error("Failed to serve weekly platform revenues.", error);

    return NextResponse.json(
      {
        drivers: [],
        syncStatuses: [],
        error: "Unable to load weekly revenues right now.",
      },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const result = await withTimeout(scrapeWeeklyRevenuesResult(), 120_000);
    const [locationSettings, locationTypePricings] = await Promise.all([
      listDriverWeeklyLocationSettings(),
      listLocationTypePricings(),
    ]);
    const drivers = buildDriverWeeklyDashboardRows(result.drivers, locationSettings, locationTypePricings);
    return NextResponse.json({ ...result, drivers });
  } catch (error) {
    console.error("Failed to refresh weekly platform revenues.", error);

    return NextResponse.json(
      {
        drivers: [],
        syncStatuses: [],
        error: "Unable to refresh weekly revenues right now.",
      },
      { status: 500 },
    );
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
