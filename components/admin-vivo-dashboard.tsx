"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { PlatformSyncStatus } from "@/lib/integrations/weekly-revenues";
import type { UberEarningDto, UberEarningsSummary } from "@/lib/integrations/uber-earnings";
import type { UberSessionStatus } from "@/lib/integrations/uber-session";
import {
  formatCurrency,
  formatPercent,
  type VivoDashboardData,
  type VivoMonthlyRow,
  type VivoWeeklyRow,
} from "@/lib/vivo-dashboard";

type AdminVivoDashboardProps = {
  dashboard: VivoDashboardData;
  initialDate: string;
  syncStatuses: PlatformSyncStatus[];
  uberEarnings: UberEarningDto[];
  uberSummary: UberEarningsSummary;
  uberSessionStatus: UberSessionStatus;
  leads: Array<{
    id: string;
    createdAt: string;
    fullName: string;
    email: string;
    phone: string;
    city: string;
    hasCardVTC: boolean;
    hasVehicle: boolean;
    experience: string;
    platforms: string;
    weeklyHours: number | null;
    message: string;
  }>;
  leadStats: {
    total: number;
    last7: number;
    lastUpdate: string;
  };
};

type ViewMode = "separate" | "merged" | "both";
type ActiveTable = "charts" | "detailed" | "merged" | "monthly" | "uber" | "leads";

const PAGE_SIZE = 10;
const chartPalette = ["#0f766e", "#14b8a6", "#0f172a", "#f59e0b", "#0ea5e9", "#f97316"];

