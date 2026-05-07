import fs from "node:fs";
import path from "node:path";

import { chromium, type Page } from "playwright";
import type { WeeklyDriverInput } from "@/lib/integrations/bolt-scraper";

type HeetchDriverResponse = {
  first_name?: string | null;
  last_name?: string | null;
  earnings?: {
    net_earnings?: number | null;
  };
};

type HeetchEarningsResponse = {
  currency?: string;
  drivers?: HeetchDriverResponse[];
};

type ScrapedHeetchDriverRow = {
  name: string;
  company: string;
  heetch: number;
  week: string;
  weekValue: string;
};

const HEETCH_BASE_URL = "https://driver.heetch.com";
const HEETCH_EARNINGS_URL = `${HEETCH_BASE_URL}/earnings`;
const HEETCH_COMPANY_LABEL = "Aliroute - Heetch";
const DEFAULT_LOCATION_AMOUNT = 0;
const DEFAULT_ACOMPTE_AMOUNT = 0;
const HEETCH_CACHE_DIR = path.join(process.cwd(), ".cache");
const HEETCH_CACHE_FILE = path.join(HEETCH_CACHE_DIR, "heetch-weekly-revenues.json");
const HEETCH_SESSION_FILE = path.join(HEETCH_CACHE_DIR, "heetch-session-cookie.txt");
const HEETCH_STATUS_FILE = path.join(HEETCH_CACHE_DIR, "heetch-sync-status.json");

export async function scrapeHeetchWeeklyRevenues(): Promise<WeeklyDriverInput[]> {
  let cookieHeader = await resolveHeetchCookieHeader();

  if (!cookieHeader) {
    console.warn("Heetch session is missing and no automatic login succeeded.");
    savePlatformStatus("fallback", "Session Heetch indisponible. Aucune reconnexion automatique n'a fonctionne.");
    return loadCachedHeetchDrivers();
  }

  try {
    return await runHeetchSync(cookieHeader);
  } catch (error) {
    if (isHeetchSessionError(error)) {
      console.warn("Heetch session appears expired. Trying automatic re-login.");
      const refreshedCookie = await loginAndCaptureHeetchCookie();
      if (refreshedCookie) {
        cookieHeader = refreshedCookie;

        try {
          return await runHeetchSync(cookieHeader);
        } catch (retryError) {
          console.warn("Heetch scraping still failed after automatic re-login. Returning cached data when available.", retryError);
          savePlatformStatus("cache", "Session Heetch invalide. Derniere synchro chargee depuis le cache.");
          return loadCachedHeetchDrivers();
        }
      }
    }

    console.warn("Heetch scraping failed, returning cached data when available.", error);
    savePlatformStatus("cache", "Synchro Heetch indisponible. Derniere synchro chargee depuis le cache.");
    return loadCachedHeetchDrivers();
  }
}

export async function reconnectHeetchSession(): Promise<boolean> {
  const cookieHeader = await loginAndCaptureHeetchCookie();

  if (!cookieHeader) {
    savePlatformStatus("fallback", "Reconnexion Heetch automatique echouee. Verifie les identifiants serveur.");
    return false;
  }

  savePlatformStatus("cache", "Session Heetch recapturee cote serveur. Lance une verification live pour confirmer la synchro.");
  return true;
}

async function runHeetchSync(cookieHeader: string): Promise<WeeklyDriverInput[]> {
  const rows: ScrapedHeetchDriverRow[] = [];

  for (const range of getHeetchWeeklyRanges(new Date())) {
    const weeklyRows = await fetchHeetchWeek(range.referenceDate, range.week, range.weekValue, cookieHeader);
    rows.push(...weeklyRows);
  }

  const dedupedRows = dedupeRows(rows);
  console.log(`Heetch chauffeurs recuperes: ${dedupedRows.length}`);
  const drivers = buildWeeklyDrivers(dedupedRows);
  saveCachedHeetchDrivers(drivers);
  savePlatformStatus("live", "Synchro Heetch reussie en direct.");
  return drivers;
}

