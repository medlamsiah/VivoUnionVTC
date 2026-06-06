import { NextResponse } from "next/server";

import { listUberEarnings } from "@/lib/integrations/uber-earnings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await listUberEarnings();

    return NextResponse.json({
      ok: true,
      provider: "uber",
      totalRevenue: result.totalRevenue,
      driverCount: result.driversCount,
      rows: result.earnings.map((row) => ({
        driverName: row.driverName,
        revenue: row.revenue,
        reimbursements: row.reimbursements,
        adjustments: row.adjustments,
        payout: row.payout,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
      })),
    });
  } catch (error) {
    console.error("Unable to read Uber earnings from database.", error);

    return NextResponse.json(
      {
        ok: false,
        provider: "uber",
        rows: [],
        totalRevenue: 0,
        driverCount: 0,
        error: "Lecture des revenus Uber impossible.",
      },
      { status: 500 },
    );
  }
}
