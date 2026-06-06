import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { WeeklyDriverInput } from "@/lib/integrations/bolt-scraper";
import {
  getUberServerSession,
  markUberSessionActive,
  markUberSessionExpired,
  UberSessionExpiredError,
  UberSessionMissingError,
} from "@/lib/integrations/uber-session";

export { UberSessionExpiredError, UberSessionMissingError };

const UBER_GRAPHQL_URL = "https://supplier.uber.com/graphql";
const UBER_COMPANY_LABEL = "Aliroute - Uber";

type UnknownRecord = Record<string, unknown>;

type UberGraphqlPayload = {
  data?: UnknownRecord | null;
  errors?: Array<{ message?: string | null }>;
};

export type UberEarningDto = {
  id: string;
  externalId: string;
  driverName: string;
  revenue: number;
  reimbursements: number;
  adjustments: number;
  payout: number;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  updatedAt: string;
};

export type UberEarningsSummary = {
  totalRevenue: number;
  driversCount: number;
  totalRows: number;
  lastSyncAt: string | null;
};

export type UberEarningsResponse = UberEarningsSummary & {
  earnings: UberEarningDto[];
};

export type UberSyncResult = {
  ok: true;
  provider: "uber";
  imported: number;
  updated: number;
  totalInDb: number;
  lastSyncAt: string;
  rangeStart: string;
  rangeEnd: string;
  daysSynced: number;
};

type ParsedUberEarning = {
  externalId: string;
  driverName: string;
  revenue: number;
  reimbursements: number;
  adjustments: number;
  payout: number;
  periodStart: Date;
  periodEnd: Date;
  raw: Prisma.InputJsonValue;
};

const GET_EARNER_BREAKDOWNS_QUERY = `
  query getEarnerBreakdownsV2(
    $supplierUuid: ID!,
    $timeRange: OneOfTimeRange__Input,
    $driverListOrPageOptions: DriverListOrPagination,
    $driverList: [ID!],
    $pageOptions: PaginationOption__Input,
    $locale: String,
    $excludeAdjustmentItems: Boolean
  ) {
    getEarnerBreakdownsV2(
      supplierUuid: $supplierUuid,
      timeRange: $timeRange,
      driverList: $driverList,
      pageOptions: $pageOptions,
      driverListOrPageOptions: $driverListOrPageOptions,
      locale: $locale,
      excludeAdjustmentItems: $excludeAdjustmentItems
    ) {
      earnerEarningsBreakdowns {
        earnerUuid
        earnerMetadata { name __typename }
        netOutstanding { amountE5 currencyCode __typename }
        earnings {
          localizedCategoryLabel
          categoryName
          amount { amountE5 currencyCode __typename }
          children {
            localizedCategoryLabel
            categoryName
            amount { amountE5 currencyCode __typename }
            children {
              localizedCategoryLabel
              categoryName
              amount { amountE5 currencyCode __typename }
              __typename
            }
            __typename
          }
          __typename
        }
        reimbursements {
          localizedCategoryLabel
          categoryName
          amount { amountE5 currencyCode __typename }
          children {
            localizedCategoryLabel
            categoryName
            amount { amountE5 currencyCode __typename }
            children {
              localizedCategoryLabel
              categoryName
              amount { amountE5 currencyCode __typename }
              __typename
            }
            __typename
          }
          __typename
        }
        payouts {
          localizedCategoryLabel
          categoryName
          amount { amountE5 currencyCode __typename }
          children {
            localizedCategoryLabel
            categoryName
            amount { amountE5 currencyCode __typename }
            __typename
          }
          __typename
        }
        adjustmentsFromPreviousPeriods {
          localizedCategoryLabel
          categoryName
          amount { amountE5 currencyCode __typename }
          children {
            localizedCategoryLabel
            categoryName
            amount { amountE5 currencyCode __typename }
            children {
              localizedCategoryLabel
              categoryName
              amount { amountE5 currencyCode __typename }
              children {
                localizedCategoryLabel
                categoryName
                amount { amountE5 currencyCode __typename }
                __typename
              }
              __typename
            }
            __typename
          }
          __typename
        }
        previousPeriodAdjustmentItems {
          eventTime
          amount { amountE5 currencyCode __typename }
          __typename
        }
        __typename
      }
      pageInfo { nextPageToken __typename }
      __typename
    }
  }
`;

