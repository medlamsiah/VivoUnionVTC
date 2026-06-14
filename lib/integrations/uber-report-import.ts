import { Prisma } from "@prisma/client";
import Papa from "papaparse";
import * as XLSX from "xlsx";

import { prisma } from "../prisma";

const UBER_COMPANY_LABEL = "Aliroute - Uber";

type ImportColumnKey =
  | "driverName"
  | "driverFirstName"
  | "driverLastName"
  | "totalRevenue"
  | "reimbursements"
  | "adjustments"
  | "payout"
  | "netRevenue"
  | "periodStart"
  | "periodEnd"
  | "weekValue"
  | "activityTrips"
  | "activityOnlineTime"
  | "activityTripTime";

type DetectedColumns = Partial<Record<ImportColumnKey, number>>;

type ParsedReportRow = {
  sourceRow: number;
  driverName: string;
  totalRevenue: number;
  reimbursements: number;
  adjustments: number;
  payout: number;
  netRevenue: number;
  week: string;
  weekValue: string;
  periodStart: Date;
  periodEnd: Date;
  raw: Record<string, unknown>;
};

type ExistingDriver = {
  driverName: string;
  driverNameKey: string;
};

export type UberReportImportSummary = {
  ok: true;
  provider: "uber";
  imported: number;
  updated: number;
  rowsRead: number;
  matchedDrivers: string[];
  unmatchedDrivers: string[];
  errors: string[];
};

export async function importUberSupplierReport(input: {
  filename: string;
  contentType: string;
  buffer: Buffer;
}): Promise<UberReportImportSummary> {
  const matrix = parseReportMatrix(input);
  const { headers, rows, headerIndex, columns } = detectReportTable(matrix);
  const filenamePeriod = parsePeriodFromFilename(input.filename);
  const existingDrivers = await listExistingDrivers();
  const errors: string[] = [];
  const parsedRows: ParsedReportRow[] = [];
  const unmatchedDrivers = new Set<string>();
  const matchedDrivers = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const sourceRow = headerIndex + index + 2;
    let parsedRow: ParsedReportRow | null = null;

    try {
      parsedRow = parseReportRow(row, headers, columns, sourceRow, filenamePeriod);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `Ligne ${sourceRow}: lecture impossible.`);
      continue;
    }

    if (!parsedRow) {
      continue;
    }

    const matchedDriver = matchExistingDriver(parsedRow.driverName, existingDrivers);
    if (!matchedDriver) {
      unmatchedDrivers.add(parsedRow.driverName);
      continue;
    }

    if (parsedRow.totalRevenue <= 0 && parsedRow.netRevenue <= 0) {
      errors.push(`Ligne ${sourceRow}: revenu Uber nul pour ${parsedRow.driverName}.`);
      continue;
    }

    parsedRows.push({
      ...parsedRow,
      driverName: matchedDriver.driverName,
      raw: {
        ...parsedRow.raw,
        originalDriverName: parsedRow.driverName,
        matchedDriverName: matchedDriver.driverName,
      },
    });
    matchedDrivers.add(matchedDriver.driverName);
  }

  const result = await upsertImportedUberRows(parsedRows);

  return {
    ok: true,
    provider: "uber",
    imported: result.imported,
    updated: result.updated,
    rowsRead: rows.length,
    matchedDrivers: [...matchedDrivers].sort((a, b) => a.localeCompare(b)),
    unmatchedDrivers: [...unmatchedDrivers].sort((a, b) => a.localeCompare(b)),
    errors,
  };
}

function parseReportMatrix(input: { filename: string; contentType: string; buffer: Buffer }): unknown[][] {
  const extension = input.filename.split(".").pop()?.toLowerCase() ?? "";

  if (extension === "csv" || input.contentType.includes("csv")) {
    const text = input.buffer.toString("utf8").replace(/^\uFEFF/, "");
    const parsed = Papa.parse<unknown[]>(text, {
      skipEmptyLines: "greedy",
    });

    return parsed.data;
  }

  if (["xlsx", "xls"].includes(extension) || input.contentType.includes("spreadsheet") || input.contentType.includes("excel")) {
    const workbook = XLSX.read(input.buffer, {
      type: "buffer",
      cellDates: true,
    });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error("Le fichier Excel ne contient aucune feuille.");
    }

    return XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      raw: true,
      blankrows: false,
    });
  }

  throw new Error("Format non supporte. Importez un fichier CSV, XLS ou XLSX.");
}