export function AdminVivoDashboard({
  dashboard,
  initialDate,
  syncStatuses,
  uberEarnings,
  uberSummary,
  uberSessionStatus,
  leadStats,
  leads,
}: AdminVivoDashboardProps) {
  const defaultWeekValue = useMemo(() => {
    if (dashboard.weekOptions.length === 0) {
      return getWeekValueFromDate(initialDate);
    }

    return [...dashboard.weekOptions].sort((a, b) => {
      const aStart = getDateRangeFromWeekValue(a).start.getTime();
      const bStart = getDateRangeFromWeekValue(b).start.getTime();
      return bStart - aStart;
    })[0];
  }, [dashboard.weekOptions, initialDate]);

  const initialWeekRange = useMemo(() => getDateRangeFromWeekValue(defaultWeekValue), [defaultWeekValue]);
  const [selectedStartDate, setSelectedStartDate] = useState<string>(toInputDateTimeValue(initialWeekRange.start));
  const [selectedEndDate, setSelectedEndDate] = useState<string>(toInputDateTimeValue(initialWeekRange.end));
  const [selectedDriver, setSelectedDriver] = useState<string>("all");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [activeTable, setActiveTable] = useState<ActiveTable>("detailed");
  const [detailedPage, setDetailedPage] = useState(1);
  const [mergedPage, setMergedPage] = useState(1);
  const [monthlyPage, setMonthlyPage] = useState(1);
  const [uberPage, setUberPage] = useState(1);
  const [leadPage, setLeadPage] = useState(1);

  useEffect(() => {
    setDetailedPage(1);
    setMergedPage(1);
    setMonthlyPage(1);
    setUberPage(1);
    setLeadPage(1);
  }, [selectedStartDate, selectedEndDate, selectedDriver, selectedCampaign, activeTable]);

  useEffect(() => {
    setSelectedStartDate(toInputDateTimeValue(initialWeekRange.start));
    setSelectedEndDate(toInputDateTimeValue(initialWeekRange.end));
  }, [initialWeekRange]);

  const normalizedDateRange = useMemo(
    () => normalizeDateRange(selectedStartDate, selectedEndDate),
    [selectedStartDate, selectedEndDate],
  );

  const filteredWeekOptions = useMemo(
    () => dashboard.weekOptions.filter((weekValue) => doesWeekIntersectRange(weekValue, normalizedDateRange.start, normalizedDateRange.end)),
    [dashboard.weekOptions, normalizedDateRange.end, normalizedDateRange.start],
  );

  const filteredWeeklyRows = dashboard.weeklyRows.filter((row) => {
    const matchesRange = doesWeekIntersectRange(row.weekValue, normalizedDateRange.start, normalizedDateRange.end);
    const matchesDriver = selectedDriver === "all" || row.name === selectedDriver;
    const matchesCampaign = selectedCampaign === "all" || rowMatchesCampaign(row, selectedCampaign);
    return matchesRange && matchesDriver && matchesCampaign;
  });

  const filteredMonthlyRows = dashboard.monthlyRows.filter((row) => {
    const matchesRange = row.weeks.some((week) =>
      doesWeekIntersectRange(week.weekValue, normalizedDateRange.start, normalizedDateRange.end),
    );
    const matchesDriver = selectedDriver === "all" || row.name === selectedDriver;
    const matchesCampaign = selectedCampaign === "all" || monthlyRowMatchesCampaign(row, selectedCampaign);
    return matchesRange && matchesDriver && matchesCampaign;
  });

  const mergedWeeklyRows = useMemo(() => mergeWeeklyRowsByDriverAndWeek(filteredWeeklyRows), [filteredWeeklyRows]);
  const mergedMonthlyRows = useMemo(() => mergeMonthlyRowsByDriverAndMonth(filteredMonthlyRows), [filteredMonthlyRows]);

  const totalBrut = sum(filteredWeeklyRows.map((row) => row.totalBrut));
  const totalNet = sum(filteredWeeklyRows.map((row) => row.totalApresCharge));
  const totalRestant = sum(filteredWeeklyRows.map((row) => row.totalRestant));
  const averageCommission =
    filteredWeeklyRows.length > 0
      ? sum(filteredWeeklyRows.map((row) => row.vivoCommission)) / filteredWeeklyRows.length
      : 0;

  const visibleDriversCount = new Set(filteredWeeklyRows.map((row) => row.name)).size;
  const totalDriverCount = new Set(dashboard.weeklyRows.map((row) => row.name)).size;
  const totalLineCount = dashboard.weeklyRows.length;
  const availableCampaignOptions = getAvailableCampaignOptions(dashboard.weeklyRows);
  const nonLiveStatuses = syncStatuses.filter((status) => status.state !== "live");

  const topDriversChartRows = [...mergedWeeklyRows]
    .sort((a, b) => b.totalBrut - a.totalBrut)
    .slice(0, 8)
    .map((row) => ({
      name: row.name,
      total: row.totalBrut,
    }));

  const weeklyTrendRows = filteredWeekOptions.map((weekValue) => {
    const range = getDateRangeFromWeekValue(weekValue);
    return {
      label: range.weekLabel,
    value: round2(
      dashboard.weeklyRows
        .filter((row) => {
          const matchesWeek = row.weekValue === weekValue;
          const matchesDriver = selectedDriver === "all" || row.name === selectedDriver;
          const matchesCampaign = selectedCampaign === "all" || rowMatchesCampaign(row, selectedCampaign);
          return matchesWeek && matchesDriver && matchesCampaign;
        })
        .reduce((total, row) => total + row.totalApresCharge, 0),
    ),
    };
  });

  const paginatedDetailedRows = paginate(mergedWeeklyRows, detailedPage, PAGE_SIZE);
  const paginatedMergedRows = paginate(mergedWeeklyRows, mergedPage, PAGE_SIZE);
  const paginatedMonthlyRows = paginate(mergedMonthlyRows, monthlyPage, PAGE_SIZE);
  const paginatedUberEarnings = paginate(uberEarnings, uberPage, PAGE_SIZE);
  const paginatedLeads = paginate(leads, leadPage, 12);
  const leadPlatformsSummary = useMemo(() => {
    const counters = new Map<string, number>();
    for (const lead of leads) {
      for (const platform of splitLeadPlatforms(lead.platforms)) {
        counters.set(platform, (counters.get(platform) ?? 0) + 1);
      }
    }
    return [...counters.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [leads]);
  const leadCitiesSummary = useMemo(() => {
    const counters = new Map<string, number>();
    for (const lead of leads) {
      const city = lead.city.trim() || "Ville non renseignee";
      counters.set(city, (counters.get(city) ?? 0) + 1);
    }
    return [...counters.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [leads]);

  return (
    <section className="min-h-screen bg-[linear-gradient(180deg,_#f5f9f7_0%,_#edf4f1_44%,_#f8fbfa_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[32px] border border-emerald-100 bg-[linear-gradient(135deg,_#07141f_0%,_#0f1f2d_54%,_#123127_100%)] text-white shadow-[0_32px_90px_rgba(15,23,42,0.18)]">
          <div className="grid gap-3 px-5 py-3 md:px-6 lg:px-7 lg:py-3">
            <div>
              <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-200">
                VIVO Admin
              </div>
              <h1 className="mt-2 max-w-3xl text-xl font-semibold leading-[1.05] tracking-tight md:text-3xl">
                Dashboard revenus chauffeurs, propre, lisible et pilote par semaine.
              </h1>
            </div>

            <div className="w-full rounded-[24px] border border-white/10 bg-white/10 p-3 backdrop-blur">
              <div className="text-sm font-semibold text-emerald-100">Filtre semaine</div>
              <div className="mt-2 rounded-[22px] border border-white/10 bg-slate-950/35 p-3">
                <div className="grid gap-2.5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,1.2fr)] lg:items-start">
                  <div>
                    <DateField label="Du" value={selectedStartDate} onChange={setSelectedStartDate} />
                  </div>
                  <div>
                    <DateField label="Au" value={selectedEndDate} onChange={setSelectedEndDate} />
                  </div>
                  <div>
                    <FilterSelect
                      label="Chauffeur"
                      value={selectedDriver}
                      onChange={setSelectedDriver}
                      options={[
                        { label: "Tous les chauffeurs", value: "all" },
                        ...dashboard.driverOptions.map((driver) => ({ label: driver, value: driver })),
                      ]}
                      dark
                    />
                  </div>
                  <div>
                    <FilterSelect
                      label="Campagne"
                      value={selectedCampaign}
                      onChange={setSelectedCampaign}
                      options={availableCampaignOptions}
                      dark
                    />
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Periode selectionnee</div>
                    <div className="mt-1 text-base font-semibold text-white">
                      {getCurrentFilterSummary(normalizedDateRange.start, normalizedDateRange.end)}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-slate-300">
                      Choisis librement la plage : le dashboard affiche toutes les semaines incluses dans cette periode.
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStartDate(toInputDateTimeValue(initialWeekRange.start));
                    setSelectedEndDate(toInputDateTimeValue(initialWeekRange.end));
                    setSelectedDriver("all");
                    setSelectedCampaign("all");
                    setActiveTable("detailed");
                  }}
                  className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                >
                  Revenir a la semaine actuelle
                </button>
                <span className="text-xs leading-5 text-slate-300">
                  Tu peux maintenant filtrer sur n'importe quelle plage de dates.
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Brut filtre" value={formatCurrency(totalBrut)} helper="Total de la semaine active" />
          <KpiCard label="Net apres charge" value={formatCurrency(totalNet)} helper="Apres commission et location" />
          <KpiCard label="Reste a verser" value={formatCurrency(totalRestant)} helper="Retrait disponible moins acompte" />
          <KpiCard label="Commission moyenne" value={formatCurrency(averageCommission)} helper="Moyenne sur les lignes affichees" />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <KpiCard label="Session Uber" value={formatUberSessionStatus(uberSessionStatus.status)} helper={uberSessionStatusMessage(uberSessionStatus)} />
          <KpiCard label="Total revenus Uber" value={formatCurrency(uberSummary.totalRevenue)} helper={`${uberSummary.totalRows} lignes stockees en DB`} />
          <KpiCard label="Chauffeurs Uber" value={String(uberSummary.driversCount)} helper="Chauffeurs distincts stockes" />
          <KpiCard label="Derniere synchronisation" value={formatShortDateTime(uberSummary.lastSyncAt)} helper="Source: base de donnees" />
        </div>

        {nonLiveStatuses.length > 0 ? (
          <div className="mt-6 rounded-[26px] border border-amber-200 bg-amber-50/90 p-4 shadow-[0_10px_30px_rgba(245,158,11,0.08)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm font-semibold text-amber-900">Action admin requise</div>
                <div className="mt-1 text-sm text-amber-800">
                  {nonLiveStatuses.length} campagne(s) ne sont plus en live. Le dashboard continue avec le cache, mais tu peux lancer une reconnexion propre.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/admin/integrations"
                  className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Ouvrir le centre de reconnexion
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-4 xl:self-start">
            <div className="rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
              <div>
                <div className="text-sm font-semibold text-slate-900">Navigation admin</div>
                <div className="text-xs text-slate-500">Passe rapidement d'un tableau a l'autre</div>
              </div>

              <div className="mt-4 hidden xl:flex xl:flex-col xl:gap-2">
                <SidebarNavButton active={activeTable === "charts"} onClick={() => setActiveTable("charts")}>
                  Graphiques
                </SidebarNavButton>
                <SidebarNavButton active={activeTable === "detailed"} onClick={() => setActiveTable("detailed")}>
                  Tableau detaille
                </SidebarNavButton>
                <SidebarNavButton active={activeTable === "merged"} onClick={() => setActiveTable("merged")}>
                  Tableau fusionne
                </SidebarNavButton>
                <SidebarNavButton active={activeTable === "monthly"} onClick={() => setActiveTable("monthly")}>
                  Releve mensuel
                </SidebarNavButton>
                <SidebarNavButton active={activeTable === "uber"} onClick={() => setActiveTable("uber")}>
                  Revenus Uber
                </SidebarNavButton>
                <SidebarNavButton active={activeTable === "leads"} onClick={() => setActiveTable("leads")}>
                  Candidatures
                </SidebarNavButton>
                <Link
                  href="/admin/locations"
                  className="mt-2 inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  Gerer les locations
                </Link>
                <a
                  href="/api/leads/export"
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Export Excel
                </a>
                <BoltSyncButton className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500" />
                <ManualSyncButton className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500" />
                <UberBackfillButton className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800" />
                <UberIdentifyButton className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700" />
              </div>

              <div className="mt-4 flex flex-wrap gap-2 xl:hidden">
                <NavTab active={activeTable === "charts"} onClick={() => setActiveTable("charts")}>
                  Graphiques
                </NavTab>
                <NavTab active={activeTable === "detailed"} onClick={() => setActiveTable("detailed")}>
                  Tableau detaille
                </NavTab>
                <NavTab active={activeTable === "merged"} onClick={() => setActiveTable("merged")}>
                  Tableau fusionne
                </NavTab>
                <NavTab active={activeTable === "monthly"} onClick={() => setActiveTable("monthly")}>
                  Releve mensuel
                </NavTab>
                <NavTab active={activeTable === "uber"} onClick={() => setActiveTable("uber")}>
                  Revenus Uber
                </NavTab>
                <NavTab active={activeTable === "leads"} onClick={() => setActiveTable("leads")}>
                  Candidatures
                </NavTab>
                <Link
                  href="/admin/locations"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  Gerer les locations
                </Link>
                <a
                  href="/api/leads/export"
                  className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Export Excel
                </a>
                <BoltSyncButton className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500" />
                <ManualSyncButton className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500" />
                <UberBackfillButton className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800" />
                <UberIdentifyButton className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700" />
              </div>

              <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Candidatures</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{leadStats.total}</div>
                <div className="mt-1 text-sm text-slate-500">{leadStats.last7} nouvelles sur 7 jours</div>
              </div>
            </div>
          </aside>

          <div>
        {activeTable === "charts" ? (
          <div id="graphiques" className="mt-8 scroll-mt-28 grid gap-6 xl:grid-cols-2">
            <Panel title="Top chauffeurs plateformes" subtitle="Classement Uber + Bolt sur la selection active">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topDriversChartRows}>
                    <CartesianGrid stroke="#dbe7e3" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} hide />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${value} EUR`} width={90} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="total" radius={[10, 10, 0, 0]}>
                      {topDriversChartRows.map((_, index) => (
                        <Cell key={`driver-bar-${index}`} fill={chartPalette[index % chartPalette.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Tendance par semaine" subtitle="Evolution du net apres charge sur le mois choisi">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyTrendRows}>
                    <CartesianGrid stroke="#dbe7e3" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${value} EUR`} width={90} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Line type="monotone" dataKey="value" stroke="#0f766e" strokeWidth={3} dot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>
        ) : null}

        {activeTable !== "charts" && activeTable !== "leads" ? (
          <div className="mt-8 grid gap-6 xl:grid-cols-[1.45fr_0.55fr]">
          <Panel title={getActiveTableTitle(activeTable)} subtitle={getActiveTableSubtitle(activeTable)}>
            {activeTable === "detailed" ? (
              <TableSection title="Vue detaillee cumulee" subtitle="Une ligne par chauffeur et semaine, campagnes cumulees" totalItems={mergedWeeklyRows.length}>
                <WeeklyTable rows={paginatedDetailedRows} emptyMessage="Aucun resultat pour cette selection." />
                <PaginationControls
                  currentPage={detailedPage}
                  pageSize={PAGE_SIZE}
                  totalItems={mergedWeeklyRows.length}
                  onPageChange={setDetailedPage}
                />
              </TableSection>
            ) : null}

            {activeTable === "merged" ? (
              <TableSection title="Vue fusionnee par chauffeur" subtitle="Aggregation des revenus sur la semaine choisie" totalItems={mergedWeeklyRows.length}>
                <WeeklyTable rows={paginatedMergedRows} emptyMessage="Aucun resultat fusionne pour cette selection." />
                <PaginationControls
                  currentPage={mergedPage}
                  pageSize={PAGE_SIZE}
                  totalItems={mergedWeeklyRows.length}
                  onPageChange={setMergedPage}
                />
              </TableSection>
            ) : null}

            {activeTable === "monthly" ? (
              <TableSection title="Synthese mensuelle cumulee" subtitle="Une ligne par chauffeur et par mois, campagnes cumulees" totalItems={mergedMonthlyRows.length}>
                <MonthlyTable rows={paginatedMonthlyRows} />
                <PaginationControls
                  currentPage={monthlyPage}
                  pageSize={PAGE_SIZE}
                  totalItems={mergedMonthlyRows.length}
                  onPageChange={setMonthlyPage}
                />
              </TableSection>
            ) : null}

            {activeTable === "uber" ? (
              <div className="space-y-4">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Statut session Uber: {formatUberSessionStatus(uberSessionStatus.status)}</div>
                      <div className="mt-1 text-sm text-slate-600">{uberSessionStatusMessage(uberSessionStatus)}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <UberIdentifyButton className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700" />
                      <UberBackfillButton className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800" />
                      <ManualSyncButton className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500" />
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <KpiCard label="Revenus Uber" value={formatCurrency(uberSummary.totalRevenue)} helper={`${uberSummary.totalRows} lignes importees`} />
                  <KpiCard label="Chauffeurs Uber" value={String(uberSummary.driversCount)} helper="Chauffeurs distincts en DB" />
                </div>
                <TableSection title="Revenus Uber stockes" subtitle="Lecture directe depuis la base de donnees" totalItems={uberEarnings.length}>
                  <UberEarningsTable rows={paginatedUberEarnings} />
                  <PaginationControls
                    currentPage={uberPage}
                    pageSize={PAGE_SIZE}
                    totalItems={uberEarnings.length}
                    onPageChange={setUberPage}
                  />
                </TableSection>
              </div>
            ) : null}
          </Panel>

          <Panel title="Regles VIVO" subtitle="Reperes rapides de calcul">
            <div className="space-y-3">
              {[
                "Revenus bruts = UBER + BOLT + HEETCH",
                "Commission VIVO = 16% / 14% / 12%",
                "Total hors charge = brut - commission",
                "Total apres charge = hors charge - location",
                "Retrait disponible = total apres charge / 2",
                "Total restant = retrait disponible - acompte",
              ].map((item, index) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </Panel>
          </div>
        ) : null}

        {activeTable === "leads" ? (
          <div className="mt-8 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
            <Panel title="Candidatures questionnaire" subtitle="Toutes les reponses envoyees depuis le formulaire public">
              <div className="grid gap-4 md:grid-cols-3">
                <KpiCard label="Total candidatures" value={String(leadStats.total)} helper="Toutes les fiches enregistrees" />
                <KpiCard label="7 derniers jours" value={String(leadStats.last7)} helper="Nouveaux candidats recents" />
                <KpiCard label="Derniere mise a jour" value={leadStats.lastUpdate} helper="Heure locale admin" />
              </div>

              <div className="mt-5 rounded-[26px] border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Liste complete</div>
                    <div className="text-xs text-slate-500">Exportable en Excel en un clic</div>
                  </div>
                  <a
                    href="/api/leads/export"
                    className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Telecharger Excel
                  </a>
                </div>
                <LeadsTable rows={paginatedLeads} />
                <PaginationControls
                  currentPage={leadPage}
                  pageSize={12}
                  totalItems={leads.length}
                  onPageChange={setLeadPage}
                />
              </div>
            </Panel>

            <Panel title="Lecture rapide" subtitle="Resume du questionnaire pour piloter les candidatures">
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">Plateformes les plus demandees</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {leadPlatformsSummary.map((item) => (
                      <span key={item.label} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                        {item.label}: {item.count}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">Villes principales</div>
                  <div className="mt-3 space-y-2">
                    {leadCitiesSummary.map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-2xl bg-white px-3 py-2 text-sm">
                        <span className="font-medium text-slate-800">{item.label}</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">Usage conseille</div>
                  <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                    <p>Le tableau reprend toutes les reponses du questionnaire public, sans rien perdre.</p>
                    <p>Tu peux trier visuellement, puis exporter le tout dans Excel pour traitement externe, partage ou archivage.</p>
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        ) : null}

        <div className="mt-4 rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Statistiques de la semaine</div>
              <div className="mt-1 text-sm text-slate-500">
                {mergedWeeklyRows.length} lignes visibles sur {totalLineCount}, {visibleDriversCount} chauffeurs visibles sur {totalDriverCount}.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <MetricBadgeLight label="Periode active" value={getCurrentFilterSummary(normalizedDateRange.start, normalizedDateRange.end)} />
              <MetricBadgeLight label="Chauffeurs visibles" value={String(visibleDriversCount)} />
              <MetricBadgeLight label="Total chauffeurs" value={String(totalDriverCount)} />
            </div>
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="text-sm font-semibold text-slate-900">Etat des synchronisations</div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {syncStatuses.map((status) => (
                <PlatformStatusCard key={status.platform} status={status} />
              ))}
            </div>
          </div>
        </div>
          </div>
        </div>

      </div>
    </section>
  );
}

function WeeklyTable({ rows, emptyMessage }: { rows: VivoWeeklyRow[]; emptyMessage: string }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-[1220px] text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
              <HeaderCell>Chauffeur</HeaderCell>
              <HeaderCell>Semaine</HeaderCell>
              <HeaderCell>Uber</HeaderCell>
              <HeaderCell>Bolt</HeaderCell>
              <HeaderCell>Heetch</HeaderCell>
              <HeaderCell>Total Brut</HeaderCell>
              <HeaderCell>% VIVO</HeaderCell>
              <HeaderCell>Total Hors Charge</HeaderCell>
              <HeaderCell>Location</HeaderCell>
              <HeaderCell>Total Apres Charge</HeaderCell>
              <HeaderCell>Deficit</HeaderCell>
              <HeaderCell>Retrait Disponible</HeaderCell>
              <HeaderCell>Acompte</HeaderCell>
              <HeaderCell>Total Restant</HeaderCell>
              <HeaderCell>Action</HeaderCell>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.name}-${row.weekValue}`} className="border-b border-slate-100 align-top odd:bg-white even:bg-slate-50/50">
                <BodyCell>
                  <div className="font-semibold text-slate-900">{row.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500">{row.status}</span>
                    <SourceBadges sources={getWeeklyRowSources(row)} />
                  </div>
                </BodyCell>
                <BodyCell>
                  <div className="font-semibold text-slate-800">{row.week}</div>
                  <div className="text-xs text-slate-500">{row.weekValue}</div>
                </BodyCell>
                <BodyCell className={row.uber > 0 ? "font-semibold text-sky-700" : ""}>{formatCurrency(row.uber)}</BodyCell>
                <BodyCell className={row.bolt > 0 ? "font-semibold text-emerald-700" : ""}>{formatCurrency(row.bolt)}</BodyCell>
                <BodyCell>{formatCurrency(row.heetch)}</BodyCell>
                <BodyCell>{formatCurrency(row.totalBrut)}</BodyCell>
                <BodyCell>
                  <div className="font-semibold text-slate-800">{formatPercent(row.vivoRate)}</div>
                  <div className="text-xs text-slate-500">{formatCurrency(row.vivoCommission)}</div>
                </BodyCell>
                <BodyCell>{formatCurrency(row.totalHorsCharge)}</BodyCell>
                <BodyCell>
                  <div className="font-medium text-slate-800">{formatCurrency(row.location)}</div>
                  <Link
                    href={`/admin/locations?driver=${encodeURIComponent(row.name)}&weekValue=${encodeURIComponent(row.weekValue)}`}
                    className="mt-2 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
                  >
                    Modifier
                  </Link>
                </BodyCell>
                <BodyCell>{formatCurrency(row.totalApresCharge)}</BodyCell>
                <BodyCell className={row.deficitLocation > 0 ? "font-semibold text-rose-600" : "font-semibold text-emerald-700"}>
                  {formatCurrency(row.deficitLocation)}
                </BodyCell>
                <BodyCell>{formatCurrency(row.retraitDisponible)}</BodyCell>
                <BodyCell>{formatCurrency(row.acompte)}</BodyCell>
                <BodyCell className="font-semibold text-slate-900">{formatCurrency(row.totalRestant)}</BodyCell>
                <BodyCell>
                  <Link
                    href={`/admin/locations?driver=${encodeURIComponent(row.name)}&weekValue=${encodeURIComponent(row.weekValue)}`}
                    className="inline-flex rounded-full bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                  >
                    Editer
                  </Link>
                </BodyCell>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={15} className="px-4 py-12 text-center text-sm text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MonthlyTable({ rows }: { rows: VivoMonthlyRow[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-[1080px] text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
              <HeaderCell>Nom</HeaderCell>
              <HeaderCell>Periode</HeaderCell>
              <HeaderCell>Semaines</HeaderCell>
              <HeaderCell>Total C.A Brut</HeaderCell>
              <HeaderCell>Montant fiche de paie</HeaderCell>
              <HeaderCell>Charge fiche de paie</HeaderCell>
              <HeaderCell>Total Net</HeaderCell>
              <HeaderCell>Paiements recus</HeaderCell>
              <HeaderCell>Total Restant</HeaderCell>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.name}-${row.company}-${row.monthKey}`} className="border-b border-slate-100 odd:bg-white even:bg-slate-50/50">
                <BodyCell>
                  <div className="font-semibold text-slate-900">{row.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <SourceBadges sources={getMonthlyRowSources(row)} />
                  </div>
                </BodyCell>
                <BodyCell>{row.periodLabel}</BodyCell>
                <BodyCell className="whitespace-normal">
                  <div className="flex flex-wrap gap-2">
                    {row.weeks.map((week) => (
                      <span key={`${row.name}-${week.weekValue}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {week.label}: {formatCurrency(week.value)}
                      </span>
                    ))}
                  </div>
                </BodyCell>
                <BodyCell>{formatCurrency(row.totalCABrut)}</BodyCell>
                <BodyCell>{formatCurrency(row.montantFichePaie)}</BodyCell>
                <BodyCell>{formatCurrency(row.chargeFichePaie)}</BodyCell>
                <BodyCell>{formatCurrency(row.totalNet)}</BodyCell>
                <BodyCell>{formatCurrency(row.totalPaiementsRecus)}</BodyCell>
                <BodyCell className="font-semibold text-slate-900">{formatCurrency(row.totalRestant)}</BodyCell>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                  Aucun releve mensuel disponible pour ce filtre.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UberEarningsTable({ rows }: { rows: UberEarningDto[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-[980px] text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
              <HeaderCell>Chauffeur</HeaderCell>
              <HeaderCell>Periode</HeaderCell>
              <HeaderCell>Revenus</HeaderCell>
              <HeaderCell>Remboursements</HeaderCell>
              <HeaderCell>Ajustements</HeaderCell>
              <HeaderCell>Payout</HeaderCell>
              <HeaderCell>Maj DB</HeaderCell>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 align-top odd:bg-white even:bg-slate-50/50">
                <BodyCell>
                  <div className="font-semibold text-slate-900">{row.driverName}</div>
                </BodyCell>
                <BodyCell>
                  <div className="font-medium text-slate-800">{formatShortDateTime(row.periodStart)}</div>
                  <div className="text-xs text-slate-500">{formatShortDateTime(row.periodEnd)}</div>
                </BodyCell>
                <BodyCell className="font-semibold text-sky-700">{formatCurrency(row.revenue)}</BodyCell>
                <BodyCell>{formatCurrency(row.reimbursements)}</BodyCell>
                <BodyCell>{formatCurrency(row.adjustments)}</BodyCell>
                <BodyCell>{formatCurrency(row.payout)}</BodyCell>
                <BodyCell>{formatShortDateTime(row.updatedAt)}</BodyCell>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                  Aucune donnee Uber importee. Connectez Uber puis cliquez sur Synchroniser Uber.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="rounded-[30px] border border-slate-200 bg-white/90 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function TableSection({
  title,
  subtitle,
  totalItems,
  children,
}: {
  title: string;
  subtitle: string;
  totalItems: number;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="text-xs text-slate-500">{subtitle}</div>
        </div>
        <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
          {totalItems} lignes
        </div>
      </div>
      {children}
    </div>
  );
}

function KpiCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</div>
      <div className="mt-2 text-sm text-slate-500">{helper}</div>
    </div>
  );
}

function PlatformStatusCard({ status }: { status: PlatformSyncStatus }) {
  const badgeClass =
    status.state === "live"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status.state === "cache"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-rose-200 bg-rose-50 text-rose-700";
  const badgeLabel = status.state === "live" ? "Live" : status.state === "cache" ? "Cache" : "Expire";
  const helperText =
    status.state === "live"
      ? "Donnees recuperees en direct lors de la derniere synchronisation."
      : status.state === "cache"
        ? "Affichage de la derniere synchronisation reussie en attendant la prochaine tentative."
        : "Connexion indisponible pour le moment. Une reconnexion sera necessaire si le cache ne suffit plus.";

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold capitalize text-slate-900">{status.platform}</div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass}`}>
          {badgeLabel}
        </span>
      </div>
      <div className="mt-2 text-sm text-slate-600">{status.message}</div>
      <div className="mt-2 text-xs text-slate-500">{helperText}</div>
      <div className="mt-2 text-xs text-slate-500">
        {status.updatedAt ? `Dernière synchro réussie: ${status.updatedAt}` : "Aucune date disponible"}
      </div>
      {status.platform === "bolt" && status.diagnostics && status.diagnostics.length > 0 ? (
        <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold text-slate-800">Diagnostic Bolt</summary>
          <ul className="mt-2 max-h-40 space-y-1 overflow-auto">
            {status.diagnostics.slice(-8).map((line, index) => (
              <li key={`${status.platform}-diagnostic-${index}`}>{line}</li>
            ))}
          </ul>
        </details>
      ) : null}
      {status.state !== "live" ? (
        <div className="mt-4">
          <Link
            href="/admin/integrations"
            className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
          >
            Reconnecter cette campagne
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function MetricBadgeLight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800">
      <span className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <span className="ml-2">{value}</span>
    </div>
  );
}

function NavTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
        active
          ? "border-emerald-300 bg-emerald-500 text-white"
          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
      }`}
    >
      {children}
    </button>
  );
}

function SidebarNavButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
        active
          ? "bg-emerald-500 text-white shadow-[0_14px_26px_rgba(16,185,129,0.22)]"
          : "border border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
      }`}
    >
      {children}
    </button>
  );
}

function BoltSyncButton({ className }: { className: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>("");

  async function handleClick() {
    setMessage("Synchronisation Bolt 24h...");

    startTransition(async () => {
      try {
        const response = await fetch("/api/integrations/bolt/sync", {
          method: "POST",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          setMessage(payload?.error ?? "Synchro Bolt 24h impossible.");
          return;
        }

        setMessage(`Bolt OK: ${payload.updatedRows ?? 0} lignes mises a jour, cache conserve.`);
        router.refresh();
      } catch {
        setMessage("Erreur reseau pendant la synchro Bolt.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button type="button" onClick={handleClick} disabled={isPending} className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}>
        {isPending ? "Synchro Bolt..." : "Synchroniser Bolt 24h"}
      </button>
      {message ? <span className="text-xs text-slate-500">{message}</span> : null}
    </div>
  );
}

function ManualSyncButton({ className }: { className: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>("");

  async function handleClick() {
    setMessage("");

    startTransition(async () => {
      try {
        const response = await fetch("/api/integrations/uber/sync", {
          method: "POST",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          setMessage(payload?.error ?? "Synchro Uber impossible pour le moment.");
          return;
        }

        setMessage(`Uber 24h synchronise: ${payload.imported ?? 0} importees, ${payload.updated ?? 0} mises a jour.`);
        router.refresh();
      } catch {
        setMessage("Erreur reseau pendant la synchro Uber.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button type="button" onClick={handleClick} disabled={isPending} className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}>
        {isPending ? "Synchronisation Uber..." : "Synchroniser Uber 24h"}
      </button>
      {message ? <span className="text-xs text-slate-500">{message}</span> : null}
    </div>
  );
}

function UberBackfillButton({ className }: { className: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>("");

  async function handleClick() {
    setMessage("Import historique Uber depuis le 01/01/2026...");

    startTransition(async () => {
      try {
        const response = await fetch("/api/integrations/uber/sync", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            startDate: "2026-01-01T00:00:00.000Z",
            endDate: new Date().toISOString(),
          }),
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          setMessage(payload?.error ?? "Import historique Uber impossible.");
          return;
        }

        setMessage(
          `Historique Uber OK: ${payload.imported ?? 0} importees, ${payload.updated ?? 0} mises a jour sur ${payload.daysSynced ?? 0} jours.`,
        );
        router.refresh();
      } catch {
        setMessage("Erreur reseau pendant l'import historique Uber.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button type="button" onClick={handleClick} disabled={isPending} className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}>
        {isPending ? "Import historique..." : "Importer historique"}
      </button>
      {message ? <span className="text-xs text-slate-500">{message}</span> : null}
    </div>
  );
}

function UberIdentifyButton({ className }: { className: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>("");

  async function handleClick() {
    setMessage("Identification Uber en cours...");

    startTransition(async () => {
      try {
        const loginResponse = await fetch("/api/integrations/uber/login", {
          method: "POST",
          cache: "no-store",
        });
        const loginPayload = await loginResponse.json().catch(() => null);

        if (!loginResponse.ok) {
          setMessage(loginPayload?.error ?? "Identification Uber incomplete.");
          return;
        }

        const syncResponse = await fetch("/api/integrations/uber/sync", {
          method: "POST",
          cache: "no-store",
        });
        const syncPayload = await syncResponse.json().catch(() => null);

        if (!syncResponse.ok) {
          setMessage(syncPayload?.error ?? "Identification OK, synchronisation Uber refusee.");
          router.refresh();
          return;
        }

        setMessage(`Identification OK. ${syncPayload.imported ?? 0} importees, ${syncPayload.updated ?? 0} mises a jour.`);
        router.refresh();
      } catch {
        setMessage("Identification Uber impossible depuis ce serveur.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button type="button" onClick={handleClick} disabled={isPending} className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}>
        {isPending ? "Identification Uber..." : "Identifier Uber"}
      </button>
      {message ? (
        <span className="text-xs text-slate-500">
          {message}{" "}
          {message.includes("Vercel") ? (
            <Link href="/admin/uber-session" className="font-semibold text-emerald-700 underline">
              Session manuelle
            </Link>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

function UberSessionLink({ className }: { className: string }) {
  return (
    <Link href="/admin/uber-session" className={className}>
      Session Uber
    </Link>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-300">{label}</span>
      <input
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300"
      />
    </label>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  dark = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  dark?: boolean;
}) {
  return (
    <label className="block">
      <span className={`mb-2 block text-xs font-medium uppercase tracking-[0.18em] ${dark ? "text-slate-300" : "text-slate-300"}`}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={
          dark
            ? "w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300"
            : "w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300"
        }
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PaginationControls({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
}: {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const start = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const end = Math.min(safeCurrentPage * pageSize, totalItems);

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-slate-600">
        {totalItems === 0 ? "Aucune ligne" : `Lignes ${start} a ${end} sur ${totalItems}`}
      </div>
      <div className="flex items-center gap-2">
        <PagerButton disabled={safeCurrentPage <= 1} onClick={() => onPageChange(safeCurrentPage - 1)}>
          Precedent
        </PagerButton>
        <span className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
          Page {safeCurrentPage}/{totalPages}
        </span>
        <PagerButton disabled={safeCurrentPage >= totalPages} onClick={() => onPageChange(safeCurrentPage + 1)}>
          Suivant
        </PagerButton>
      </div>
    </div>
  );
}

function PagerButton({ children, disabled, onClick }: { children: ReactNode; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function HeaderCell({ children }: { children: ReactNode }) {
  return <th className="whitespace-nowrap px-4 py-3 font-semibold">{children}</th>;
}

function BodyCell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-4 py-4 text-slate-700 ${className}`}>{children}</td>;
}

function LeadsTable({
  rows,
}: {
  rows: Array<{
    id: string;
    createdAt: string;
    fullName: string;
    email: string;
    phone: string;
    city: string;
    hasCardVTC: boolean;
    hasVehicle: boolean;
    experience: string;
    platforms: string;
    weeklyHours: number | null;
    message: string;
  }>;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-[1520px] text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
              <HeaderCell>Date</HeaderCell>
              <HeaderCell>Nom complet</HeaderCell>
              <HeaderCell>Ville</HeaderCell>
              <HeaderCell>Email</HeaderCell>
              <HeaderCell>Telephone</HeaderCell>
              <HeaderCell>Carte VTC</HeaderCell>
              <HeaderCell>Vehicule</HeaderCell>
              <HeaderCell>Experience</HeaderCell>
              <HeaderCell>Plateformes</HeaderCell>
              <HeaderCell>Heures / sem.</HeaderCell>
              <HeaderCell>Message</HeaderCell>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 align-top odd:bg-white even:bg-slate-50/50">
                <BodyCell>
                  <div className="font-semibold text-slate-900">{formatLeadDate(row.createdAt)}</div>
                </BodyCell>
                <BodyCell className="whitespace-normal">
                  <div className="font-semibold text-slate-900">{row.fullName}</div>
                </BodyCell>
                <BodyCell>{row.city || "—"}</BodyCell>
                <BodyCell>{row.email || "—"}</BodyCell>
                <BodyCell>{row.phone || "—"}</BodyCell>
                <BodyCell>
                  <BooleanPill value={row.hasCardVTC} trueLabel="Oui" falseLabel="Non" />
                </BodyCell>
                <BodyCell>
                  <BooleanPill value={row.hasVehicle} trueLabel="Oui" falseLabel="Non" />
                </BodyCell>
                <BodyCell>{row.experience}</BodyCell>
                <BodyCell className="whitespace-normal">
                  <div className="flex flex-wrap gap-2">
                    {splitLeadPlatforms(row.platforms).map((platform) => (
                      <span key={`${row.id}-${platform}`} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                        {platform}
                      </span>
                    ))}
                  </div>
                </BodyCell>
                <BodyCell>{row.weeklyHours ?? "—"}</BodyCell>
                <BodyCell className="whitespace-normal">
                  <div className="max-w-[360px] leading-6 text-slate-600">{row.message || "—"}</div>
                </BodyCell>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-sm text-slate-500">
                  Aucune candidature disponible pour le moment.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BooleanPill({
  value,
  trueLabel,
  falseLabel,
}: {
  value: boolean;
  trueLabel: string;
  falseLabel: string;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        value ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
      }`}
    >
      {value ? trueLabel : falseLabel}
    </span>
  );
}

function SourceBadges({ sources }: { sources: string[] }) {
  return (
    <>
      {sources.map((source) => (
        <span
          key={source}
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            source === "Uber"
              ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
              : source === "Bolt"
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                : source === "Heetch"
                  ? "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200"
                : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
          }`}
        >
          {source}
        </span>
      ))}
    </>
  );
}

function getWeeklyRowSources(row: VivoWeeklyRow): string[] {
  const sources: string[] = [];

  if (row.uber > 0) {
    sources.push("Uber");
  }

  if (row.bolt > 0) {
    sources.push("Bolt");
  }

  if (row.heetch > 0) {
    sources.push("Heetch");
  }

  if (sources.length === 0) {
    sources.push("Aucune source");
  }

  return sources;
}

function getMonthlyRowSources(row: VivoMonthlyRow): string[] {
  const company = row.company.toLowerCase();

  if (company.includes("uber")) {
    return ["Uber"];
  }

  if (company.includes("heetch")) {
    return ["Heetch"];
  }

  return ["Bolt"];
}

function rowMatchesCampaign(row: VivoWeeklyRow, campaign: string): boolean {
  const company = row.company.toLowerCase();

  if (campaign === "uber") {
    return company.includes("uber");
  }

  if (campaign === "bolt") {
    return !company.includes("uber") && !company.includes("heetch");
  }

  if (campaign === "heetch") {
    return company.includes("heetch");
  }

  return true;
}

function monthlyRowMatchesCampaign(row: VivoMonthlyRow, campaign: string): boolean {
  const company = row.company.toLowerCase();

  if (campaign === "uber") {
    return company.includes("uber");
  }

  if (campaign === "bolt") {
    return !company.includes("uber") && !company.includes("heetch");
  }

  if (campaign === "heetch") {
    return company.includes("heetch");
  }

  return true;
}

function mergeWeeklyRowsByDriverAndWeek(rows: VivoWeeklyRow[]): VivoWeeklyRow[] {
  const merged = new Map<
    string,
    {
      row: VivoWeeklyRow;
      companies: Set<string>;
    }
  >();

  for (const row of rows) {
    const key = `${row.name}::${row.weekValue}`;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        row: { ...row },
        companies: new Set([row.company]),
      });
      continue;
    }

    existing.companies.add(row.company);
    const uber = round2(existing.row.uber + row.uber);
    const bolt = round2(existing.row.bolt + row.bolt);
    const heetch = round2(existing.row.heetch + row.heetch);
    const freenow = round2(existing.row.freenow + row.freenow);
    const totalBrut = round2(uber + bolt + heetch + freenow);
    const vivoRate = getVivoRate(totalBrut);
    const vivoCommission = round2(totalBrut * vivoRate);
    const location = round2(existing.row.location + row.location);
    const totalHorsCharge = round2(totalBrut - vivoCommission);
    const totalApresCharge = round2(totalHorsCharge - location);
    const acompte = round2(existing.row.acompte + row.acompte);
    const retraitDisponible = round2(totalApresCharge / 2);
    const totalRestant = round2(retraitDisponible - acompte);

    existing.row = {
      ...existing.row,
      company: "Multi-campagnes",
      uber,
      bolt,
      heetch,
      freenow,
      totalBrut,
      vivoRate,
      vivoCommission,
      totalHorsCharge,
      location,
      totalApresCharge,
      deficitLocation: round2(Math.max(-totalApresCharge, 0)),
      retraitDisponible,
      acompte,
      totalRestant,
    };
  }

  return [...merged.values()]
    .map(({ row, companies }) => ({
      ...row,
      company: companies.size > 1 ? Array.from(companies).sort((a, b) => a.localeCompare(b)).join(" + ") : row.company,
    }))
    .sort((a, b) => {
      const nameCompare = a.name.localeCompare(b.name);
      if (nameCompare !== 0) {
        return nameCompare;
      }

      return a.weekValue.localeCompare(b.weekValue);
    });
}

function mergeMonthlyRowsByDriverAndMonth(rows: VivoMonthlyRow[]): VivoMonthlyRow[] {
  const merged = new Map<
    string,
    {
      row: VivoMonthlyRow;
      companies: Set<string>;
      weeks: Map<string, { label: string; value: number; weekValue: string }>;
    }
  >();

  for (const row of rows) {
    const key = `${row.name}::${row.monthKey}`;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        row: {
          ...row,
          weeks: row.weeks.map((week) => ({ ...week })),
        },
        companies: new Set([row.company]),
        weeks: new Map(row.weeks.map((week) => [week.weekValue, { ...week }])),
      });
      continue;
    }

    existing.companies.add(row.company);

    for (const week of row.weeks) {
      const currentWeek = existing.weeks.get(week.weekValue);
      if (!currentWeek) {
        existing.weeks.set(week.weekValue, { ...week });
        continue;
      }

      existing.weeks.set(week.weekValue, {
        ...currentWeek,
        value: round2(currentWeek.value + week.value),
      });
    }

    const totalCABrut = round2(existing.row.totalCABrut + row.totalCABrut);
    const montantFichePaie = totalCABrut >= 2000 ? 424.9 : round2((totalCABrut / 100) * 21.245);
    const chargeFichePaie = round2((montantFichePaie / 100) * 22);
    const totalNet = round2(totalCABrut - montantFichePaie);
    const totalPaiementsRecus = round2(existing.row.totalPaiementsRecus + row.totalPaiementsRecus);
    const totalRestant = round2(totalNet - totalPaiementsRecus);

    existing.row = {
      ...existing.row,
      totalCABrut,
      montantFichePaie,
      chargeFichePaie,
      totalNet,
      totalPaiementsRecus,
      totalRestant,
    };
  }

  return [...merged.values()]
    .map(({ row, companies, weeks }) => ({
      ...row,
      company: companies.size > 1 ? Array.from(companies).sort((a, b) => a.localeCompare(b)).join(" + ") : row.company,
      weeks: [...weeks.values()].sort((a, b) => a.weekValue.localeCompare(b.weekValue)),
    }))
    .sort((a, b) => {
      const nameCompare = a.name.localeCompare(b.name);
      if (nameCompare !== 0) {
        return nameCompare;
      }

      return a.monthKey.localeCompare(b.monthKey);
    });
}

function getAvailableCampaignOptions(rows: VivoWeeklyRow[]): Array<{ label: string; value: string }> {
  const options = [{ label: "Toutes les campagnes", value: "all" }];

  if (rows.some((row) => row.uber > 0)) {
    options.push({ label: "Uber", value: "uber" });
  }

  if (rows.some((row) => row.bolt > 0)) {
    options.push({ label: "Bolt", value: "bolt" });
  }

  if (rows.some((row) => row.heetch > 0)) {
    options.push({ label: "Heetch", value: "heetch" });
  }

  return options;
}

function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function getVivoRate(totalBrut: number): number {
  if (totalBrut < 500) {
    return 0.16;
  }

  if (totalBrut < 1000) {
    return 0.14;
  }

  return 0.12;
}

function normalizeDateRange(startInput: string, endInput: string): { start: Date; end: Date } {
  const start = new Date(startInput);
  const end = new Date(endInput);

  if (start.getTime() <= end.getTime()) {
    return { start, end };
  }

  return { start: end, end: start };
}

function doesWeekIntersectRange(weekValue: string, start: Date, end: Date): boolean {
  const range = getDateRangeFromWeekValue(weekValue);
  return range.start.getTime() <= end.getTime() && range.end.getTime() >= start.getTime();
}

function toInputDateTimeValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getWeekValueFromDate(dateInput: string): string {
  const date = new Date(`${dateInput}T00:00:00`);
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

function getDateRangeFromWeekValue(weekValue: string): {
  start: Date;
  end: Date;
  startLabel: string;
  endLabel: string;
  weekLabel: string;
} {
  const match = weekValue.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    const now = new Date();
    return {
      start: now,
      end: now,
      startLabel: now.toLocaleDateString("fr-FR"),
      endLabel: now.toLocaleDateString("fr-FR"),
      weekLabel: weekValue,
    };
  }

  const [, yearString, weekString] = match;
  const year = Number(yearString);
  const week = Number(weekString);
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const januaryFourthDay = januaryFourth.getUTCDay() || 7;
  const start = new Date(januaryFourth);
  start.setUTCDate(januaryFourth.getUTCDate() - januaryFourthDay + 1 + (week - 1) * 7);
  start.setUTCHours(4, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(4, 0, 0, 0);

  return {
    start: new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 4, 0, 0, 0),
    end: new Date(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 4, 0, 0, 0),
    startLabel: new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 4, 0, 0, 0).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    endLabel: new Date(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 4, 0, 0, 0).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    weekLabel: `S${week}`,
  };
}

function getCurrentFilterSummary(start: Date, end: Date): string {
  const startLabel = start.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const endLabel = end.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${startLabel} - ${endLabel}`;
}

function getActiveTableTitle(activeTable: ActiveTable): string {
  if (activeTable === "charts") {
    return "Graphiques";
  }

   if (activeTable === "leads") {
    return "Candidatures";
  }

  if (activeTable === "merged") {
    return "Tableau fusionne";
  }

  if (activeTable === "monthly") {
    return "Releve mensuel";
  }

  if (activeTable === "uber") {
    return "Revenus Uber";
  }

  return "Tableau detaille";
}

function getActiveTableSubtitle(activeTable: ActiveTable): string {
  if (activeTable === "charts") {
    return "Vue graphique de la semaine selectionnee";
  }

  if (activeTable === "leads") {
    return "Vue complete des reponses envoyees par les candidats";
  }

  if (activeTable === "merged") {
    return "Vue consolidee des chauffeurs sur la selection active";
  }

  if (activeTable === "monthly") {
    return "Vue mensuelle paginee dans la meme zone de travail";
  }

  if (activeTable === "uber") {
    return "Donnees Uber stockees en base apres synchronisation incrementale";
  }

  return "Vue detaillee des revenus dans la meme zone de travail";
}

function formatUberSessionStatus(status: UberSessionStatus["status"]): string {
  if (status === "active") {
    return "Active";
  }

  if (status === "expired") {
    return "Expiree";
  }

  return "Manquante";
}

function uberSessionStatusMessage(status: UberSessionStatus): string {
  if (status.status === "active") {
    return status.orgUuidMasked ? `Org ${status.orgUuidMasked}` : "Session serveur disponible";
  }

  if (status.status === "expired") {
    return "Session Uber expiree. Reconnectez-vous puis relancez la synchronisation.";
  }

  return "Session Uber manquante. Ajoutez le cookie Uber ou identifiez-vous.";
}

function formatShortDateTime(value: string | null): string {
  if (!value) {
    return "Aucune";
  }

  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function splitLeadPlatforms(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatLeadDate(value: string): string {
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
