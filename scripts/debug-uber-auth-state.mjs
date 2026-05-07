import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx);
    const value = trimmed.slice(idx + 1);
    process.env[key] ??= value;
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));

const email = process.env.UBER_EMAIL?.trim();
const password = process.env.UBER_PASSWORD?.trim();

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, locale: "fr-FR" });

async function dump(label) {
  const url = page.url();
  const inputs = await page.locator("input").evaluateAll((nodes) =>
    nodes.map((node) => ({
      type: node.getAttribute("type"),
      name: node.getAttribute("name"),
      id: node.getAttribute("id"),
      placeholder: node.getAttribute("placeholder"),
      autocomplete: node.getAttribute("autocomplete"),
      value: node.value,
    })),
  );
  const buttons = await page.locator("button").evaluateAll((nodes) =>
    nodes.map((node) => node.textContent?.trim()).filter(Boolean),
  );
  const links = await page.locator("a").evaluateAll((nodes) =>
    nodes.map((node) => node.textContent?.trim()).filter(Boolean),
  );
  const body = (await page.locator("body").textContent().catch(() => ""))?.slice(0, 1500);

  console.log(`\n=== ${label} ===`);
  console.log("URL:", url);
  console.log("INPUTS:", JSON.stringify(inputs, null, 2));
  console.log("BUTTONS:", JSON.stringify(buttons.slice(0, 20), null, 2));
  console.log("LINKS:", JSON.stringify(links.slice(0, 20), null, 2));
  console.log("BODY:", body);
}

async function clickTextButton(possibleTexts) {
  for (const text of possibleTexts) {
    const button = page.locator(`button:has-text("${text}")`).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click({ timeout: 5000 }).catch(() => undefined);
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
await dump("initial");

await page.locator('input[type="email"], input[name="email"], input[id="PHONE_NUMBER_or_EMAIL_ADDRESS"], input[autocomplete="username"]').first().fill(email);
await dump("after email fill");

await clickTextButton(["Continuer", "Continue", "Suivant", "Next"]);
await page.waitForTimeout(3000);
await dump("after continue");

const passwordInput = page.locator('input[type="password"], input[name="password"], input[autocomplete="current-password"]').first();
if (await passwordInput.isVisible().catch(() => false)) {
  await passwordInput.fill(password);
  await dump("after password fill");
  await clickTextButton(["Connexion", "Se connecter", "Log in", "Sign in", "Continuer"]);
  await page.waitForTimeout(5000);
  await dump("after password submit");
}

await browser.close();
