import fs from "node:fs";
import path from "node:path";

import { prisma } from "@/lib/prisma";

const ACTIVITY_STATUS = "Actif" as const;
const BOLT_CACHE_DIR = path.join(process.cwd(), ".cache");
const BOLT_CACHE_FILE = path.join(BOLT_CACHE_DIR, "bolt-weekly-revenues.json");
const BOLT_STATUS_FILE = path.join(BOLT_CACHE_DIR, "bolt-sync-status.json");

type WeeklyDriverInput = {
  id: number;
  name: string;
  company: string;
  uber: number;
  bolt: number;
  heetch: number;
  location: number;
  acompte: number;
  week: string;
  weekValue: string;
  status: "Actif";
};

export type { WeeklyDriverInput };

type BoltAccessTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

type BoltSyncResult = {
  rows: WeeklyDriverInput[];
  updatedAt: string;
  diagnostics: string[];
};

export type PersistedBoltWeeklyRevenueSnapshot = {
  rows: WeeklyDriverInput[];
  updatedAt: string | null;
};

export type BoltIncrementalSyncResult = {
  ok: true;
  provider: "bolt";
  updatedRows: number;
  totalInCache: number;
  updatedWeeks: string[];
  rangeStart: string;
  rangeEnd: string;
  lastSyncAt: string;
  diagnostics: string[];
};

type TokenCache = {
  value: string;
  expiresAt: number;
};

let boltTokenCache: TokenCache | null = null;

function getEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

function getBoltTokenUrl() {
  return getEnv("BOLT_TOKEN_URL") || "https://oidc.bolt.eu/token";
}

function getBoltApiBaseUrl() {
  return (
    getEnv("BOLT_API_BASE_URL") ||
    "https://node.bolt.eu/fleet-integration-gateway"
  ).replace(/\/$/, "");
}

