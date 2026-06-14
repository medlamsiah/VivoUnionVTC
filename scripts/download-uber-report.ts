import {
  downloadAndImportLatestUberReport,
  UberReportSessionExpiredError,
} from "../lib/integrations/uber-report-downloader";

async function main() {
  const result = await downloadAndImportLatestUberReport();

  for (const line of result.logs) {
    console.log(line);
  }

  console.log(
    JSON.stringify(
      {
        downloadedFile: result.downloadedFile,
        imported: result.importSummary.imported,
        updated: result.importSummary.updated,
        matchedDrivers: result.importSummary.matchedDrivers.length,
        unmatchedDrivers: result.importSummary.unmatchedDrivers.length,
        errors: result.importSummary.errors,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof UberReportSessionExpiredError || message.includes("Session Uber expiree")) {
    console.error("Session Uber expiree, reconnectez-vous manuellement.");
    process.exit(2);
  }

  console.error(message);
  process.exit(1);
});
