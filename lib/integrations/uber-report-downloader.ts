import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import puppeteer, { type Browser, type CookieParam, type Page } from "puppeteer";

import { importUberSupplierReport, type UberReportImportSummary } from "./uber-report-import";

const UBER_REPORTS_URL =
  "https://supplier.uber.com/orgs/20a91cc4-45d1-4fde-b11a-d05be3ac481a/reports";
const DEFAULT_SESSION_FILE = path.join(process.cwd(), "storage", "uber-session.json");
const DEFAULT_DOWNLOAD_DIR = path.join(os.tmpdir(), "vivo-uber-reports");
const REPORT_LABELS = ["paiements par chauffeur", "payments by driver", "payments_driver"];

export class UberReportSessionExpiredError extends Error {
  constructor(message = "Session Uber expiree, reconnectez-vous manuellement.") {
    super(message);
    this.name = "UberReportSessionExpiredError";
  }
}

export type UberReportDownloadResult = {
  ok: true;
  downloadedFile: string;
  importSummary: UberReportImportSummary;
  logs: string[];
};

type StoredSession = {
  cookies?: CookieParam[];
};

export async function downloadAndImportLatestUberReport(): Promise<UberReportDownloadResult> {
  const logs: string[] = [];
  const sessionFile = getUberSessionFile();
  const downloadDir = getUberReportDownloadDir();
  let browser: Browser | null = null;

  try {
    logs.push(`Lecture session Uber: ${sessionFile}`);
    const cookies = await loadUberCookies(sessionFile);
    if (cookies.length === 0) {
      throw new UberReportSessionExpiredError();
    }

    await fs.mkdir(downloadDir, { recursive: true });
    logs.push(`Dossier telechargement: ${downloadDir}`);

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    await page.setCookie(...cookies);
    await enableDownloads(page, downloadDir);

    logs.push("Ouverture Uber Supplier reports...");
    await page.goto(UBER_REPORTS_URL, {
      waitUntil: "networkidle2",
      timeout: 60_000,
    });
    await assertUberSessionActive(page);

    logs.push("Recherche du dernier rapport Paiements par chauffeur...");
    await waitForReports(page);
    const beforeFiles = await listFiles(downloadDir);
    const clicked = await clickLatestPaymentsDriverDownload(page);

    if (!clicked) {
      throw new Error("Rapport Paiements par chauffeur introuvable ou bouton Telecharger absent.");
    }

    logs.push("Telechargement du rapport...");
    const downloadedFile = await waitForDownloadedFile(downloadDir, beforeFiles);
    logs.push(`Fichier telecharge: ${downloadedFile}`);

    const buffer = await fs.readFile(downloadedFile);
    const importSummary = await importUberSupplierReport({
      filename: path.basename(downloadedFile),
      contentType: guessContentType(downloadedFile),
      buffer,
    });

    logs.push(
      `Import termine: ${importSummary.imported} importees, ${importSummary.updated} mises a jour, ${importSummary.unmatchedDrivers.length} non trouve(s).`,
    );

    return {
      ok: true,
      downloadedFile,
      importSummary,
      logs,
    };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

export async function saveInteractiveUberSession(
  options: { email?: string; waitForReportsPage?: boolean; timeoutMs?: number } = {},
): Promise<{ sessionFile: string; cookies: number }> {
  const sessionFile = getUberSessionFile();
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized"],
  });
  const page = await browser.newPage();

  try {
    await page.goto(UBER_REPORTS_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    if (options.email) {
      const didSubmitEmail = await fillUberLoginEmail(page, options.email);
      if (didSubmitEmail) {
        console.log(`Email Uber renseigne automatiquement: ${options.email}`);
        console.log("Recuperez le code envoye par Uber, puis saisissez-le dans Chromium.");
      } else {
        console.log("Champ email Uber non detecte automatiquement. Continuez la connexion manuellement.");
      }
    }

    console.log("Connectez-vous a Uber Supplier dans Chromium.");
    if (options.waitForReportsPage) {
      console.log("La session sera sauvegardee automatiquement quand la page reports sera ouverte.");
      await waitForReportsPage(page, options.timeoutMs ?? 180_000);
    } else {
      console.log("Quand la page reports est ouverte, revenez ici et appuyez sur Entree.");
      await waitForEnter();
    }

    const cookies = await page.cookies();
    await fs.mkdir(path.dirname(sessionFile), { recursive: true });
    await fs.writeFile(
      sessionFile,
      JSON.stringify(
        {
          savedAt: new Date().toISOString(),
          cookies,
        },
        null,
        2,
      ),
      "utf8",
    );

    await browser.close();

    return {
      sessionFile,
      cookies: cookies.length,
    };
  } catch (error) {
    await browser.close().catch(() => undefined);
    throw error;
  }
}

async function fillUberLoginEmail(page: Page, email: string): Promise<boolean> {
  try {
    await page.waitForSelector("input", {
      timeout: 20_000,
    });
    const filled = await page.evaluate((value) => {
      const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input"));
      const input =
        inputs.find((candidate) => {
          const name = `${candidate.name ?? ""} ${candidate.id ?? ""} ${candidate.placeholder ?? ""} ${candidate.getAttribute("aria-label") ?? ""}`.toLowerCase();
          return (
            candidate.type === "email" ||
            candidate.autocomplete === "username" ||
            name.includes("email") ||
            name.includes("e-mail") ||
            name.includes("telephone") ||
            name.includes("phone")
          );
        }) ?? inputs.find((candidate) => !candidate.disabled && candidate.offsetParent !== null);

      if (!input) {
        return false;
      }

      input.focus();
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }, email);

    if (!filled) {
      return false;
    }

    await page.keyboard.press("Enter").catch(() => undefined);
    await page
      .waitForNavigation({
        waitUntil: "domcontentloaded",
        timeout: 8_000,
      })
      .catch(() => undefined);

    return true;
  } catch {
    return false;
  }
}

async function waitForReportsPage(page: Page, timeoutMs: number): Promise<void> {
  try {
    await page.waitForFunction(
      () => {
        const url = new URL(window.location.href);
        return url.hostname === "supplier.uber.com" && url.pathname.includes("/reports");
      },
      {
        timeout: timeoutMs,
      },
    );
  } catch {
    throw new Error("Connexion Uber non terminee. Reessayez puis entrez le code recu par email avant l'expiration.");
  }
}

function getUberSessionFile(): string {
  return process.env.UBER_REPORT_SESSION_FILE?.trim() || DEFAULT_SESSION_FILE;
}

function getUberReportDownloadDir(): string {
  return process.env.UBER_REPORT_DOWNLOAD_DIR?.trim() || DEFAULT_DOWNLOAD_DIR;
}

async function loadUberCookies(sessionFile: string): Promise<CookieParam[]> {
  const envSession = process.env.UBER_REPORT_SESSION_JSON?.trim();
  if (envSession) {
    const parsed = JSON.parse(envSession) as StoredSession | CookieParam[];
    const cookies = Array.isArray(parsed) ? parsed : parsed.cookies;
    return Array.isArray(cookies) ? cookies : [];
  }

  try {
    const parsed = JSON.parse(await fs.readFile(sessionFile, "utf8")) as StoredSession | CookieParam[];
    const cookies = Array.isArray(parsed) ? parsed : parsed.cookies;

    return Array.isArray(cookies) ? cookies : [];
  } catch {
    return [];
  }
}

async function enableDownloads(page: Page, downloadDir: string): Promise<void> {
  const client = await page.createCDPSession();
  await client.send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: downloadDir,
  });
}

