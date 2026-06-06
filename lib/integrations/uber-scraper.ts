import fs from "node:fs";
import path from "node:path";

import { chromium, type Page } from "playwright";
import type { WeeklyDriverInput } from "@/lib/integrations/bolt-scraper";
import { saveUberSession } from "@/lib/integrations/uber-session";

type ScrapedUberDriverRow = {
  name: string;
  company: string;
  uber: number;
  week: string;
  weekValue: string;
};

type UberGraphqlResponse = {
  data?: {
    getEarnerBreakdownsV2?: {
      earnerEarningsBreakdowns?: UberEarnerBreakdown[];
      pageInfo?: {
        nextPageToken?: string | null;
      };
    };
  };
  errors?: Array<{ message?: string }>;
};

type UberEarnerBreakdown = {
  earnerMetadata?: {
    name?: string | null;
  };
  netOutstanding?: {
    amountE5?: string | null;
  };
};

const DEFAULT_LOCATION_AMOUNT = 0;
const DEFAULT_ACOMPTE_AMOUNT = 0;
const UBER_GRAPHQL_URL = "https://supplier.uber.com/graphql";
const DEFAULT_UBER_SUPPLIER_UUID = "20a91cc4-45d1-4fde-b11a-d05be3ac481a";
const UBER_X_CSRF_TOKEN = getEnvValue("UBER_X_CSRF_TOKEN") || "x";
const UBER_COMPANY_LABEL = "Aliroute - Uber";
const UBER_CACHE_DIR = path.join(process.cwd(), ".cache");
const UBER_CACHE_FILE = path.join(UBER_CACHE_DIR, "uber-weekly-revenues.json");
const UBER_SESSION_FILE = path.join(UBER_CACHE_DIR, "uber-session-cookie.txt");
const UBER_STORAGE_STATE_FILE = path.join(UBER_CACHE_DIR, "uber-storage-state.json");
const UBER_SUPPLIER_UUID_FILE = path.join(UBER_CACHE_DIR, "uber-supplier-uuid.txt");
const UBER_STATUS_FILE = path.join(UBER_CACHE_DIR, "uber-sync-status.json");

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
        earnerMetadata {
          pictureUrl
          name
          __typename
        }
        tripInfos {
          tripAttributeName
          value
          __typename
        }
        netOutstanding {
          amountE5
          currencyCode
          __typename
        }
        earnings {
          localizedCategoryLabel
          categoryName
          amount {
            amountE5
            currencyCode
            __typename
          }
          children {
            localizedCategoryLabel
            categoryName
            amount {
              amountE5
              currencyCode
              __typename
            }
            children {
              localizedCategoryLabel
              categoryName
              amount {
                amountE5
                currencyCode
                __typename
              }
              __typename
            }
            __typename
          }
          __typename
        }
        reimbursements {
          localizedCategoryLabel
          categoryName
          amount {
            amountE5
            currencyCode
            __typename
          }
          children {
            localizedCategoryLabel
            categoryName
            amount {
              amountE5
              currencyCode
              __typename
            }
            children {
              localizedCategoryLabel
              categoryName
              amount {
                amountE5
                currencyCode
                __typename
              }
              __typename
            }
            __typename
          }
          __typename
        }
        payouts {
          localizedCategoryLabel
          categoryName
          amount {
            amountE5
            currencyCode
            __typename
          }
          children {
            localizedCategoryLabel
            categoryName
            amount {
              amountE5
              currencyCode
              __typename
            }
            __typename
          }
          __typename
        }
        adjustmentsFromPreviousPeriods {
          localizedCategoryLabel
          categoryName
          amount {
            amountE5
            currencyCode
            __typename
          }
          children {
            localizedCategoryLabel
            categoryName
            amount {
              amountE5
              currencyCode
              __typename
            }
            children {
              localizedCategoryLabel
              categoryName
              amount {
                amountE5
                currencyCode
                __typename
              }
              children {
                localizedCategoryLabel
                categoryName
                amount {
                  amountE5
                  currencyCode
                  __typename
                }
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
          amount {
            amountE5
            currencyCode
            __typename
          }
          __typename
        }
        __typename
      }
      pageInfo {
        nextPageToken
        __typename
      }
      __typename
    }
  }
