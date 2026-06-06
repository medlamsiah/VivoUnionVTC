import { NextResponse } from "next/server";

import {
  getUberSessionStatus,
  saveUberSession,
  UberSessionMissingError,
} from "@/lib/integrations/uber-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await getUberSessionStatus());
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const cookie = typeof body?.cookie === "string" ? body.cookie : "";
    const orgUuid = typeof body?.orgUuid === "string" ? body.orgUuid : "";
    const csrfToken = typeof body?.csrfToken === "string" ? body.csrfToken : null;

    const status = await saveUberSession({
      cookie,
      orgUuid,
      csrfToken,
    });

    return NextResponse.json({
      ok: true,
      provider: "uber",
      session: status,
      message: "Session Uber enregistree cote serveur.",
    });
  } catch (error) {
    if (error instanceof UberSessionMissingError) {
      return NextResponse.json(
        {
          ok: false,
          provider: "uber",
          error: error.message,
        },
        { status: 400 },
      );
    }

    console.error("Unable to save Uber session metadata.");

    return NextResponse.json(
      {
        ok: false,
        provider: "uber",
        error: "Impossible d'enregistrer la session Uber.",
      },
      { status: 500 },
    );
  }
}
