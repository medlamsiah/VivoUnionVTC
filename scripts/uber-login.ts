import { chromium } from "playwright";
import fs from "fs";

async function main() {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 300,
  });

  const context = await browser.newContext();

  const page = await context.newPage();

  await page.goto("https://supplier.uber.com", {
    waitUntil: "networkidle",
  });

  console.log("Connecte-toi manuellement puis appuie ENTER dans le terminal.");

  process.stdin.resume();

  process.stdin.once("data", async () => {
    await context.storageState({
      path: "uber-session.json",
    });

    console.log("Session sauvegardée.");
    await browser.close();
    process.exit(0);
  });
}

main();