`;

export async function scrapeUberWeeklyRevenues(): Promise<WeeklyDriverInput[]> {
  let cookieHeader = await resolveUberCookieHeader();

  if (!cookieHeader) {
    console.warn("Uber session is missing in environment variables and no automatic login succeeded.");
    savePlatformStatus("fallback", "Session Uber indisponible. Aucune reconnexion automatique n'a fonctionne.");
    return loadCachedUberDrivers();
  }

  try {
    return await runUberSync(cookieHeader);
  } catch (error) {
    if (isUberSessionError(error)) {
      console.warn("Uber session appears expired. Trying automatic re-login.");
      const refreshedCookie = await loginAndCaptureUberCookie();
      if (refreshedCookie) {
        cookieHeader = refreshedCookie;

        try {
          return await runUberSync(cookieHeader);
        } catch (retryError) {
          console.warn("Uber scraping still failed after automatic re-login. Returning cached data when available.", retryError);
          savePlatformStatus("cache", "Session Uber invalide. Derniere synchro chargee depuis le cache.");
          return loadCachedUberDrivers();
        }
      }
    }

    console.warn("Uber scraping failed, returning cached data when available.", error);
    savePlatformStatus("cache", "Synchro Uber indisponible. Derniere synchro chargee depuis le cache.");
    return loadCachedUberDrivers();
  }
}

export async function reconnectUberSession(): Promise<boolean> {
  const cookieHeader = await loginAndCaptureUberCookie();

  if (!cookieHeader) {
    savePlatformStatus("fallback", "Reconnexion Uber automatique echouee. Verifie les identifiants serveur.");
    return false;
  }

  savePlatformStatus("cache", "Session Uber recapturee cote serveur. Lance une verification live pour confirmer la synchro.");
  return true;
}

async function runUberSync(cookieHeader: string): Promise<WeeklyDriverInput[]> {
  const rows: ScrapedUberDriverRow[] = [];

  for (const range of getCurrentMonthWeekRanges(new Date())) {
    const weeklyRows = await fetchUberWeek(range.startDate, range.endDate, range.week, range.weekValue, cookieHeader);
    rows.push(...weeklyRows);
  }

  const dedupedRows = dedupeRows(rows);
  console.log(`Uber chauffeurs recuperes: ${dedupedRows.length}`);
  const drivers = buildWeeklyDrivers(dedupedRows);
  saveCachedUberDrivers(drivers);
  savePlatformStatus("live", "Synchro Uber reussie en direct.");
  return drivers;
}

async function fetchUberWeek(
  startDate: string,
  endDate: string,
  week: string,
  weekValue: string,
  cookieHeader: string,
): Promise<ScrapedUberDriverRow[]> {
  const rows: ScrapedUberDriverRow[] = [];
  let pageToken: string | null = null;
  const supplierUuid = resolveUberSupplierUuid();

  do {
    const response = await fetch(UBER_GRAPHQL_URL, {
      method: "POST",
      headers: {
        accept: "*/*",
        "accept-language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        "content-type": "application/json",
        origin: "https://supplier.uber.com",
        referer: getUberEarningsUrl(supplierUuid),
        cookie: cookieHeader,
        "x-csrf-token": UBER_X_CSRF_TOKEN,
      },
      body: JSON.stringify({
        operationName: "getEarnerBreakdownsV2",
        query: GET_EARNER_BREAKDOWNS_QUERY,
        variables: {
          supplierUuid,
          timeRange: {
            unixMilliOrDate: "Unix_Time_Range",
            startTimeUnixMillis: String(new Date(`${startDate}T00:00:00.000Z`).getTime()),
            endTimeUnixMillis: String(new Date(`${endDate}T23:59:59.999Z`).getTime()),
          },
          driverListOrPageOptions: "Page_Options",
          driverList: null,
          pageOptions: {
            pageSize: 10,
            pageToken,
          },
          excludeAdjustmentItems: true,
        },
      }),
    });

    const rawBody = await response.text();
    if (!response.ok) {
      throw new Error(`Uber GraphQL HTTP ${response.status}: ${rawBody.slice(0, 160)}`);
    }

    let payload: UberGraphqlResponse;
    try {
      payload = JSON.parse(rawBody) as UberGraphqlResponse;
    } catch {
      throw new Error(`Uber session appears expired or redirected. Response starts with: ${rawBody.slice(0, 160)}`);
    }

    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message).filter(Boolean).join(", "));
    }

    const breakdowns = payload.data?.getEarnerBreakdownsV2?.earnerEarningsBreakdowns ?? [];
    for (const breakdown of breakdowns) {
      const name = normalizeWhitespace(breakdown.earnerMetadata?.name);
      const uber = parseAmountE5(breakdown.netOutstanding?.amountE5);

      if (!name || uber === null) {
        continue;
      }

      rows.push({
        name,
        company: UBER_COMPANY_LABEL,
        uber,
        week,
        weekValue,
      });
    }

    pageToken = payload.data?.getEarnerBreakdownsV2?.pageInfo?.nextPageToken ?? null;
  } while (pageToken);

  return rows;
}

function buildWeeklyDrivers(rows: ScrapedUberDriverRow[]): WeeklyDriverInput[] {
  return rows.map((row, index) => ({
    id: index + 1,
    name: row.name,
    company: row.company,
    uber: row.uber,
    bolt: 0,
    heetch: 0,
    location: DEFAULT_LOCATION_AMOUNT,
    acompte: DEFAULT_ACOMPTE_AMOUNT,
    week: row.week,
    weekValue: row.weekValue,
    status: "Actif",
  }));
}

function dedupeRows(rows: ScrapedUberDriverRow[]): ScrapedUberDriverRow[] {
  const merged = new Map<string, ScrapedUberDriverRow>();

  for (const row of rows) {
    const key = `${row.company.toLowerCase()}::${row.name.toLowerCase()}::${row.weekValue}`;
    const existing = merged.get(key);
    merged.set(key, {
      ...row,
      uber: round2((existing?.uber ?? 0) + row.uber),
    });
  }

  return [...merged.values()];
}

function parseAmountE5(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return round2(parsed / 100000);
}

function getCurrentMonthWeekRanges(date: Date): Array<{
  startDate: string;
  endDate: string;
  week: string;
  weekValue: string;
}> {
  const currentDay = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const firstDayOfMonth = new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1));
  const ranges: Array<{ startDate: string; endDate: string; week: string; weekValue: string }> = [];

  let cursor = new Date(firstDayOfMonth);

  while (cursor <= currentDay) {
    const weekStart = new Date(cursor);
    const dayOfWeek = weekStart.getUTCDay() || 7;
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + (7 - dayOfWeek));

    const boundedEnd = weekEnd > currentDay ? currentDay : weekEnd;
    const { week, weekValue } = getIsoWeekInfo(weekStart);

    ranges.push({
      startDate: formatIsoDate(weekStart),
      endDate: formatIsoDate(boundedEnd),
      week,
      weekValue,
    });

    cursor = new Date(boundedEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return ranges;
}

function getIsoWeekInfo(date: Date): { week: string; weekValue: string } {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);

  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((target.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  const isoYear = target.getUTCFullYear();
  const paddedWeek = String(weekNumber).padStart(2, "0");

  return {
    week: `S${weekNumber}`,
    weekValue: `${isoYear}-W${paddedWeek}`,
  };
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeWhitespace(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function getEnvValue(key: string): string | null {
  const directValue = process.env[key]?.trim();
  if (directValue) {
    return directValue;
  }

  const envLocalPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envLocalPath)) {
    return null;
  }

  const content = fs.readFileSync(envLocalPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    const envKey = trimmed.slice(0, separatorIndex).trim();
    if (envKey !== key) {
      continue;
    }

    return trimmed.slice(separatorIndex + 1).trim();
  }

  return null;
}

export function resolveUberSupplierUuid(): string {
  const cachedUuid = loadCachedSupplierUuid();
  if (cachedUuid) {
    return cachedUuid;
  }

  return getEnvValue("UBER_SUPPLIER_UUID") || DEFAULT_UBER_SUPPLIER_UUID;
}

function getUberEarningsUrl(supplierUuid = resolveUberSupplierUuid()): string {
  return `https://supplier.uber.com/orgs/${supplierUuid}/earnings`;
}

