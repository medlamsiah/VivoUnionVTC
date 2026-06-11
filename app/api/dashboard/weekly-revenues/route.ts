import { NextResponse } from "next/server";

import {
  buildDriverWeeklyDashboardRows,
  listDriverWeeklyLocationSettings,
  listLocationTypePricings,
} from "@/lib/driver-weekly-settings";
import { listUberEarnings, listUberEarningsAsWeeklyDrivers } from "@/lib/integrations/uber-earnings";
import { readWeeklyRevenuesSnapshot, scrapeWeeklyRevenuesResult } from "@/lib/integrations/weekly-revenues";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  try {
    const [locationSettings, locationTypePricings, uberDrivers, uberSummary] = await Promise.all([
      listDriverWeeklyLocationSettings(),
      listLocationTypePricings(),
      listUberEarningsAsWeeklyDrivers(),
      listUberEarnings(),
    ]);
    let weeklyResult = readWeeklyRevenuesSnapshot();
    if (weeklyResult.drivers.length === 0) {
      weeklyResult = await scrapeWeeklyRevenuesResult();
    }
    const combinedDrivers = [...weeklyResult.drivers, ...uberDrivers];

    const drivers = buildDriverWeeklyDashboardRows(
      combinedDrivers,
      locationSettings,
      locationTypePricings
    );
    const syncStatuses = weeklyResult.syncStatuses.map((status) =>
      status.platform === "uber"
        ? {
            ...status,
            state: uberSummary.lastSyncAt ? ("live" as const) : status.state,
            updatedAt: uberSummary.lastSyncAt
              ? new Date(uberSummary.lastSyncAt).toLocaleString("fr-FR")
              : status.updatedAt,
            message: uberSummary.lastSyncAt
              ? "Donnees Uber lues depuis la base."
              : "Aucune donnee Uber synchronisee pour le moment.",
          }
        : status,
    );

    return NextResponse.json({
      drivers,
      syncStatuses,
      uberSummary,
    });
  } catch (error) {
    console.error("Failed to load dashboard revenues:", error);

    return NextResponse.json(
      {
        drivers: [],
        syncStatuses: [],
        error: "Unable to load revenues.",
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET();
}
