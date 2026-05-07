import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1);
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));

const email = process.env.UBER_EMAIL?.trim();
const password = process.env.UBER_PASSWORD?.trim();

if (!email || !password) {
  throw new Error("Missing UBER_EMAIL or UBER_PASSWORD in .env.local");
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 960 },
  locale: "fr-FR",
});

page.on("request", (request) => {
  const url = request.url();
  if (/earn|orgs|graphql|api|payment|driver|trip|revenue/i.test(url)) {
    console.log("REQUEST", request.method(), url);
  }
});

page.on("response", async (response) => {
  const url = response.url();
  if (/earn|orgs|graphql|api|payment|driver|trip|revenue/i.test(url)) {
    console.log("RESPONSE", response.status(), url);
  }
});

async function clickFirst(selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click({ timeout: 5000 }).catch(() => undefined);
      return true;
    }
  }

  return false;
}

async function fillFirst(selectors, value) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.fill(value, { timeout: 5000 });
      return true;
    }
  }

  return false;
}

await page.goto(
  "https://account.uber.com/?entry_domain=supplier.uber.com&next_url=https%3A%2F%2Fsupplier.uber.com%2F",
  { waitUntil: "domcontentloaded", timeout: 30000 },
);
await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);

await clickFirst([
  'button:has-text("Tout refuser")',
  'button:has-text("Autoriser la sélection")',
  'button:has-text("Autoriser la selection")',
  'button:has-text("Accept")',
]);

await fillFirst(
  [
    'input[type="email"]',
    'input[name="email"]',
    'input[id="PHONE_NUMBER_or_EMAIL_ADDRESS"]',
    'input[autocomplete="username"]',
  ],
  email,
);

await clickFirst([
  'button[type="submit"]',
  'button:has-text("Continuer")',
  'button:has-text("Continue")',
  'button:has-text("Suivant")',
  'button:has-text("Next")',
]);

await page.waitForTimeout(2000);

await fillFirst(
  ['input[type="password"]', 'input[name="password"]', 'input[autocomplete="current-password"]'],
  password,
);

await clickFirst([
  'button[type="submit"]',
  'button:has-text("Connexion")',
  'button:has-text("Se connecter")',
  'button:has-text("Log in")',
  'button:has-text("Sign in")',
]);

await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => undefined);
await page.waitForTimeout(4000);

console.log("AFTER LOGIN URL", page.url());

if (page.url().includes("account.uber.com")) {
  await page.goto("https://supplier.uber.com", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => undefined);
  await page.waitForTimeout(3000);
}

console.log("SUPPLIER URL", page.url());

const orgMatch = page.url().match(/\/orgs\/([^/]+)\//);
const orgId = orgMatch?.[1] ?? "20a91cc4-45d1-4fde-b11a-d05be3ac481a";
const earningsUrl = `https://supplier.uber.com/orgs/${orgId}/earnings`;

await page.goto(earningsUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => undefined);
await page.waitForTimeout(8000);

console.log("EARNINGS URL", page.url());
console.log("TITLE", await page.title());
console.log("BODY SAMPLE", (await page.locator("body").textContent().catch(() => "")).slice(0, 1200));

await browser.close();