async function fetchHeetchWeek(
  referenceDate: string,
  week: string,
  weekValue: string,
  cookieHeader: string,
): Promise<ScrapedHeetchDriverRow[]> {
  const response = await fetch(`${HEETCH_BASE_URL}/api/earnings?date=${referenceDate}&period=weekly`, {
    method: "GET",
    headers: {
      accept: "application/json, text/plain, */*",
      "accept-language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
      cookie: cookieHeader,
      referer: `${HEETCH_BASE_URL}/earnings`,
    },
  });

  if (!response.ok) {
    throw new Error(`Heetch earnings HTTP ${response.status}`);
  }

  const payload = (await response.json()) as HeetchEarningsResponse;
  const drivers = payload.drivers ?? [];

  return drivers
    .map((driver) => {
      const name = normalizeWhitespace(`${driver.first_name ?? ""} ${driver.last_name ?? ""}`);
      const heetch = parseAmount(driver.earnings?.net_earnings);

      if (!name || heetch === null) {
        return null;
      }

      return {
        name,
        company: HEETCH_COMPANY_LABEL,
        heetch,
        week,
        weekValue,
      } satisfies ScrapedHeetchDriverRow;
    })
    .filter((row): row is ScrapedHeetchDriverRow => Boolean(row));
}

function buildWeeklyDrivers(rows: ScrapedHeetchDriverRow[]): WeeklyDriverInput[] {
  return rows.map((row, index) => ({
    id: index + 1,
    name: row.name,
    company: row.company,
    uber: 0,
    bolt: 0,
    heetch: row.heetch,
    location: DEFAULT_LOCATION_AMOUNT,
    acompte: DEFAULT_ACOMPTE_AMOUNT,
    week: row.week,
    weekValue: row.weekValue,
    status: "Actif",
  }));
}

function dedupeRows(rows: ScrapedHeetchDriverRow[]): ScrapedHeetchDriverRow[] {
  const merged = new Map<string, ScrapedHeetchDriverRow>();

  for (const row of rows) {
    const key = `${row.company.toLowerCase()}::${row.name.toLowerCase()}::${row.weekValue}`;
    const existing = merged.get(key);
    merged.set(key, {
      ...row,
      heetch: round2((existing?.heetch ?? 0) + row.heetch),
    });
  }

  return [...merged.values()];
}

