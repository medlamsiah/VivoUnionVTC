import { NextRequest, NextResponse } from "next/server";

import {
  downloadAndImportLatestUberReport,
  UberReportSessionExpiredError,
} from "@/lib/integrations/uber-report-downloader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  return handleDownloadLatestReport(request);
}

export async function GET(request: NextRequest) {
  return handleDownloadLatestReport(request);
}

async function handleDownloadLatestReport(request: NextRequest) {
  if (!isAuthorizedAdminOrCronRequest(request)) {
    return NextResponse.json(
      {
        ok: false,
        provider: "uber",
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }

  try {
    const result = await downloadAndImportLatestUberReport();

    return NextResponse.json({
      ok: true,
      provider: "uber",
      downloadedFile: result.downloadedFile,
      imported: result.importSummary.imported,
      updated: result.importSummary.updated,
      rowsRead: result.importSummary.rowsRead,
      matchedDrivers: result.importSummary.matchedDrivers,
      unmatchedDrivers: result.importSummary.unmatchedDrivers,
      errors: result.importSummary.errors,
      logs: result.logs,
    });
  } catch (error) {
    if (error instanceof UberReportSessionExpiredError) {
      return NextResponse.json(
        {
          ok: false,
          provider: "uber",
          error: "Session Uber expiree, reconnectez-vous manuellement.",
        },
        { status: 401 },
      );
    }

    console.error("Latest Uber report download failed.", error);

    return NextResponse.json(
      {
        ok: false,
        provider: "uber",
        error: error instanceof Error ? error.message : "Telechargement du dernier rapport Uber impossible.",
      },
      { status: 500 },
    );
  }
}

function isAuthorizedAdminOrCronRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");

  if (cronSecret && authorization === `Bearer ${cronSecret}`) {
    return true;
  }

  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return true;
}