function detectReportTable(matrix: unknown[][]): {
  headers: string[];
  rows: unknown[][];
  headerIndex: number;
  columns: DetectedColumns;
} {
  let bestMatch: { index: number; headers: string[]; columns: DetectedColumns; score: number } | null = null;

  for (let index = 0; index < Math.min(matrix.length, 20); index += 1) {
    const headers = matrix[index].map((value) => normalizeHeader(String(value ?? "")));
    const columns = detectColumns(headers);
    const score =
      (columns.driverName !== undefined ? 5 : 0) +
      (columns.driverFirstName !== undefined && columns.driverLastName !== undefined ? 5 : 0) +
      (columns.totalRevenue !== undefined ? 4 : 0) +
      (columns.netRevenue !== undefined ? 2 : 0) +
      (columns.reimbursements !== undefined ? 1 : 0) +
      (columns.adjustments !== undefined ? 1 : 0) +
      (columns.payout !== undefined ? 1 : 0) +
      (columns.periodStart !== undefined || columns.periodEnd !== undefined || columns.weekValue !== undefined ? 2 : 0);

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { index, headers, columns, score };
    }
  }

  if (
    !bestMatch ||
    (bestMatch.columns.driverName === undefined &&
      (bestMatch.columns.driverFirstName === undefined || bestMatch.columns.driverLastName === undefined))
  ) {
    throw new Error("Colonne chauffeur introuvable dans le rapport Uber.");
  }

  if (bestMatch.columns.totalRevenue === undefined && bestMatch.columns.netRevenue === undefined) {
    if (isDriverActivityReport(bestMatch.columns)) {
      throw new Error(
        "Ce fichier est un rapport d'activite Uber (courses/temps en ligne), pas un rapport de revenus. Telechargez le rapport revenus/paiements depuis Uber Supplier pour remplir la colonne Uber.",
      );
    }

    throw new Error("Colonne revenus totaux ou revenus nets introuvable dans le rapport Uber.");
  }

  return {
    headers: bestMatch.headers,
    rows: matrix.slice(bestMatch.index + 1).filter((row) => row.some((value) => String(value ?? "").trim().length > 0)),
    headerIndex: bestMatch.index,
    columns: bestMatch.columns,
  };
}

function detectColumns(headers: string[]): DetectedColumns {
  return {
    driverName: findColumn(headers, [
      "nom complet du chauffeur",
      "nom complet",
      "chauffeur nom complet",
      "nom du chauffeur",
      "nom",
      "name",
      "driver name",
      "driver full name",
      "earner name",
      "partner name",
    ]),
    driverFirstName: findColumn(headers, [
      "prenom du chauffeur",
      "prenom",
      "driver first name",
      "first name",
      "firstname",
    ]),
    driverLastName: findColumn(headers, [
      "nom du chauffeur",
      "nom de famille",
      "driver last name",
      "last name",
      "lastname",
    ]),
    totalRevenue: findColumn(headers, [
      "revenus totaux",
      "total des revenus",
      "revenu total",
      "total revenue",
      "total revenues",
      "total earnings",
      "gross earnings",
      "earnings",
      "chiffre affaires",
    ]),
    reimbursements: findColumn(headers, [
      "remboursements et notes de frais",
      "remboursements",
      "notes de frais",
      "reimbursements",
      "expenses",
      "expense reimbursements",
    ]),
    adjustments: findColumn(headers, ["ajustements", "adjustments", "adjustment"]),
    payout: findColumn(headers, ["versement", "versements", "payout", "payouts", "paiement", "payments"]),
    netRevenue: findColumn(headers, [
      "revenus nets",
      "revenu net",
      "net revenue",
      "net revenues",
      "net earnings",
      "net outstanding",
      "net",
    ]),
    periodStart: findColumn(headers, ["date de debut", "debut periode", "period start", "start date", "from"]),
    periodEnd: findColumn(headers, ["date de fin", "fin periode", "period end", "end date", "to"]),
    weekValue: findColumn(headers, ["semaine", "week", "week value", "periode", "period"]),
    activityTrips: findColumn(headers, ["courses effectuees", "completed trips", "trips completed"]),
    activityOnlineTime: findColumn(headers, ["temps passe en ligne", "online time"]),
    activityTripTime: findColumn(headers, ["temps passe a effectuer des courses", "time on trip", "trip time"]),
  };
}