function getHeetchWeeklyRanges(date: Date): Array<{
  referenceDate: string;
  week: string;
  weekValue: string;
}> {
  const today = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const start = new Date(Date.UTC(date.getFullYear(), 3, 1));
  const ranges: Array<{ referenceDate: string; week: string; weekValue: string }> = [];
  const seen = new Set<string>();

  let cursor = new Date(start);

  while (cursor <= today) {
    const { week, weekValue } = getIsoWeekInfo(cursor);
    if (!seen.has(weekValue)) {
      seen.add(weekValue);
      ranges.push({
        referenceDate: formatIsoDate(cursor),
        week,
        weekValue,
      });
    }

    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  return ranges;
}

function getIsoWeekInfo(date: Date): { week: string; weekValue: string } {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
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

function parseAmount(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return round2(value);
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

async function resolveHeetchCookieHeader(): Promise<string | null> {
  const cachedCookie = loadCachedSessionCookie();
  if (cachedCookie) {
    return cachedCookie;
  }

  const envCookie = getEnvValue("HEETCH_COOKIE");
  if (envCookie) {
    return envCookie;
  }

  return loginAndCaptureHeetchCookie();
}

async function loginAndCaptureHeetchCookie(): Promise<string | null> {
  const email = getEnvValue("HEETCH_EMAIL");
  const password = getEnvValue("HEETCH_PASSWORD");

  if (!email || !password) {
    console.warn("Heetch credentials are missing for automatic login.");
    return null;
  }

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 960 },
      locale: "fr-FR",
    });

    await page.goto(HEETCH_EARNINGS_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

    if (!page.url().includes("/earnings") || (await hasAnyVisible(page, heetchEmailSelectors))) {
      await fillFirstVisible(page, heetchEmailSelectors, email);
      await fillFirstVisible(page, heetchPasswordSelectors, password);
      await clickFirstVisible(page, heetchSubmitSelectors);
    }

    await page.waitForURL((url) => url.toString().includes("/earnings"), {
      timeout: 30_000,
    });
    await page.goto(HEETCH_EARNINGS_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .filter((cookie) => cookie.domain.includes("heetch.com"))
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");

    if (!cookieHeader || !cookieHeader.includes("heetch_driver_session=")) {
      throw new Error("No valid Heetch session cookie was captured after login.");
    }

    saveCachedSessionCookie(cookieHeader);
    console.log("Heetch automatic login OK");
    return cookieHeader;
  } catch (error) {
    console.warn("Heetch automatic login failed.", error);
    return null;
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

function saveCachedHeetchDrivers(drivers: WeeklyDriverInput[]): void {
  try {
    fs.mkdirSync(HEETCH_CACHE_DIR, { recursive: true });
    fs.writeFileSync(HEETCH_CACHE_FILE, JSON.stringify(drivers), "utf8");
  } catch (error) {
    console.error("Unable to save Heetch cache.", error);
  }
}

function loadCachedHeetchDrivers(): WeeklyDriverInput[] {
  try {
    if (!fs.existsSync(HEETCH_CACHE_FILE)) {
      return [];
    }

    const raw = fs.readFileSync(HEETCH_CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as WeeklyDriverInput[];
  } catch (error) {
    console.error("Unable to load Heetch cache.", error);
    return [];
  }
}

function saveCachedSessionCookie(cookieHeader: string): void {
  try {
    fs.mkdirSync(HEETCH_CACHE_DIR, { recursive: true });
    fs.writeFileSync(HEETCH_SESSION_FILE, cookieHeader, "utf8");
  } catch (error) {
    console.error("Unable to save Heetch session cookie.", error);
  }
}

function loadCachedSessionCookie(): string | null {
  try {
    if (!fs.existsSync(HEETCH_SESSION_FILE)) {
      return null;
    }

    const cookieHeader = fs.readFileSync(HEETCH_SESSION_FILE, "utf8").trim();
    return cookieHeader || null;
  } catch (error) {
    console.error("Unable to load Heetch session cookie.", error);
    return null;
  }
}

function isHeetchSessionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("http 401") || message.includes("http 403") || message.includes("session") || message.includes("unauthorized");
}

async function hasAnyVisible(page: Page, selectors: string[]): Promise<boolean> {
  for (const selector of selectors) {
    if (await page.locator(selector).first().isVisible().catch(() => false)) {
      return true;
    }
  }

  return false;
}

async function fillFirstVisible(page: Page, selectors: string[], value: string): Promise<void> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.fill(value, { timeout: 5_000 });
      return;
    }
  }

  throw new Error(`No visible Heetch field found for selectors: ${selectors.join(", ")}`);
}

async function clickFirstVisible(page: Page, selectors: string[]): Promise<void> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click({ timeout: 5_000 });
      return;
    }
  }

  throw new Error(`No visible Heetch button found for selectors: ${selectors.join(", ")}`);
}

const heetchEmailSelectors = [
  'input[type="email"]',
  'input[name="email"]',
  'input[autocomplete="username"]',
  'input[autocomplete="email"]',
];

const heetchPasswordSelectors = [
  'input[type="password"]',
  'input[name="password"]',
  'input[autocomplete="current-password"]',
];

const heetchSubmitSelectors = [
  'button[type="submit"]',
  'button:has-text("Se connecter")',
  'button:has-text("Connexion")',
  'button:has-text("Log in")',
  'button:has-text("Login")',
  'button:has-text("Continuer")',
  'button:has-text("Continue")',
];

function savePlatformStatus(state: "live" | "cache" | "fallback", message: string): void {
  try {
    fs.mkdirSync(HEETCH_CACHE_DIR, { recursive: true });
    fs.writeFileSync(
      HEETCH_STATUS_FILE,
      JSON.stringify({ platform: "heetch", state, updatedAt: new Date().toLocaleString("fr-FR"), message }),
      "utf8",
    );
  } catch (error) {
    console.error("Unable to save Heetch sync status.", error);
  }
}
