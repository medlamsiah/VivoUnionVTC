import { AdminVivoDashboard } from "@/components/admin-vivo-dashboard";
import {
  buildDriverWeeklyDashboardRows,
  listDriverWeeklyLocationSettings,
  listLocationTypePricings,
} from "@/lib/driver-weekly-settings";
import { readWeeklyRevenuesSnapshot, scrapeWeeklyRevenuesResult } from "@/lib/integrations/weekly-revenues";
import { prisma } from "@/lib/prisma";
import { buildVivoDashboardData } from "@/lib/vivo-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const initialDate = new Date().toISOString().slice(0, 10);
  let revenuesResult = readWeeklyRevenuesSnapshot();

  if (revenuesResult.drivers.length === 0) {
    try {
      revenuesResult = await scrapeWeeklyRevenuesResult();
    } catch (error) {
      console.warn("Initial Bolt sync failed while rendering /admin.", error);
    }
  }

  const [total, last7, leads] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
    }),
    prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);
  const [locationSettings, locationTypePricings] = await Promise.all([
    listDriverWeeklyLocationSettings(),
    listLocationTypePricings(),
  ]);
  const driversWithLocations = buildDriverWeeklyDashboardRows(
    revenuesResult.drivers,
    locationSettings,
    locationTypePricings,
  );

  const dashboard = buildVivoDashboardData(driversWithLocations);

  return (
    <AdminVivoDashboard
      dashboard={dashboard}
      initialDate={initialDate}
      syncStatuses={revenuesResult.syncStatuses}
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