export async function syncUberEarningsLast24h(): Promise<UberSyncResult> {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

  return syncUberEarningsRange(startDate, endDate);
}

export async function syncUberEarningsFrom2026(): Promise<UberSyncResult> {
  return syncUberEarningsRange(new Date(Date.UTC(2026, 0, 1, 0, 0, 0, 0)), new Date());
}

export async function syncUberEarningsRange(startDate: Date, endDate: Date): Promise<UberSyncResult> {
  const session = await getUberServerSession();
  const ranges = splitIntoDailyRanges(startDate, endDate);
  let imported = 0;
  let updated = 0;

  for (const range of ranges) {
    const breakdowns = await fetchUberBreakdowns(range.start, range.end, session);
    const parsedRows = breakdowns
      .map((breakdown) => parseUberBreakdown(breakdown, range.start, range.end))
      .filter((row): row is ParsedUberEarning => Boolean(row));
    const result = await upsertUberEarnings(parsedRows);

    imported += result.imported;
    updated += result.updated;
  }

  await rebuildUberWeeklyRevenueCache();
  await markUberSessionActive();

  return {
    ok: true,
    provider: "uber",
    imported,
    updated,
    totalInDb: await prisma.uberEarning.count(),
    lastSyncAt: new Date().toISOString(),
    rangeStart: startDate.toISOString(),
    rangeEnd: endDate.toISOString(),
    daysSynced: ranges.length,
  };
}

async function fetchUberBreakdowns(
  startDate: Date,
  endDate: Date,
  session: Awaited<ReturnType<typeof getUberServerSession>>,
): Promise<UnknownRecord[]> {
  const rows: UnknownRecord[] = [];
  let pageToken: string | null = null;

  do {
    const response = await fetch(UBER_GRAPHQL_URL, {
      method: "POST",
      headers: {
        accept: "*/*",
        "accept-language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        "content-type": "application/json",
        origin: "https://supplier.uber.com",
        referer: `https://supplier.uber.com/orgs/${session.orgUuid}/earnings`,
        cookie: session.cookie,
        "x-csrf-token": session.csrfToken || "x",
      },
      body: JSON.stringify(buildUberGraphqlBody(startDate, endDate, pageToken, session.orgUuid)),
      cache: "no-store",
    });
    const body = await response.text();

    if (response.status === 401 || response.status === 403 || response.status === 404) {
      await markUberSessionExpired(`Uber GraphQL HTTP ${response.status}`);
      throw new UberSessionExpiredError();
    }

    if (!response.ok) {
      throw new Error(`Uber GraphQL HTTP ${response.status}: ${body.slice(0, 160)}`);
    }

    const payload = parseUberGraphqlPayload(body);
    if (payload.errors?.length) {
      const message = payload.errors.map((error) => error.message).filter(Boolean).join(", ");
      if (isUberSessionErrorMessage(message)) {
        await markUberSessionExpired(message);
        throw new UberSessionExpiredError();
      }

      throw new Error(message || "Uber GraphQL returned an unknown error.");
    }

    rows.push(...extractBreakdownRows(payload));
    pageToken = extractNextPageToken(payload);
  } while (pageToken);

  return rows;
}

function buildUberGraphqlBody(
  startDate: Date,
  endDate: Date,
  pageToken: string | null,
  supplierUuid: string,
): unknown {
  return {
    operationName: "getEarnerBreakdownsV2",
    query: GET_EARNER_BREAKDOWNS_QUERY,
    variables: {
      supplierUuid,
      timeRange: {
        unixMilliOrDate: "Unix_Time_Range",
        startTimeUnixMillis: String(startDate.getTime()),
        endTimeUnixMillis: String(endDate.getTime()),
      },
      driverListOrPageOptions: "Page_Options",
      driverList: null,
      pageOptions: {
        pageSize: 50,
        pageToken,
      },
      locale: "fr-FR",
      excludeAdjustmentItems: false,
    },
  };
}

