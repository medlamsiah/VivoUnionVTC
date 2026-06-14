import { NextRequest, NextResponse } from "next/server";

import { saveInteractiveUberSession } from "@/lib/integrations/uber-report-downloader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && !process.env.ENABLE_INTERACTIVE_UBER_LOGIN) {
    return NextResponse.json(
      {
        ok: false,
        provider: "uber",
        error: "Creation de session Uber interactive indisponible sur le serveur. Lancez-la sur une machine locale puis transferez storage/uber-session.json.",
      },
      { status: 400 },
    );
  }

  if (!isAuthorizedAdminRequest(request)) {
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
    const result = await saveInteractiveUberSession({
      email: process.env.UBER_LOGIN_EMAIL?.trim(),
      waitForReportsPage: true,
      timeoutMs: 240_000,
    });

    return NextResponse.json({
      ok: true,
      provider: "uber",
      sessionFile: result.sessionFile,
      cookies: result.cookies,
      message: "Session Uber sauvegardee.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        provider: "uber",
        error: error instanceof Error ? error.message : "Creation de session Uber impossible.",
      },
      { status: 500 },
    );
  }
}

function isAuthorizedAdminRequest(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (!origin || !host) {
    return false;
  }

  try {
    return new URL(origin).host === host && (fetchSite === "same-origin" || fetchSite === "same-site");
  } catch {
    return false;
  }
}