function findColumn(headers: string[], aliases: string[]): number | undefined {
  const normalizedAliases = aliases.map(normalizeHeader);
  const exactIndex = headers.findIndex((header) => normalizedAliases.includes(header));
  if (exactIndex >= 0) {
    return exactIndex;
  }

  const partialIndex = headers.findIndex((header) =>
    normalizedAliases.some((alias) => alias.length >= 4 && header.includes(alias)),
  );

  return partialIndex >= 0 ? partialIndex : undefined;
}

function isDriverActivityReport(columns: DetectedColumns): boolean {
  return (
    columns.activityTrips !== undefined ||
    columns.activityOnlineTime !== undefined ||
    columns.activityTripTime !== undefined
  );
}

function parseReportRow(
  row: unknown[],
  headers: string[],
  columns: DetectedColumns,
  sourceRow: number,
  fallbackPeriod: { start: Date; end: Date } | null,
): ParsedReportRow | null {
  const driverName = getDriverName(row, columns);
  if (!driverName) {
    return null;
  }

  const period = resolveReportPeriod(row, columns, fallbackPeriod);
  if (!period) {
    throw new Error(`Ligne ${sourceRow}: semaine introuvable pour ${driverName}.`);
  }

  const totalRevenue =
    parseAmountValue(row[columns.totalRevenue ?? -1]) ??
    parseAmountValue(row[columns.netRevenue ?? -1]) ??
    0;
  const reimbursements = parseAmountValue(row[columns.reimbursements ?? -1]) ?? 0;
  const adjustments = parseAmountValue(row[columns.adjustments ?? -1]) ?? 0;
  const payout = parseAmountValue(row[columns.payout ?? -1]) ?? 0;
  const netRevenue =
    parseAmountValue(row[columns.netRevenue ?? -1]) ??
    round2(totalRevenue + reimbursements + adjustments);
  const raw = Object.fromEntries(headers.map((header, index) => [header || `col_${index + 1}`, serializeCell(row[index])]));

  return {
    sourceRow,
    driverName,
    totalRevenue: round2(totalRevenue),
    reimbursements: round2(reimbursements),
    adjustments: round2(adjustments),
    payout: round2(payout),
    netRevenue: round2(netRevenue),
    week: period.week,
    weekValue: period.weekValue,
    periodStart: period.start,
    periodEnd: period.end,
    raw,
  };
}

function getDriverName(row: unknown[], columns: DetectedColumns): string {
  const firstName = getCell(row, columns.driverFirstName);
  const lastName = getCell(row, columns.driverLastName);
  const fullName = getCell(row, columns.driverName);

  if (firstName && lastName) {
    return normalizeDisplayName(`${firstName} ${lastName}`);
  }

  return normalizeDisplayName(fullName || lastName || firstName);
}

function resolveReportPeriod(
  row: unknown[],
  columns: DetectedColumns,
  fallbackPeriod: { start: Date; end: Date } | null,
): { week: string; weekValue: string; start: Date; end: Date } | null {
  const startDate = parseDateValue(row[columns.periodStart ?? -1]);
  const endDate = parseDateValue(row[columns.periodEnd ?? -1]);
  const fallbackReferenceDate = fallbackPeriod?.end ?? new Date();
  const weekFromCell = parseWeekValue(getCell(row, columns.weekValue), startDate ?? endDate ?? fallbackReferenceDate);
  const referenceDate = endDate ?? startDate ?? fallbackPeriod?.end;

  if (weekFromCell) {
    const range = getDateRangeFromIsoWeekValue(weekFromCell.weekValue);
    return {
      week: weekFromCell.week,
      weekValue: weekFromCell.weekValue,
      start: startDate ?? fallbackPeriod?.start ?? range.start,
      end: endDate ?? fallbackPeriod?.end ?? range.end,
    };
  }

  if (referenceDate) {
    const weekInfo = getIsoWeekInfo(referenceDate);
    const range = getDateRangeFromIsoWeekValue(weekInfo.weekValue);
    return {
      ...weekInfo,
      start: startDate ?? range.start,
      end: endDate ?? range.end,
    };
  }

  return null;
}