function parseUberGraphqlPayload(body: string): UberGraphqlPayload {
  try {
    return JSON.parse(body) as UberGraphqlPayload;
  } catch {
    throw new UberSessionExpiredError();
  }
}

function extractBreakdownRows(payload: UberGraphqlPayload): UnknownRecord[] {
  const data = asRecord(payload.data);
  const root = asRecord(data?.getEarnerBreakdownsV2);
  const candidates = [
    root?.earnerEarningsBreakdowns,
    root?.earnerEarningsBreakdown,
    root?.earnerBreakdowns,
    root?.breakdowns,
    root?.items,
    root?.nodes,
  ];

  for (const candidate of candidates) {
    const rows = normalizeRowArray(candidate);
    if (rows.length > 0) {
      return rows;
    }
  }

  return [];
}

function normalizeRowArray(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const record = asRecord(item);
      const node = asRecord(record?.node);
      return node ? [node] : record ? [record] : [];
    });
  }

  const record = asRecord(value);
  if (!record) {
    return [];
  }

  return normalizeRowArray(record.edges ?? record.nodes ?? record.items);
}

function extractNextPageToken(payload: UberGraphqlPayload): string | null {
  const data = asRecord(payload.data);
  const root = asRecord(data?.getEarnerBreakdownsV2);
  const pageInfo = asRecord(root?.pageInfo);
  const token = pageInfo?.nextPageToken ?? pageInfo?.nextCursor ?? root?.nextPageToken;

  return typeof token === "string" && token.length > 0 ? token : null;
}

function parseUberBreakdown(
  breakdown: UnknownRecord,
  periodStart: Date,
  periodEnd: Date,
): ParsedUberEarning | null {
  const metadata = asRecord(breakdown.earnerMetadata);
  const driverName = normalizeWhitespace(
    getString(metadata?.name) ??
      getString(breakdown.driverName) ??
      getString(breakdown.earnerName) ??
      getString(breakdown.name),
  );

  if (!driverName) {
    return null;
  }

  const revenue = firstKnownAmount(
    sumAmountNodes(breakdown.earnings),
    amountFromUnknown(breakdown.netOutstanding),
    amountFromUnknown(breakdown.totalRevenue),
    amountFromUnknown(breakdown.revenue),
  );
  const reimbursements = sumAmountNodes(breakdown.reimbursements);
  const adjustments = round2(
    sumAmountNodes(breakdown.adjustmentsFromPreviousPeriods) +
      sumPreviousAdjustmentItems(breakdown.previousPeriodAdjustmentItems),
  );
  const payout = sumAmountNodes(breakdown.payouts);

  return {
    externalId: `uber-${driverName}-${periodStart.toISOString()}-${periodEnd.toISOString()}`,
    driverName,
    revenue,
    reimbursements,
    adjustments,
    payout,
    periodStart,
    periodEnd,
    raw: sanitizeJson(breakdown),
  };
}

async function upsertUberEarnings(parsedRows: ParsedUberEarning[]): Promise<{ imported: number; updated: number }> {
  if (parsedRows.length === 0) {
    return { imported: 0, updated: 0 };
  }

  const existingRows = await prisma.uberEarning.findMany({
    where: {
      externalId: {
        in: parsedRows.map((row) => row.externalId),
      },
    },
    select: {
      externalId: true,
    },
  });
  const existingExternalIds = new Set(existingRows.map((row) => row.externalId));
  let imported = 0;
  let updated = 0;

  for (const row of parsedRows) {
    const exists = existingExternalIds.has(row.externalId);

    await prisma.uberEarning.upsert({
      where: {
        externalId: row.externalId,
      },
      create: row,
      update: {
        driverName: row.driverName,
        revenue: row.revenue,
        reimbursements: row.reimbursements,
        adjustments: row.adjustments,
        payout: row.payout,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        raw: row.raw,
      },
    });

    if (exists) {
      updated += 1;
    } else {
      imported += 1;
    }
  }

  return { imported, updated };
}