function getBoltScope() {
  return getEnv("BOLT_API_SCOPE") || "fleet-integration:api";
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;

    if (typeof value === "string") {
      const parsed = Number(value.replace(",", "."));
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}

function isoWeekParts(dateInput: string) {
  const date = new Date(dateInput);
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);

  const year = temp.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((temp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const weekString = String(week).padStart(2, "0");

  return {
    week: `S${week}`,
    weekValue: `${year}-W${weekString}`,
  };
}

async function parseJsonSafe(response: Response) {
  const text = await response.text();

  if (!text.trim()) return null;

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Bolt API returned non-JSON payload (${response.status})`);
  }
}

async function requestBoltAccessToken() {
  const clientId = getEnv("BOLT_CLIENT_ID");
  const clientSecret = getEnv("BOLT_CLIENT_SECRET");

  const form = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: getBoltScope(),
  });

  const response = await fetch(getBoltTokenUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form.toString(),
    cache: "no-store",
  });

  const payload = (await parseJsonSafe(response)) as BoltAccessTokenResponse;

  if (!payload?.access_token) {
    throw new Error("Impossible de récupérer token Bolt");
  }

  boltTokenCache = {
    value: payload.access_token,
    expiresAt: Date.now() + ((payload.expires_in ?? 600) - 30) * 1000,
  };

  return payload.access_token;
}

async function getAccessToken() {
  if (boltTokenCache && boltTokenCache.expiresAt > Date.now()) {
    return boltTokenCache.value;
  }

  return requestBoltAccessToken();
}

async function fetchBoltApi(path: string, body?: unknown) {
  const token = await getAccessToken();

  const response = await fetch(`${getBoltApiBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });

  return parseJsonSafe(response);
}

function getDateChunks(startDate = new Date("2026-01-01T00:00:00Z"), endDate = new Date()) {
  const chunks: Array<{ start_ts: number; end_ts: number }> = [];
  let current = new Date(startDate);

  while (current < endDate) {
    const end = new Date(current);
    end.setDate(end.getDate() + 30);

    chunks.push({
      start_ts: Math.floor(current.getTime() / 1000),
      end_ts: Math.floor(Math.min(end.getTime(), endDate.getTime()) / 1000),
    });

    current = new Date(end);
    current.setSeconds(current.getSeconds() + 1);
  }

  return chunks;
}

function getOrderAmount(order: any) {
  return (
    firstNumber(
      order?.order_price?.net_earnings,
      order?.order_price?.ride_price,
      order?.order_price?.booking_fee,
      order?.order_price?.cancellation_fee,
      order?.order_price?.tip,
      order?.price,
      order?.amount,
      order?.total
    ) ?? 0
  );
}

export async function scrapeBoltWeeklyRevenuesResult(): Promise<BoltSyncResult> {
  const diagnostics: string[] = [];
  const rows = await fetchBoltRowsForChunks(getDateChunks(), diagnostics);

  return {
    rows: await saveAndReturnBoltRows(rows),
    updatedAt: new Date().toISOString(),
    diagnostics,
  };
}

export async function syncBoltLast24hKeepingCache(): Promise<BoltIncrementalSyncResult> {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
  const diagnostics: string[] = [];
  const affectedRanges = getAffectedWeekRanges(startDate, endDate);
  const affectedWeekValues = new Set(affectedRanges.map((range) => range.weekValue));
  const freshRows = await fetchBoltRowsForChunks(
    affectedRanges.flatMap((range) => getDateChunks(range.start, range.end)),
    diagnostics,
  );
  const persistedSnapshot = await loadPersistedBoltWeeklyRevenuesSnapshot();
  const cachedRows = persistedSnapshot.rows.length > 0 ? persistedSnapshot.rows : loadCachedBoltWeeklyRevenues();
  const preservedRows = cachedRows.filter((row) => !affectedWeekValues.has(row.weekValue));
  const mergedRows = reindexRows([...preservedRows, ...freshRows]);
  const lastSyncAt = new Date().toISOString();

  saveBoltRows(mergedRows, {
    state: diagnostics.length > 0 ? "cache" : "live",
    message: diagnostics.length > 0
      ? "Synchro Bolt 24h partielle avec cache conserve."
      : "Synchro Bolt 24h reussie, cache conserve.",
    updatedAt: new Date().toLocaleString("fr-FR"),
  });
  await persistBoltWeeklyRevenueRows(mergedRows);

  return {
    ok: true,
    provider: "bolt",
    updatedRows: freshRows.length,
    totalInCache: mergedRows.length,
    updatedWeeks: [...affectedWeekValues],
    rangeStart: startDate.toISOString(),
    rangeEnd: endDate.toISOString(),
    lastSyncAt,
    diagnostics,
  };
}

export async function scrapeBoltWeeklyRevenues() {
  const result = await scrapeBoltWeeklyRevenuesResult();
  return result.rows;
}

export function loadCachedBoltWeeklyRevenues(): WeeklyDriverInput[] {
  try {
    if (!fs.existsSync(BOLT_CACHE_FILE)) {
      return [];
    }

    const parsed = JSON.parse(fs.readFileSync(BOLT_CACHE_FILE, "utf8"));
    return Array.isArray(parsed) ? (parsed as WeeklyDriverInput[]) : [];
  } catch {
    return [];
  }
}

export function loadCachedBoltStatus(): { updatedAt: string | null; message: string } {
  try {
    if (!fs.existsSync(BOLT_STATUS_FILE)) {
      return {
        updatedAt: null,
        message: "Cache Bolt indisponible.",
      };
    }

    const parsed = JSON.parse(fs.readFileSync(BOLT_STATUS_FILE, "utf8"));
    return {
      updatedAt: typeof parsed?.updatedAt === "string" ? parsed.updatedAt : null,
      message: typeof parsed?.message === "string" ? parsed.message : "Donnees Bolt chargees depuis le cache.",
    };
  } catch {
    return {
      updatedAt: null,
      message: "Cache Bolt illisible.",
    };
  }
}

export async function loadPersistedBoltWeeklyRevenuesSnapshot(): Promise<PersistedBoltWeeklyRevenueSnapshot> {
  try {
    const rows = await prisma.platformWeeklyRevenue.findMany({
      where: {
        platform: "bolt",
        gross: {
          gt: 0,
        },
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
    const updatedAt = rows.reduce<string | null>((latest, row) => {
      const value = row.updatedAt.toISOString();
      return !latest || value > latest ? value : latest;
    }, null);

    return {
      rows: rows.map((row, index) => ({
        id: index + 1,
        name: row.driverName,
        company: row.company,
        uber: 0,
        bolt: round2(row.gross),
        heetch: 0,
        location: 0,
        acompte: 0,
        week: row.week,
        weekValue: row.weekValue,
        status: ACTIVITY_STATUS,
      })),
      updatedAt,
    };
  } catch (error) {
    console.warn("Unable to load Bolt weekly revenues from Prisma.", error);
    return {
      rows: [],
      updatedAt: null,
    };
  }
}

async function saveAndReturnBoltRows(rows: WeeklyDriverInput[]): Promise<WeeklyDriverInput[]> {
  saveBoltRows(rows, {
    state: "live",
    updatedAt: new Date().toLocaleString("fr-FR"),
    message: "Synchro Bolt reussie en direct.",
  });
  await persistBoltWeeklyRevenueRows(rows);

  return rows;
}

async function persistBoltWeeklyRevenueRows(rows: WeeklyDriverInput[]): Promise<void> {
  const groupedRows = groupBoltRowsForPersistence(rows);

  try {
    await prisma.$transaction([
      prisma.platformWeeklyRevenue.deleteMany({
        where: {
          platform: "bolt",
        },
      }),
      ...(groupedRows.length > 0
        ? [
            prisma.platformWeeklyRevenue.createMany({
              data: groupedRows.map((row) => ({
                platform: "bolt",
                driverName: row.driverName,
                driverNameKey: row.driverNameKey,
                company: row.company,
                weekValue: row.weekValue,
                week: row.week,
                gross: row.gross,
                net: row.gross,
                payout: 0,
                adjustments: 0,
                reimbursements: 0,
              })),
            }),
          ]
        : []),
    ]);
  } catch (error) {
    console.warn("Unable to persist Bolt weekly revenues in Prisma.", error);
  }
}

function groupBoltRowsForPersistence(rows: WeeklyDriverInput[]) {
  const groupedRows = new Map<
    string,
    {
      driverName: string;
      driverNameKey: string;
      companyNames: Set<string>;
      weekValue: string;
      week: string;
      gross: number;
    }
  >();

  for (const row of rows) {
    const driverNameKey = normalizeDriverNameKey(row.name);
    const key = `${driverNameKey}::${row.weekValue}`;
    const existing =
      groupedRows.get(key) ??
      {
        driverName: row.name,
        driverNameKey,
        companyNames: new Set<string>(),
        weekValue: row.weekValue,
        week: row.week,
        gross: 0,
      };

    existing.companyNames.add(row.company);
    existing.gross = round2(existing.gross + row.bolt);
    groupedRows.set(key, existing);
  }

  return [...groupedRows.values()]
    .filter((row) => row.gross > 0)
    .map((row) => ({
      driverName: row.driverName,
      driverNameKey: row.driverNameKey,
      company: [...row.companyNames].sort((a, b) => a.localeCompare(b)).join(" + "),
      weekValue: row.weekValue,
      week: row.week,
      gross: row.gross,
    }));
}

async function fetchBoltRowsForChunks(
  chunks: Array<{ start_ts: number; end_ts: number }>,
  diagnostics: string[],
): Promise<WeeklyDriverInput[]> {
  const companiesResponse = await fetch(
    `${getBoltApiBaseUrl()}/fleetIntegration/v1/getCompanies`,
    {
      headers: {
        Authorization: `Bearer ${await getAccessToken()}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );
  const companiesJson = await parseJsonSafe(companiesResponse);
  const companyIds: number[] = companiesJson?.data?.company_ids ?? [];
  const rowsMap = new Map<string, WeeklyDriverInput>();
  let syntheticId = 1;

  for (const companyId of companyIds) {
    for (const chunk of chunks) {
      try {
        const payload = await fetchBoltApi("/fleetIntegration/v1/getFleetOrders", {
          company_ids: [companyId],
          start_ts: chunk.start_ts,
          end_ts: chunk.end_ts,
          limit: 1000,
          offset: 0,
        });
        const orders = payload?.data?.orders ?? [];

        for (const order of orders) {
          const driverName = order?.driver_name ?? "Unknown";
          const companyName = order?.category_info?.name ?? `Bolt Fleet ${companyId}`;
          const amount = getOrderAmount(order);
          const timestamp =
            order?.order_finished_timestamp ??
            order?.order_drop_off_timestamp ??
            order?.order_created_timestamp ??
            Math.floor(Date.now() / 1000);
          const date = new Date(timestamp * 1000).toISOString();
          const { week, weekValue } = isoWeekParts(date);
          const key = `${companyName}-${driverName}-${weekValue}`;

          if (!rowsMap.has(key)) {
            rowsMap.set(key, {
              id: syntheticId++,
              name: driverName,
              company: companyName,
              uber: 0,
              bolt: 0,
              heetch: 0,
              location: 0,
              acompte: 0,
              week,
              weekValue,
              status: ACTIVITY_STATUS,
            });
          }

          const row = rowsMap.get(key)!;
          row.bolt = Number((row.bolt + amount).toFixed(2));
        }

        await new Promise((resolve) => setTimeout(resolve, 600));
      } catch (error) {
        diagnostics.push(String(error));
      }
    }
  }

  return Array.from(rowsMap.values());
}

function getAffectedWeekRanges(startDate: Date, endDate: Date): Array<{ start: Date; end: Date; weekValue: string }> {
  const ranges: Array<{ start: Date; end: Date; weekValue: string }> = [];
  const seen = new Set<string>();
  const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const last = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

  while (cursor <= last) {
    const { weekValue } = isoWeekParts(cursor.toISOString());
    if (!seen.has(weekValue)) {
      const weekStart = getIsoWeekStart(cursor);
      const weekEnd = getIsoWeekEnd(cursor);
      seen.add(weekValue);
      ranges.push({
        start: weekStart,
        end: weekEnd.getTime() < endDate.getTime() ? weekEnd : endDate,
        weekValue,
      });
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return ranges;
}

function getIsoWeekStart(date: Date): Date {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = start.getUTCDay() || 7;
  start.setUTCDate(start.getUTCDate() - day + 1);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

function getIsoWeekEnd(date: Date): Date {
  const end = getIsoWeekStart(date);
  end.setUTCDate(end.getUTCDate() + 7);
  end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);
  return end;
}

function reindexRows(rows: WeeklyDriverInput[]): WeeklyDriverInput[] {
  return rows
    .sort((a, b) => a.weekValue.localeCompare(b.weekValue) || a.name.localeCompare(b.name))
    .map((row, index) => ({
      ...row,
      id: index + 1,
    }));
}

function normalizeDriverNameKey(driverName: string): string {
  return driverName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function saveBoltRows(
  rows: WeeklyDriverInput[],
  status: { state: "live" | "cache" | "fallback"; updatedAt: string; message: string },
): void {
  try {
    fs.mkdirSync(BOLT_CACHE_DIR, { recursive: true });
    fs.writeFileSync(BOLT_CACHE_FILE, JSON.stringify(rows), "utf8");
    fs.writeFileSync(
      BOLT_STATUS_FILE,
      JSON.stringify({
        platform: "bolt",
        state: status.state,
        updatedAt: status.updatedAt,
        message: status.message,
      }),
      "utf8",
    );
  } catch {
    // Cache writes are best effort; live API data can still be returned.
  }
}