async function assertUberSessionActive(page: Page): Promise<void> {
  const url = page.url();
  const bodyText = await page.evaluate(() => document.body?.innerText?.toLowerCase() ?? "");
  const requiresLogin =
    !url.includes("supplier.uber.com") ||
    url.includes("login") ||
    bodyText.includes("sign in") ||
    bodyText.includes("log in") ||
    bodyText.includes("connexion") ||
    bodyText.includes("code de verification") ||
    bodyText.includes("verification code");

  if (requiresLogin) {
    throw new UberReportSessionExpiredError();
  }
}

async function waitForReports(page: Page): Promise<void> {
  await page.waitForFunction(
    (labels) => {
      const text = document.body?.innerText?.toLowerCase() ?? "";
      return (labels as string[]).some((label) => text.includes(label));
    },
    {
      timeout: 60_000,
    },
    REPORT_LABELS,
  );
}

async function clickLatestPaymentsDriverDownload(page: Page): Promise<boolean> {
  return page.evaluate((labels) => {
    const labelList = labels as string[];
    const rowSelectors = ["tr", "[role='row']", "li", "[data-testid*='report']", "div"];
    const rows = rowSelectors.flatMap((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector)));
    const seen = new Set<HTMLElement>();
    const uniqueRows = rows.filter((row) => {
      if (seen.has(row)) {
        return false;
      }

      seen.add(row);
      return true;
    });
    const matchingRows = uniqueRows.filter((row) => {
      const text = row.innerText?.toLowerCase() ?? "";
      return labelList.some((label) => text.includes(label));
    });

    for (const row of matchingRows) {
      const controls = Array.from(row.querySelectorAll<HTMLElement>("button,a,[role='button']"));
      const downloadControl =
        controls.find((control) => {
          const text = `${control.innerText ?? ""} ${control.getAttribute("aria-label") ?? ""} ${control.getAttribute("title") ?? ""}`.toLowerCase();
          return text.includes("telecharger") || text.includes("télécharger") || text.includes("download");
        }) ?? controls[controls.length - 1];

      if (downloadControl) {
        downloadControl.click();
        return true;
      }
    }

    return false;
  }, REPORT_LABELS);
}

async function waitForDownloadedFile(downloadDir: string, beforeFiles: Set<string>): Promise<string> {
  const startedAt = Date.now();
  let lastCandidate = "";
  let lastSize = -1;
  let stableCount = 0;

  while (Date.now() - startedAt < 120_000) {
    const files = await listFiles(downloadDir);
    const candidates = [...files].filter((file) => !beforeFiles.has(file) && !file.endsWith(".crdownload"));

    if (candidates.length > 0) {
      const candidate = candidates
        .map((file) => path.join(downloadDir, file))
        .sort()
        .at(-1)!;
      const stat = await fs.stat(candidate);

      if (candidate === lastCandidate && stat.size === lastSize && stat.size > 0) {
        stableCount += 1;
      } else {
        stableCount = 0;
        lastCandidate = candidate;
        lastSize = stat.size;
      }

      if (stableCount >= 2) {
        return candidate;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error("Telechargement du rapport Uber non termine dans le delai imparti.");
}

async function listFiles(directory: string): Promise<Set<string>> {
  try {
    return new Set(await fs.readdir(directory));
  } catch {
    return new Set();
  }
}

function guessContentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".csv") {
    return "text/csv";
  }

  if (extension === ".xlsx") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }

  if (extension === ".xls") {
    return "application/vnd.ms-excel";
  }

  return "application/octet-stream";
}

async function waitForEnter(): Promise<void> {
  const readline = await import("node:readline/promises");
  const input = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    await input.question("");
  } finally {
    input.close();
  }
}