export async function listUberEarnings(): Promise<UberEarningsResponse> {
  const rows = await prisma.uberEarning.findMany({
    orderBy: [
      {
        periodEnd: "desc",
      },
      {
        driverName: "asc",
      },
    ],
  });
  const lastSyncAt = rows.reduce<string | null>((latest, row) => {
    const updatedAt = row.updatedAt.toISOString();
    return !latest || updatedAt > latest ? updatedAt : latest;
  }, null);

  return {
    earnings: rows.map((row) => ({
      id: row.id,
      externalId: row.externalId,
      driverName: row.driverName,
      revenue: round2(row.revenue),
      reimbursements: round2(row.reimbursements),
      adjustments: round2(row.adjustments),
      payout: round2(row.payout),
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    totalRevenue: round2(rows.reduce((total, row) => total + row.revenue, 0)),
    driversCount: new Set(rows.map((row) => normalizeWhitespace(row.driverName))).size,
    totalRows: rows.length,
    lastSyncAt,
  };
}

export async function listUberEarningsAsWeeklyDrivers(): Promise<WeeklyDriverInput[]> {
  const cachedRows = await prisma.platformWeeklyRevenue.findMany({
    where: {
      platform: "uber",
    },
    orderBy: [
      {
        weekValue: "asc",
      },
      {
        driverName: "asc",
      },
    ],
  });

  if (cachedRows.length > 0) {
    return cachedRows.map((row, index) => ({
      id: index + 1,
      name: row.driverName,
      company: row.company,
      uber: round2(row.gross),
      bolt: 0,
      heetch: 0,
      location: 0,
      acompte: 0,
      week: row.week,
      weekValue: row.weekValue,
      status: "Actif",
    }));
  }

  const rows = await prisma.uberEarning.findMany({
    orderBy: {
      periodStart: "asc",
    },
  });
  const groupedRows = new Map<string, WeeklyDriverInput>();
  let syntheticId = 1;

  for (const row of rows) {
    const { week, weekValue } = getIsoWeekInfo(row.periodStart);
    const key = `${normalizeDriverNameKey(row.driverName)}::${weekValue}`;
    const existing = groupedRows.get(key);

    if (!existing) {
      groupedRows.set(key, {
        id: syntheticId++,
        name: row.driverName,
        company: UBER_COMPANY_LABEL,
        uber: round2(row.revenue),
        bolt: 0,
        heetch: 0,
        location: 0,
        acompte: 0,
        week,
        weekValue,
        status: "Actif",
      });
      continue;
    }

    existing.uber = round2(existing.uber + row.revenue);
  }

  return [...groupedRows.values()];
}

async function rebuildUberWeeklyRevenueCache(): Promise<void> {
  const rows = await prisma.uberEarning.findMany({
    orderBy: {
      periodStart: "asc",
    },
  });
  const groupedRows = new Map<
    string,
    {
      driverName: string;
      driverNameKey: string;
      week: string;
      weekValue: string;
      gross: number;
      net: number;
      reimbursements: number;
      adjustments: number;
      payout: number;
    }
  >();

  for (const row of rows) {
    const { week, weekValue } = getIsoWeekInfo(row.periodStart);
    const driverNameKey = normalizeDriverNameKey(row.driverName);
    const key = `${driverNameKey}::${weekValue}`;
    const existing =
      groupedRows.get(key) ??
      {
        driverName: row.driverName,
        driverNameKey,
        week,
        weekValue,
        gross: 0,
        net: 0,
        reimbursements: 0,
        adjustments: 0,
        payout: 0,
      };

    existing.gross = round2(existing.gross + row.revenue);
    existing.reimbursements = round2(existing.reimbursements + row.reimbursements);
    existing.adjustments = round2(existing.adjustments + row.adjustments);
    existing.payout = round2(existing.payout + row.payout);
    existing.net = round2(existing.gross + existing.reimbursements + existing.adjustments);
    groupedRows.set(key, existing);
  }

  for (const row of groupedRows.values()) {
    await prisma.platformWeeklyRevenue.upsert({
      where: {
        platform_driverNameKey_weekValue: {
          platform: "uber",
          driverNameKey: row.driverNameKey,
          weekValue: row.weekValue,
        },
      },
      create: {
        platform: "uber",
        driverName: row.driverName,
        driverNameKey: row.driverNameKey,
        company: UBER_COMPANY_LABEL,
        weekValue: row.weekValue,
        week: row.week,
        gross: row.gross,
        net: row.net,
        payout: row.payout,
        adjustments: row.adjustments,
        reimbursements: row.reimbursements,
      },
      update: {
        driverName: row.driverName,
        company: UBER_COMPANY_LABEL,
        week: row.week,
        gross: row.gross,
        net: row.net,
        payout: row.payout,
        adjustments: row.adjustments,
        reimbursements: row.reimbursements,
      },
    });
  }
}

function sumAmountNodes(value: unknown): number {
  if (Array.isArray(value)) {
    return round2(value.reduce((total, item) => total + sumAmountNode(item), 0));
  }

  return sumAmountNode(value);
}

function sumAmountNode(value: unknown): number {
  const record = asRecord(value);
  if (!record) {
    return amountFromUnknown(value) ?? 0;
  }

  const ownAmount = amountFromUnknown(record.amount) ?? amountFromUnknown(record);
  if (ownAmount !== null) {
    return ownAmount;
  }

  return round2(
    sumAmountNodes(record.children) +
      sumAmountNodes(record.items) +
      sumAmountNodes(record.breakdowns) +
      sumAmountNodes(record.nodes),
  );
}

function sumPreviousAdjustmentItems(value: unknown): number {
  if (!Array.isArray(value)) {
    return 0;
  }

  return round2(value.reduce((total, item) => total + (amountFromUnknown(asRecord(item)?.amount) ?? 0), 0));
}

function amountFromUnknown(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? round2(value) : null;
  }

  if (typeof value === "string") {
    return parseNumericAmount(value);
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const amountE5 = record.amountE5 ?? record.valueE5;
  if (typeof amountE5 === "string" || typeof amountE5 === "number") {
    const parsed = Number(amountE5);
    return Number.isFinite(parsed) ? round2(parsed / 100000) : null;
  }

  for (const key of ["value", "amount", "total", "gross", "net"]) {
    const nested = record[key];
    if (nested === value) {
      continue;
    }

    const parsed = amountFromUnknown(nested);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function parseNumericAmount(value: string): number | null {
  const normalized = value.replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? round2(parsed) : null;
}

function firstKnownAmount(...values: Array<number | null>): number {
  for (const value of values) {
    if (value !== null && value !== 0) {
      return round2(value);
    }
  }

  return 0;
}

function splitIntoDailyRanges(startDate: Date, endDate: Date): Array<{ start: Date; end: Date }> {
  const ranges: Array<{ start: Date; end: Date }> = [];
  const safeStart = new Date(startDate);
  const safeEnd = new Date(endDate);

  if (safeStart.getTime() >= safeEnd.getTime()) {
    return [{ start: safeStart, end: safeEnd }];
  }

  let cursor = new Date(safeStart);
  while (cursor.getTime() < safeEnd.getTime()) {
    const next = new Date(cursor);
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(0, 0, 0, 0);
    const rangeEnd = next.getTime() < safeEnd.getTime() ? next : safeEnd;

    ranges.push({
      start: new Date(cursor),
      end: new Date(rangeEnd),
    });
    cursor = new Date(rangeEnd);
  }

  return ranges;
}

function sanitizeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isUberSessionErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("expired") ||
    normalized.includes("redirected") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden") ||
    normalized.includes("not found") ||
    normalized.includes("session")
  );
}

function getIsoWeekInfo(date: Date): { week: string; weekValue: string } {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);

  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((target.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  const isoYear = target.getUTCFullYear();

  return {
    week: `S${weekNumber}`,
    weekValue: `${isoYear}-W${String(weekNumber).padStart(2, "0")}`,
  };
}

function getString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as UnknownRecord) : null;
}

function normalizeWhitespace(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function normalizeDriverNameKey(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
