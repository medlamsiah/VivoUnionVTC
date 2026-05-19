import { chromium } from "playwright";
import fs from "fs";

async function main() {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 400,
  });

  const context = await browser.newContext({
    storageState: "uber-session.json",
  });

  const page = await context.newPage();

  await page.goto(
    "https://supplier.uber.com/orgs/20a91cc4-45d1-4fde-b11a-d05be3ac481a/earnings",
    {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    }
  );

  await page.waitForTimeout(8000);

  const reportBtn = page.getByText("Télécharger le rapport");

  if (await reportBtn.isVisible()) {
    await reportBtn.click();
    await page.waitForTimeout(5000);
  }

  const text = await page.locator("body").innerText();

  fs.writeFileSync("uber-page-text.txt", text, "utf8");

  console.log(text);

  console.log("ENTER pour fermer");
  process.stdin.resume();

  process.stdin.once("data", async () => {
    await browser.close();
    process.exit(0);
  });
}

main();