function parsePeriodFromFilename(filename: string): { start: Date; end: Date } | null {
  const match = filename.match(/(\d{4})(\d{2})(\d{2})-(\d{4})(\d{2})(\d{2})/);
  if (!match) {
    return null;
  }

  const [, startYear, startMonth, startDay, endYear, endMonth, endDay] = match;
  const start = new Date(Date.UTC(Number(startYear), Number(startMonth) - 1, Number(startDay), 0, 0, 0, 0));
  const end = new Date(Date.UTC(Number(endYear), Number(endMonth) - 1, Number(endDay), 23, 59, 59, 999));

  return Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) ? { start, end } : null;
}

async function listExistingDrivers(): Promise<ExistingDriver[]> {
  const [revenueRows, settingRows] = await Promise.all([
    prisma.platformWeeklyRevenue.findMany({
      select: {
        driverName: true,
        driverNameKey: true,
      },
    }),
    prisma.driverWeeklySetting.findMany({
      select: {
        driverName: true,
        driverNameKey: true,
      },
    }),
  ]);
  const drivers = new Map<string, ExistingDriver>();

  for (const row of [...revenueRows, ...settingRows]) {
    const key = normalizeDriverNameKey(row.driverNameKey || row.driverName);
    if (!drivers.has(key)) {
      drivers.set(key, {
        driverName: row.driverName,
        driverNameKey: key,
      });
    }
  }

  return [...drivers.values()];
}

function matchExistingDriver(driverName: string, existingDrivers: ExistingDriver[]): ExistingDriver | null {
  const key = normalizeDriverNameKey(driverName);
  const tokenKey = normalizeDriverTokenKey(driverName);

  return (
    existingDrivers.find((driver) => driver.driverNameKey === key) ??
    existingDrivers.find((driver) => normalizeDriverTokenKey(driver.driverName) === tokenKey) ??
    null
  );
}

async function upsertImportedUberRows(rows: ParsedReportRow[]): Promise<{ imported: number; updated: number }> {
  if (rows.length === 0) {
    return {
      imported: 0,
      updated: 0,
    };
  }

  const keys = rows.map((row) => ({
    driverNameKey: normalizeDriverNameKey(row.driverName),
    weekValue: row.weekValue,
  }));
  const existingRows = await prisma.platformWeeklyRevenue.findMany({
    where: {
      platform: "uber",
      OR: keys,
    },
    select: {
      driverNameKey: true,
      weekValue: true,
    },
  });
  const existingKeys = new Set(existingRows.map((row) => `${row.driverNameKey}::${row.weekValue}`));
  let imported = 0;
  let updated = 0;

  for (const row of rows) {
    const driverNameKey = normalizeDriverNameKey(row.driverName);
    const uniqueKey = `${driverNameKey}::${row.weekValue}`;
    const externalId = `uber-report-${driverNameKey}-${row.weekValue}`;
    const raw = sanitizeJson({
      source: "UBER_SUPPLIER_REPORT",
      sourceRow: row.sourceRow,
      ...row.raw,
    });

    await prisma.$transaction([
      prisma.platformWeeklyRevenue.upsert({
        where: {
          platform_driverNameKey_weekValue: {
            platform: "uber",
            driverNameKey,
            weekValue: row.weekValue,
          },
        },
        create: {
          platform: "uber",
          driverName: row.driverName,
          driverNameKey,
          company: UBER_COMPANY_LABEL,
          weekValue: row.weekValue,
          week: row.week,
          gross: row.totalRevenue,
          net: row.netRevenue,
          payout: row.payout,
          adjustments: row.adjustments,
          reimbursements: row.reimbursements,
        },
        update: {
          driverName: row.driverName,
          company: UBER_COMPANY_LABEL,
          week: row.week,
          gross: row.totalRevenue,
          net: row.netRevenue,
          payout: row.payout,
          adjustments: row.adjustments,
          reimbursements: row.reimbursements,
        },
      }),
      prisma.uberEarning.upsert({
        where: {
          externalId,
        },
        create: {
          externalId,
          driverName: row.driverName,
          revenue: row.totalRevenue,
          reimbursements: row.reimbursements,
          adjustments: row.adjustments,
          payout: row.payout,
          periodStart: row.periodStart,
          periodEnd: row.periodEnd,
          raw,
        },
        update: {
          driverName: row.driverName,
          revenue: row.totalRevenue,
          reimbursements: row.reimbursements,
          adjustments: row.adjustments,
          payout: row.payout,
          periodStart: row.periodStart,
          periodEnd: row.periodEnd,
          raw,
        },
      }),
    ]);

    if (existingKeys.has(uniqueKey)) {
      updated += 1;
    } else {
      imported += 1;
    }
  }

  return { imported, updated };
}

