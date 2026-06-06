import { NextResponse } from "next/server";

import { getUberSessionStatus } from "@/lib/integrations/uber-session";
import { openInteractiveUberLoginAndCaptureCookie } from "@/lib/integrations/uber-scraper";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  if (process.env.VERCEL) {
    return NextResponse.json(
      {
        ok: false,
        provider: "uber",
        error:
          "Identification interactive indisponible sur Vercel serverless. Utilisez /admin/uber-session pour enregistrer la session serveur.",
      },
      { status: 501 },
    );
  }

  const ok = await openInteractiveUberLoginAndCaptureCookie();

  if (!ok) {
    return NextResponse.json(
      {
        ok: false,
        provider: "uber",
        error: "Identification Uber incomplete. Terminez la connexion jusqu'au portail Supplier Uber.",
      },
      { status: 401 },
    );
  }

  return NextResponse.json({
    ok: true,
    provider: "uber",
    session: await getUberSessionStatus(),
    message: "Session Uber enregistree cote serveur.",
  });
}
