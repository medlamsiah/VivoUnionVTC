import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import {
  buildDriverWeeklyDashboardRows,
  listDriverWeeklyLocationSettings,
  listLocationTypePricings,
} from "@/lib/driver-weekly-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  try {
    const [locationSettings, locationTypePricings, uberSnapshots] = await Promise.all([
      listDriverWeeklyLocationSettings(),
      listLocationTypePricings(),
      prisma.uberDriverRevenueSnapshot.findMany({
        orderBy: {
          snapshotDate: "desc",
        },
      }),
    ]);

    const uberMap = new Map<string, number>();

    for (const snap of uberSnapshots) {
      const key = snap.driverNameKey?.trim().toLowerCase();
      if (!key) continue;

      uberMap.set(key, (uberMap.get(key) || 0) + snap.totalRevenue);
    }

    const baseDrivers = locationSettings.map((driver) => ({
      id: driver.driverId,
      name: driver.driverName,
      company: driver.companyName || "",
      uber: uberMap.get(driver.driverName.trim().toLowerCase()) || 0,
      bolt: 0,
      heetch: 0,
      location: 0,
      acompte: 0,
      week: "S21",
      weekValue: "2026-W21",
      status: "Actif",
      vehicleType: null,
    }));

    const drivers = buildDriverWeeklyDashboardRows(
      baseDrivers,
      locationSettings,
      locationTypePricings
    );

    return NextResponse.json({
      drivers,
      syncStatuses: [],
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