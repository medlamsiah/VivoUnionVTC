import { chromium } from "playwright";

const userDataDir = "C:\\Users\\PC\\AppData\\Local\\Google\\Chrome\\User Data";
const targetUrl = "https://supplier.uber.com/orgs/20a91cc4-45d1-4fde-b11a-d05be3ac481a/earnings";

const context = await chromium.launchPersistentContext(userDataDir, {
  channel: "chrome",
  headless: true,
  viewport: { width: 1440, height: 960 },
  locale: "fr-FR",
});

const page = context.pages()[0] ?? (await context.newPage());

page.on("request", (request) => {
  const url = request.url();
  if (/earn|graphql|api|orgs|driver|payment|trip|revenue/i.test(url)) {
    console.log("REQUEST", request.method(), url);
  }
});

page.on("response", (response) => {
  const url = response.url();
  if (/earn|graphql|api|orgs|driver|payment|trip|revenue/i.test(url)) {
    console.log("RESPONSE", response.status(), url);
  }
});

await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => undefined);
await page.waitForTimeout(8000);

console.log("FINAL URL", page.url());
console.log("TITLE", await page.title());
console.log("BODY SAMPLE", (await page.locator("body").textContent().catch(() => "")).slice(0, 1200));

await context.close();
