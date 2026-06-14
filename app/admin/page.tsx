import { AdminVivoDashboard } from "@/components/admin-vivo-dashboard";
import {
  buildDriverWeeklyDashboardRows,
  listDriverWeeklyLocationSettings,
  listLocationTypePricings,
} from "@/lib/driver-weekly-settings";
import { readWeeklyRevenuesSnapshot } from "@/lib/integrations/weekly-revenues";
import { listUberEarnings, listUberEarningsAsWeeklyDrivers } from "@/lib/integrations/uber-earnings";
import { getUberSessionStatus } from "@/lib/integrations/uber-session";
import { prisma } from "@/lib/prisma";
import { buildVivoDashboardData } from "@/lib/vivo-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const initialDate = new Date().toISOString().slice(0, 10);
  const revenuesResult = await readWeeklyRevenuesSnapshot();

  const [total, last7, leads, uberEarningsResponse, uberDbDrivers, uberSessionStatus] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
    }),
    prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    listUberEarnings(),
    listUberEarningsAsWeeklyDrivers(),
    getUberSessionStatus(),
  ]);
  const [locationSettings, locationTypePricings] = await Promise.all([
    listDriverWeeklyLocationSettings(),
    listLocationTypePricings(),
  ]);
  const combinedDrivers = [...revenuesResult.drivers, ...uberDbDrivers];
  const syncStatuses = revenuesResult.syncStatuses.map((status) =>
    status.platform === "uber"
      ? {
          ...status,
          state: uberEarningsResponse.lastSyncAt ? ("live" as const) : status.state,
          updatedAt: uberEarningsResponse.lastSyncAt
            ? new Date(uberEarningsResponse.lastSyncAt).toLocaleString("fr-FR")
            : status.updatedAt,
          message: uberEarningsResponse.lastSyncAt
            ? "Donnees Uber chargees depuis la base. La synchronisation importe uniquement les dernieres 24h."
            : status.message,
        }
      : status,
  );
  const driversWithLocations = buildDriverWeeklyDashboardRows(
    combinedDrivers,
    locationSettings,
    locationTypePricings,
  );

  const dashboard = buildVivoDashboardData(driversWithLocations);

  return (
    <AdminVivoDashboard
      dashboard={dashboard}
      initialDate={initialDate}
      syncStatuses={syncStatuses}
      uberEarnings={uberEarningsResponse.earnings}
      uberSummary={{
        totalRevenue: uberEarningsResponse.totalRevenue,
        driversCount: uberEarningsResponse.driversCount,
        totalRows: uberEarningsResponse.totalRows,
        lastSyncAt: uberEarningsResponse.lastSyncAt,
      }}
      uberSessionStatus={uberSessionStatus}
      leads={leads.map((lead) => ({
        id: lead.id,
        createdAt: lead.createdAt.toISOString(),
        fullName: lead.fullName,
        email: lead.email ?? "",
        phone: lead.phone ?? "",
        city: lead.city ?? "",
        hasCardVTC: lead.hasCardVTC,
        hasVehicle: lead.hasVehicle,
        experience: lead.experience,
        platforms: lead.platforms,
        weeklyHours: lead.weeklyHours ?? null,
        message: lead.message ?? "",
      }))}
      leadStats={{
        total,
        last7,
        lastUpdate: new Date().toLocaleString("fr-FR"),
      }}
    />
  );
}