function getCell(row: unknown[], index: number | undefined): string {
  if (index === undefined) {
    return "";
  }

  return String(row[index] ?? "").trim();
}

function parseAmountValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }

  const isNegative = text.includes("(") && text.includes(")") || text.trim().startsWith("-");
  let normalized = text
    .replace(/\((.*)\)/, "$1")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!normalized) {
    return null;
  }

  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  if (lastComma > lastDot) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = normalized.replace(/,/g, "");
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return isNegative ? -Math.abs(parsed) : parsed;
}

function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + value * 86_400_000);
  }

  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }

  const isoDate = new Date(text);
  if (Number.isFinite(isoDate.getTime())) {
    return isoDate;
  }

  const frenchDate = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (frenchDate) {
    const [, day, month, year] = frenchDate;
    const fullYear = Number(year.length === 2 ? `20${year}` : year);
    const parsed = new Date(Date.UTC(fullYear, Number(month) - 1, Number(day)));
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }

  return null;
}

function parseWeekValue(value: string, fallbackDate: Date): { week: string; weekValue: string } | null {
  const normalized = normalizeHeader(value);
  const isoMatch = normalized.match(/(\d{4})\s*w\s*(\d{1,2})/);
  if (isoMatch) {
    const [, year, week] = isoMatch;
    const weekNumber = Number(week);
    return {
      week: `S${weekNumber}`,
      weekValue: `${year}-W${String(weekNumber).padStart(2, "0")}`,
    };
  }

  const shortMatch = normalized.match(/(?:s|w|week|semaine)\s*(\d{1,2})/);
  if (shortMatch) {
    const weekNumber = Number(shortMatch[1]);
    const year = fallbackDate.getUTCFullYear();
    return {
      week: `S${weekNumber}`,
      weekValue: `${year}-W${String(weekNumber).padStart(2, "0")}`,
    };
  }

  return null;
}

function getIsoWeekInfo(date: Date): { week: string; weekValue: string } {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);

  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((target.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);

  return {
    week: `S${weekNumber}`,
    weekValue: `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`,
  };
}

function getDateRangeFromIsoWeekValue(weekValue: string): { start: Date; end: Date } {
  const match = weekValue.match(/^(\d{4})-W(\d{2})$/);
  const year = match ? Number(match[1]) : new Date().getUTCFullYear();
  const week = match ? Number(match[2]) : 1;
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const day = januaryFourth.getUTCDay() || 7;
  const start = new Date(januaryFourth);
  start.setUTCDate(januaryFourth.getUTCDate() - day + 1 + (week - 1) * 7);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);

  return { start, end };
}

function normalizeHeader(value: string): string {
  return normalizePlainText(value).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function normalizeDriverNameKey(value: string): string {
  return normalizePlainText(value).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function normalizeDriverTokenKey(value: string): string {
  return normalizeDriverNameKey(value).split(" ").filter(Boolean).sort((a, b) => a.localeCompare(b)).join(" ");
}

function normalizeDisplayName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizePlainText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function serializeCell(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

function sanitizeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
