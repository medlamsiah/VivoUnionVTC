import type { WeeklyDriverInput } from "@/lib/integrations/bolt-scraper";

export type VivoWeeklyRow = {
  id: number;
  name: string;
  company: string;
  week: string;
  weekValue: string;
  status: "Actif";
  uber: number;
  bolt: number;
  heetch: number;
  freenow: number;
  totalBrut: number;
  vivoRate: number;
  vivoCommission: number;
  totalHorsCharge: number;
  location: number;
  totalApresCharge: number;
  deficitLocation: number;
  retraitDisponible: number;
  acompte: number;
  totalRestant: number;
};

export type VivoMonthlyRow = {
  id: number;
  name: string;
  company: string;
  periodLabel: string;
  monthKey: string;
  weeks: Array<{ label: string; value: number; weekValue: string }>;
  totalCABrut: number;
  montantFichePaie: number;
  chargeFichePaie: number;
  totalNet: number;
  totalPaiementsRecus: number;
  totalRestant: number;
};

export type VivoDashboardData = {
  weeklyRows: VivoWeeklyRow[];
  monthlyRows: VivoMonthlyRow[];
  weekOptions: string[];
  driverOptions: string[];
  companyOptions: string[];
  totalBrut: number;
  totalNet: number;
  totalAcompte: number;
  activeDrivers: number;
};

const DEFAULT_BOLT_COMPANY_OPTIONS = [
  "Aliroute - Paris",
  "Aliroute - Caen",
  "Aliroute - Bordeaux",
  "Aliroute - Toulon",
];

export function buildVivoDashboardData(drivers: WeeklyDriverInput[]): VivoDashboardData {
  const weeklyRows = drivers.map(toWeeklyRow);
  const monthlyRows = buildMonthlyRows(weeklyRows);
  const companyOptions = unique([...DEFAULT_BOLT_COMPANY_OPTIONS, ...weeklyRows.map((row) => row.company)]);

  return {
    weeklyRows,
    monthlyRows,
    weekOptions: unique(weeklyRows.map((row) => row.weekValue)),
    driverOptions: unique(weeklyRows.map((row) => row.name)),
    companyOptions,
    totalBrut: sum(weeklyRows.map((row) => row.totalBrut)),
    totalNet: sum(weeklyRows.map((row) => row.totalApresCharge)),
    totalAcompte: sum(weeklyRows.map((row) => row.acompte)),
    activeDrivers: unique(weeklyRows.map((row) => row.name)).length,
  };
}

function toWeeklyRow(driver: WeeklyDriverInput): VivoWeeklyRow {
  const uber = round2(driver.uber);
  const bolt = round2(driver.bolt);
  const heetch = round2(driver.heetch);
  const freenow = 0;
  const totalBrut = round2(uber + bolt + heetch + freenow);
  const vivoRate = getVivoRate(totalBrut);
  const vivoCommission = round2(totalBrut * vivoRate);
  const totalHorsCharge = round2(totalBrut - vivoCommission);
  const totalApresCharge = round2(totalHorsCharge - driver.location);
  const deficitLocation = round2(Math.max(-totalApresCharge, 0));
  const retraitDisponible = round2(totalApresCharge / 2);
  const totalRestant = round2(retraitDisponible - driver.acompte);

  return {
    id: driver.id,
    name: driver.name,
    company: driver.company,
    week: driver.week,
    weekValue: driver.weekValue,
    status: driver.status,
    uber,
    bolt,
    heetch,
    freenow,
    totalBrut,
    vivoRate,
    vivoCommission,
    totalHorsCharge,
    location: round2(driver.location),
    totalApresCharge,
    deficitLocation,
    retraitDisponible,
    acompte: round2(driver.acompte),
    totalRestant,
  };
}

function buildMonthlyRows(rows: VivoWeeklyRow[]): VivoMonthlyRow[] {
  const groups = new Map<string, VivoWeeklyRow[]>();

  for (const row of rows) {
    const monthKey = getMonthKeyFromWeekValue(row.weekValue);
    const key = `${row.company}::${row.name}::${monthKey}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([key, groupedRows], index) => {
      const [company, name, monthKey] = key.split("::");
      const sortedRows = groupedRows.sort((a, b) => a.weekValue.localeCompare(b.weekValue));
      const totalCABrut = round2(sum(sortedRows.map((row) => row.totalApresCharge)));
      const montantFichePaie = totalCABrut >= 2000 ? 424.9 : round2((totalCABrut / 100) * 21.245);
      const chargeFichePaie = round2((montantFichePaie / 100) * 22);
      const totalNet = round2(totalCABrut - montantFichePaie);
      const totalPaiementsRecus = round2(sum(sortedRows.map((row) => row.acompte)));
      const totalRestant = round2(totalNet - totalPaiementsRecus);

      return {
        id: index + 1,
        name,
        company,
        periodLabel: formatMonthKey(monthKey),
        monthKey,
        weeks: sortedRows.map((row) => ({ label: row.week, value: row.totalApresCharge, weekValue: row.weekValue })),
        totalCABrut,
        montantFichePaie,
        chargeFichePaie,
        totalNet,
        totalPaiementsRecus,
        totalRestant,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
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

function formatMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);

  return date.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

function getMonthKeyFromWeekValue(weekValue: string): string {
  const isoWeekDate = getDateFromIsoWeekValue(weekValue);
  const year = isoWeekDate.getUTCFullYear();
  const month = String(isoWeekDate.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getDateFromIsoWeekValue(weekValue: string): Date {
  const match = weekValue.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    return new Date();
  }

  const [, yearString, weekString] = match;
  const year = Number(yearString);
  const week = Number(weekString);
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const januaryFourthDay = januaryFourth.getUTCDay() || 7;
  const weekStart = new Date(januaryFourth);
  weekStart.setUTCDate(januaryFourth.getUTCDate() - januaryFourthDay + 1 + (week - 1) * 7);
  return weekStart;
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