async function captureAndSaveSupplierUuid(page: Page): Promise<string | null> {
  const uuidFromUrl = extractSupplierUuid(page.url());
  if (uuidFromUrl) {
    saveCachedSupplierUuid(uuidFromUrl);
    return uuidFromUrl;
  }

  const uuidFromPage = await page
    .locator('a[href*="/orgs/"]')
    .first()
    .getAttribute("href", { timeout: 5_000 })
    .then((href) => extractSupplierUuid(href ?? ""))
    .catch(() => null);

  if (uuidFromPage) {
    saveCachedSupplierUuid(uuidFromPage);
  }

  return uuidFromPage;
}

function extractSupplierUuid(value: string): string | null {
  const match = value.match(/\/orgs\/([^/?#]+)/);
  return match?.[1] ?? null;
}

export async function resolveUberCookieHeader(options: { skipEnvCookie?: boolean } = {}): Promise<string | null> {
  const envCookie = options.skipEnvCookie ? null : getEnvValue("UBER_COOKIE");
  if (envCookie) {
    return envCookie;
  }

  const cachedCookie = loadCachedSessionCookie();
  if (cachedCookie) {
    return cachedCookie;
  }

  return loginAndCaptureUberCookie();
}

export async function loginAndCaptureUberCookie(): Promise<string | null> {
  const email = getEnvValue("UBER_EMAIL");
  const password = getEnvValue("UBER_PASSWORD");

  if (!email || !password) {
    console.error("Uber credentials are missing for automatic login.");
    return null;
  }

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext(getUberBrowserContextOptions());
    const page = await context.newPage();

    await page.goto(getUberEarningsUrl(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

    if (!page.url().includes("supplier.uber.com")) {
      await fillFirstVisible(page, uberEmailSelectors, email);
      await clickFirstVisible(page, uberContinueSelectors);
      await page.waitForTimeout(1_500);
      await fillFirstVisible(page, uberPasswordSelectors, password);
      await clickFirstVisible(page, uberSubmitSelectors);
    }

    await page.waitForURL((url) => url.toString().includes("supplier.uber.com"), {
      timeout: 30_000,
    });
    await page.goto(getUberEarningsUrl(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await captureAndSaveSupplierUuid(page);

    if (!isAuthenticatedSupplierUrl(new URL(page.url()))) {
      throw new Error("Uber login did not finish on an authenticated Supplier page.");
    }

    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .filter((cookie) => cookie.domain.includes("uber.com"))
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");

    if (!cookieHeader) {
      throw new Error("No Uber cookies were captured after login.");
    }

    saveCachedSessionCookie(cookieHeader);
    await saveUberStorageState(page);
    console.log("Uber automatic login OK");
    return cookieHeader;
  } catch (error) {
    console.error("Uber automatic login failed.", error);
    return null;
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

export async function fetchUberGraphqlFromAuthenticatedBrowser(body: unknown): Promise<{
  ok: boolean;
  status: number;
  text: string;
}> {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext(getUberBrowserContextOptions());
    const page = await context.newPage();

    await openAuthenticatedUberEarningsPage(page);

    return await page.evaluate(async (requestBody) => {
      const response = await fetch("/graphql", {
        method: "POST",
        headers: {
          accept: "*/*",
          "content-type": "application/json",
          "x-csrf-token": "x",
        },
        body: JSON.stringify(requestBody),
        credentials: "include",
      });

      return {
        ok: response.ok,
        status: response.status,
        text: await response.text(),
      };
    }, body);
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

export async function openInteractiveUberLoginAndCaptureCookie(): Promise<boolean> {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    browser = await chromium.launch({
      headless: false,
    });
    const context = await browser.newContext(getUberBrowserContextOptions({ ignoreSavedState: true }));
    const page = await context.newPage();

    await page.goto("https://supplier.uber.com/", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForURL(isAuthenticatedSupplierUrl, {
      timeout: 300_000,
    });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
    const supplierUuid = await captureAndSaveSupplierUuid(page);

    if (!supplierUuid || !isAuthenticatedSupplierUrl(new URL(page.url()))) {
      return false;
    }

    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .filter((cookie) => cookie.domain.includes("uber.com"))
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");

    if (!cookieHeader) {
      return false;
    }

    saveCachedSessionCookie(cookieHeader);
    await saveUberStorageState(page);
    await saveUberSession({
      cookie: cookieHeader,
      orgUuid: supplierUuid,
      csrfToken: UBER_X_CSRF_TOKEN,
    });
    return true;
  } catch (error) {
    console.error("Interactive Uber login failed.", error);
    return false;
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

function isAuthenticatedSupplierUrl(url: URL): boolean {
  return url.hostname === "supplier.uber.com" && url.pathname.includes("/orgs/");
}

async function openAuthenticatedUberEarningsPage(page: Page): Promise<void> {
  const email = getEnvValue("UBER_EMAIL");
  const password = getEnvValue("UBER_PASSWORD");

  if (!email || !password) {
    throw new Error("Uber credentials are missing for automatic login.");
  }

  const cachedCookie = loadCachedSessionCookie();
  if (cachedCookie) {
    await addCookieHeaderToBrowserContext(page, cachedCookie);
  }

  await page.goto(getUberEarningsUrl(), { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

  if (!page.url().includes("supplier.uber.com")) {
    await fillFirstVisible(page, uberEmailSelectors, email);
    await clickFirstVisible(page, uberContinueSelectors);
    await page.waitForTimeout(1_500);
    await fillFirstVisible(page, uberPasswordSelectors, password);
    await clickFirstVisible(page, uberSubmitSelectors);
  }

  await page.waitForURL((url) => url.toString().includes("supplier.uber.com"), {
    timeout: 30_000,
  });
  await page.goto(getUberEarningsUrl(), { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await captureAndSaveSupplierUuid(page);

  if (!isAuthenticatedSupplierUrl(new URL(page.url()))) {
    throw new Error("Uber session is not authenticated on Supplier.");
  }

  const cookies = await page.context().cookies();
  const cookieHeader = cookies
    .filter((cookie) => cookie.domain.includes("uber.com"))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  if (cookieHeader) {
    saveCachedSessionCookie(cookieHeader);
    await saveUberStorageState(page);
  }
}

function getUberBrowserContextOptions(options: { ignoreSavedState?: boolean } = {}): {
  viewport: { width: number; height: number };
  locale: string;
  storageState?: string;
} {
  const contextOptions: {
    viewport: { width: number; height: number };
    locale: string;
    storageState?: string;
  } = {
    viewport: { width: 1440, height: 960 },
    locale: "fr-FR",
  };

  if (!options.ignoreSavedState && fs.existsSync(UBER_STORAGE_STATE_FILE)) {
    contextOptions.storageState = UBER_STORAGE_STATE_FILE;
  }

  return contextOptions;
}

async function saveUberStorageState(page: Page): Promise<void> {
  if (!fs.existsSync(UBER_CACHE_DIR)) {
    fs.mkdirSync(UBER_CACHE_DIR, { recursive: true });
  }

  await page.context().storageState({ path: UBER_STORAGE_STATE_FILE });
}

async function addCookieHeaderToBrowserContext(page: Page, cookieHeader: string): Promise<void> {
  const cookies = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex <= 0) {
        return null;
      }

      return {
        name: part.slice(0, separatorIndex),
        value: part.slice(separatorIndex + 1),
      };
    })
    .filter((cookie): cookie is { name: string; value: string } => Boolean(cookie));

  if (cookies.length === 0) {
    return;
  }

  await page.context().addCookies(
    cookies.flatMap((cookie) => [
      {
        ...cookie,
        url: "https://supplier.uber.com",
      },
      {
        ...cookie,
        url: "https://account.uber.com",
      },
    ]),
  );
}

async function fillFirstVisible(page: Page, selectors: string[], value: string): Promise<void> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.fill(value, { timeout: 5_000 });
      return;
    }
  }

  throw new Error(`No visible field found for selectors: ${selectors.join(", ")}`);
}

async function clickFirstVisible(page: Page, selectors: string[]): Promise<void> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click({ timeout: 5_000 });
      return;
    }
  }

  throw new Error(`No visible button found for selectors: ${selectors.join(", ")}`);
}

function saveCachedSessionCookie(cookieHeader: string): void {
  try {
    fs.mkdirSync(UBER_CACHE_DIR, { recursive: true });
    fs.writeFileSync(UBER_SESSION_FILE, cookieHeader, "utf8");
  } catch (error) {
    console.error("Unable to save Uber session cookie cache.", error);
  }
}

function saveCachedSupplierUuid(supplierUuid: string): void {
  try {
    fs.mkdirSync(UBER_CACHE_DIR, { recursive: true });
    fs.writeFileSync(UBER_SUPPLIER_UUID_FILE, supplierUuid, "utf8");
  } catch (error) {
    console.error("Unable to save Uber supplier UUID cache.", error);
  }
}

function loadCachedSupplierUuid(): string | null {
  try {
    if (!fs.existsSync(UBER_SUPPLIER_UUID_FILE)) {
      return null;
    }

    const supplierUuid = fs.readFileSync(UBER_SUPPLIER_UUID_FILE, "utf8").trim();
    return supplierUuid || null;
  } catch (error) {
    console.error("Unable to load Uber supplier UUID cache.", error);
    return null;
  }
}

function loadCachedSessionCookie(): string | null {
  try {
    if (!fs.existsSync(UBER_SESSION_FILE)) {
      return null;
    }

    const cookie = fs.readFileSync(UBER_SESSION_FILE, "utf8").trim();
    return cookie || null;
  } catch (error) {
    console.error("Unable to load Uber session cookie cache.", error);
    return null;
  }
}

function isUberSessionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  return (
    normalized.includes("expired") ||
    normalized.includes("redirected") ||
    normalized.includes("not found") ||
    normalized.includes("unexpected token") ||
    normalized.includes("http 401") ||
    normalized.includes("http 403")
  );
}

const uberEmailSelectors = [
  'input[type="email"]',
  'input[name="email"]',
  'input[id="PHONE_NUMBER_or_EMAIL_ADDRESS"]',
  'input[name="PHONE_NUMBER_or_EMAIL_ADDRESS"]',
  'input[id*="email"]',
  'input[autocomplete="username"]',
  'input[type="text"]',
];

const uberPasswordSelectors = [
  'input[type="password"]',
  'input[name="password"]',
  'input[id*="password"]',
  'input[autocomplete="current-password"]',
];

const uberContinueSelectors = [
  'button[type="submit"]',
  'button:has-text("Continuer")',
  'button:has-text("Continue")',
  'button:has-text("Suivant")',
  'button:has-text("Next")',
];

const uberSubmitSelectors = [
  'button[type="submit"]',
  'button:has-text("Se connecter")',
  'button:has-text("Connexion")',
  'button:has-text("Sign in")',
  'button:has-text("Continuer")',
];

function saveCachedUberDrivers(drivers: WeeklyDriverInput[]): void {
  try {
    fs.mkdirSync(UBER_CACHE_DIR, { recursive: true });
    fs.writeFileSync(UBER_CACHE_FILE, JSON.stringify(drivers), "utf8");
  } catch (error) {
    console.error("Unable to save Uber cache.", error);
  }
}

function loadCachedUberDrivers(): WeeklyDriverInput[] {
  try {
    if (!fs.existsSync(UBER_CACHE_FILE)) {
      return [];
    }

    const raw = fs.readFileSync(UBER_CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as WeeklyDriverInput[];
  } catch (error) {
    console.error("Unable to load Uber cache.", error);
    return [];
  }
}

function savePlatformStatus(state: "live" | "cache" | "fallback", message: string): void {
  try {
    fs.mkdirSync(UBER_CACHE_DIR, { recursive: true });
    fs.writeFileSync(
      UBER_STATUS_FILE,
      JSON.stringify({ platform: "uber", state, updatedAt: new Date().toLocaleString("fr-FR"), message }),
      "utf8",
    );
  } catch (error) {
    console.error("Unable to save Uber sync status.", error);
  }
}
